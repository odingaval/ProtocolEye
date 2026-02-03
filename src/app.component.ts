import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GeminiService } from '@services/gemini.service';
import { AuditResult } from './models/audit-result.model';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
})
export class AppComponent {
  private geminiService = inject(GeminiService);

  sopContent = signal<string>('');
  imagePreviewUrl = signal<string | null>(null);
  imageFileContent = signal<string | null>(null);

  isLoading = signal(false);
  loadingMessage = signal('Initializing audit...');
  auditResult = signal<AuditResult | null>(null);
  error = signal<string | null>(null);

  canAudit = computed(() => this.sopContent() && this.imageFileContent());

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
      const reader = new FileReader();

      reader.onload = (e: any) => {
        const text = e.target.result;
        this.sopContent.set(text);
      };

      reader.readAsText(file);
    }
  }

  async runAudit() {
    if (!this.canAudit()) return;

    this.isLoading.set(true);
    this.auditResult.set(null);
    this.error.set(null);

    try {
      const result = await this.geminiService.auditProcedure(this.imageFileContent()!, this.sopContent());
      this.auditResult.set(result);
    } catch (err) {
      console.error(err);
      this.error.set('An error occurred during the audit. Please check the console for details.');
    } finally {
      this.isLoading.set(false);
    }
  }

  getStatusClass(status: 'Pass' | 'Fail' | 'Caution'): string {
    switch (status) {
      case 'Pass':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'Fail':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'Caution':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  }
}
