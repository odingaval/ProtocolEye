import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GeminiService } from '@services/gemini.service';
import { AuditResult } from './models/audit-result.model';
import jsPDF from 'jspdf';
import * as pdfjsLib from 'pdfjs-dist';

// Set worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = '/assets/pdf.worker.min.mjs';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
})
export class AppComponent {
  private geminiService = inject(GeminiService);
  serviceError = this.geminiService.errorMessage;


  sopContent = signal<string>('');
  imagePreviewUrl = signal<string | null>(null);
  imageFileContent = signal<string | null>(null);
  mimeType = signal<string>('image/jpeg');

  isLoading = signal(false);
  loadingMessage = signal('Initializing audit...');
  auditResult = signal<AuditResult | null>(null);
  error = signal<string | null>(null);
  isDraggingSop = signal(false);

  canAudit = computed(() => this.sopContent() && this.imageFileContent());
  isVideo = computed(() => this.mimeType().startsWith('video/'));

  private loadingMessages = [
    'Analyzing visual evidence...',
    'Cross-referencing standard operating procedures...',
    'Detecting procedural deviations...',
    'Compiling discrepancy log...',
    'Finalizing executive summary...'
  ];



  constructor() {
    effect(() => {
      if (this.isLoading()) {
        let i = 0;
        this.loadingMessage.set(this.loadingMessages[0]);
        const interval = setInterval(() => {
          i = (i + 1) % this.loadingMessages.length;
          this.loadingMessage.set(this.loadingMessages[i]);
        }, 3000);
        return () => clearInterval(interval);
      }
      return;
    });


  }



  onSopContentInput(event: Event) {
    const textarea = event.target as HTMLTextAreaElement;
    this.sopContent.set(textarea.value);
  }

  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();

      reader.onload = (e: any) => {
        const base64String = e.target.result;
        this.imagePreviewUrl.set(base64String);
        // Strip the prefix from the base64 string
        this.imageFileContent.set(base64String.split(',')[1]);
        this.mimeType.set(file.type);
      };

      reader.readAsDataURL(file);
    }
  }

  triggerFileInput() {
    document.getElementById('fileInput')?.click();
  }

  triggerSopFileInput() {
    document.getElementById('sopFileInput')?.click();
  }

  onSopFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];

      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        this.readPdfFile(file);
      } else {
        const reader = new FileReader();
        reader.onload = (e: any) => {
          const text = e.target.result;
          this.sopContent.set(text);
        };
        reader.readAsText(file);
      }
    }
  }

  onSopDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingSop.set(true);
  }

  onSopDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingSop.set(false);
  }

  onSopDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingSop.set(false);

    if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      const file = event.dataTransfer.files[0];

      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        this.readPdfFile(file);
        return;
      }

      // Try to read any file as text, regardless of type/extension
      const reader = new FileReader();
      reader.onload = (e: any) => {
        const text = e.target.result;
        this.sopContent.set(text);
      };
      reader.onerror = () => {
        console.error('Failed to read file');
        // Optional: set an error message in UI if needed
      };
      reader.readAsText(file);
    }
  }

  async readPdfFile(file: File) {
    this.isLoading.set(true);
    this.loadingMessage.set('Extracting text from PDF...');
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
      let fullText = '';

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        fullText += `--- Page ${i} ---\n${pageText}\n\n`;
      }

      this.sopContent.set(fullText);
    } catch (error) {
      console.error('Error reading PDF:', error);
      this.error.set('Failed to extract text from PDF. Please check the file.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async runAudit() {
    if (!this.canAudit()) return;

    this.isLoading.set(true);
    this.auditResult.set(null);
    this.error.set(null);

    try {
      const result = await this.geminiService.auditProcedure(this.imageFileContent()!, this.sopContent(), this.mimeType());
      this.auditResult.set(result);
    } catch (err) {
      console.error(err);
      this.error.set('An error occurred during the audit. Please check the console for details.');
    } finally {
      this.isLoading.set(false);
    }
  }

  isCopied = signal(false);

  copyAuditResult() {
    const result = this.auditResult();
    if (!result) return;
    const text = `Executive Summary:\nStatus: ${result.executiveSummary.status}\n${result.executiveSummary.summary}\n\nProtocol Matches:\n${result.protocolMatches.join('\n')}\n\nDiscrepancy Log:\n${result.discrepancyLog.map(d => `- ${d.discrepancy} (Reference: ${d.reference || 'Not specified'})`).join('\n')}\n\nReasoning Trace:\n${result.reasoningTrace || ''}`;

    navigator.clipboard.writeText(text).then(() => {
      this.isCopied.set(true);
      setTimeout(() => this.isCopied.set(false), 2000);
    });
  }

  exportAuditResultPDF() {
    const result = this.auditResult();
    if (!result) return;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 10;
    const maxLineWidth = pageWidth - margin * 2;
    let y = 10;

    // Helper to add text and advance Y
    const addText = (text: string, fontSize: number = 10, isBold: boolean = false) => {
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', isBold ? 'bold' : 'normal');
      const lines = doc.splitTextToSize(text, maxLineWidth);
      doc.text(lines, margin, y);
      y += lines.length * (fontSize * 0.5) + 2; // Line height approximation
    };

    // Header
    addText('Audit Report', 16, true);
    y += 4;

    // Executive Summary
    addText(`Executive Summary:`, 12, true);
    addText(`Status: ${result.executiveSummary.status}`, 10, true);
    addText(result.executiveSummary.summary, 10);
    y += 4;

    // Protocol Matches
    addText('Protocol Matches:', 12, true);
    if (result.protocolMatches.length > 0) {
      result.protocolMatches.forEach((match) => {
        addText(`- ${match}`, 10);
      });
    } else {
      addText('No protocol matches were identified.', 10);
    }
    y += 4;

    // Discrepancy Log
    addText('Discrepancy Log:', 12, true);
    if (result.discrepancyLog.length > 0) {
      result.discrepancyLog.forEach((d) => {
        addText(`- ${d.discrepancy}`, 10, true); // Bold the discrepancy itself
        addText(`  Reference: ${d.reference || 'Not specified'}`, 10);
      });
    } else {
      addText('No discrepancies found.', 10);
    }

    y += 4;

    // Reasoning Trace
    if (result.reasoningTrace) {
      addText('Reasoning Trace:', 12, true);
      addText(result.reasoningTrace, 10);
    }

    doc.save('audit-report.pdf');
  }

  resetAudit() {
    this.sopContent.set('');
    this.imagePreviewUrl.set(null);
    this.imageFileContent.set(null);
    this.mimeType.set('image/jpeg');
    this.auditResult.set(null);
    this.error.set(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }



  getStatusClass(status: 'Pass' | 'Fail' | 'Caution'): string {
    switch (status) {
      case 'Pass':
        return 'bg-green-500/10 text-green-500 border border-green-500/30';
      case 'Fail':
        return 'bg-red-500/10 text-red-500 border border-red-500/30 font-bold';
      case 'Caution':
        return 'bg-yellow-400 text-black shadow-[0_0_15px_rgba(250,204,21,0.3)] ring-4 ring-yellow-400/20';
      default:
        return 'bg-slate-500/10 text-slate-500 border border-slate-500/30';
    }
  }
}
