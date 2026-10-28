// Central state + inspection pipeline. UI re-renders via onRender callback.
import * as api from './api.js';
import { DEMO_SAMPLES, SAMPLE_AUDIT, SAMPLE_DETECTIONS, SAMPLE_FRAME_DATA_URL } from './demo-data.js';
import { escapeHtml } from './media.js';

const QUEUE_KEY = 'protocoleye-queue-v1';

function newInspectionId() {
  return 'INS-' + Math.random().toString(36).slice(2, 6).toUpperCase();
}

export function deriveProcedureName(sopText) {
  const first = String(sopText || '').split('\n').map((l) => l.trim()).find((l) => l.length > 3);
  if (!first) return 'Untitled procedure';
  return first.replace(/^#+\s*/, '').replace(/^(standard operating procedure|SOP)\s*:\s*/i, '').slice(0, 60) || 'Untitled procedure';
}

/** Heuristic local pre-check: extract numbered/bullet steps from SOP text without any model. */
export function extractLocalSteps(sopText) {
  const steps = [];
  for (const line of String(sopText || '').split('\n')) {
    const t = line.trim();
    if (/^(\d{1,2}[.)]\s+|[-•]\s+|Section\s+\d)/i.test(t) && t.length > 8) {
      steps.push(t.replace(/^#+\s*/, '').slice(0, 120));
    }
    if (steps.length >= 8) break;
  }
  return steps;
}

function loadQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

export const state = {
  view: 'new',
  procedureName: 'Untitled procedure',
  inspectionId: newInspectionId(),
  // inputs
  sopText: '',
  sopFileName: null,
  frames: [],
  activeFrameIndex: 0,
  isVideoSource: false,
  audioFileName: null,
  audioWavBase64: null,
  transcript: null,
  // toggles
  useSam: true,
  useVoice: true,
  showAnalysisSettings: false,
  showSam: true,
  // pipeline
  isRunning: false,
  stage: null,
  preparingMedia: null,
  error: null,
  // results
  auditResult: null,
  auditedFrameIndex: 0,
  detections: [],
  samStatus: 'idle',
  selectedStepIndex: 0,
  reviews: {},
  qaThreads: {},
  asking: false,
  questionDraft: '',
  // connectivity
  browserOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  backendOk: null,
  serviceError: null,
  queue: loadQueue(),
  syncSummary: null,
  isSamplePreview: false,
};

let renderFn = () => {};
export function onRender(fn) {
  renderFn = fn;
}
export function render() {
  renderFn();
}

function saveQueue() {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(state.queue));
  } catch { /* storage unavailable — queue stays in memory */ }
}

// ---------- derived ----------
export const activeFrame = () => state.frames[state.activeFrameIndex] ?? null;
export const canRun = () => !!state.sopText.trim() && state.frames.length > 0 && !state.isRunning;
export const selectedStep = () => state.auditResult?.steps[state.selectedStepIndex] ?? null;
export const detectionCount = () => state.detections.reduce((n, d) => n + d.boxes.length, 0);
export const needsReview = () => {
  if (!state.auditResult) return [];
  return state.auditResult.steps.filter((s) => s.status !== 'supported' && !state.reviews[s.index]);
};
export function connStatus() {
  if (!state.browserOnline) return 'offline';
  if (state.backendOk === null) return 'checking';
  return state.backendOk ? 'online' : 'no-backend';
}
export const isOfflineMode = () => connStatus() !== 'online';

// ---------- connectivity ----------
export async function checkHealth() {
  try {
    const res = await api.checkHealth();
    state.backendOk = res.ok;
    state.serviceError = res.keyConfigured
      ? null
      : 'MODEL_API_KEY is not set on the API server. Add it to .env and restart the server.';
  } catch {
    state.backendOk = false;
    state.serviceError = 'API server unreachable.';
  }
  render();
}

// ---------- inputs ----------
export function loadDemo(id) {
  const demo = DEMO_SAMPLES.find((d) => d.id === id);
  if (!demo) return;
  state.sopText = demo.sopText;
  state.sopFileName = null;
  state.procedureName = demo.title;
  state.error = null;
  render();
}

export function setEvidence(frames, isVideo) {
  state.frames = frames;
  state.activeFrameIndex = 0;
  state.isVideoSource = isVideo;
  state.detections = [];
  state.samStatus = 'idle';
  render();
}

// ---------- pipeline ----------
export async function runInspection() {
  if (!canRun()) return;
  state.error = null;
  state.syncSummary = null;

  if (isOfflineMode()) {
    enqueueCurrent();
    state.view = 'dashboard';
    render();
    return;
  }

  state.isRunning = true;
  state.isSamplePreview = false;
  state.auditResult = null;
  state.reviews = {};
  state.qaThreads = {};
  state.detections = [];
  state.transcript = null;
  render();

  try {
    if (state.useVoice && state.audioWavBase64) {
      state.stage = 'Transcribing audio with Muse Voice…';
      render();
      try {
        state.transcript = await api.transcribeAudio(state.audioWavBase64, state.audioFileName || 'clip.wav');
      } catch (e) {
        console.warn('Transcription failed, continuing without audio:', e);
      }
    }

    const frame = activeFrame();
    let grounded = [];
    if (state.useSam) {
      state.stage = 'Segmenting evidence with SAM 3.1…';
      state.samStatus = 'running';
      render();
      try {
        grounded = await api.segmentEvidence(frame.base64, 'image/jpeg');
        state.detections = grounded;
        state.samStatus = 'done';
      } catch (e) {
        console.warn('SAM grounding failed, continuing ungrounded:', e);
        state.samStatus = 'error';
      }
    } else {
      state.samStatus = 'skipped';
    }

    state.stage = 'Auditing steps with Muse Spark…';
    render();
    const result = await api.auditProcedure({
      imageBase64: frame.base64,
      sopText: state.sopText,
      mimeType: 'image/jpeg',
      detections: grounded,
      audioTranscript: state.transcript,
      evidenceLabel: frame.label,
    });
    state.auditResult = result;
    state.auditedFrameIndex = state.activeFrameIndex;
    const firstBad = result.steps.findIndex((s) => s.status !== 'supported');
    state.selectedStepIndex = firstBad >= 0 ? firstBad : 0;
    dequeueCurrent();
    state.view = 'dashboard';
  } catch (e) {
    console.error(e);
    state.error = e?.message || 'Inspection failed.';
  } finally {
    state.isRunning = false;
    state.stage = null;
    render();
  }
}

export async function reAuditActiveFrame() {
  if (isOfflineMode() || !state.frames.length || state.isRunning) return;
  state.isRunning = true;
  state.stage = 'Re-auditing frame with Muse Spark…';
  state.error = null;
  render();
  try {
    const frame = activeFrame();
    const result = await api.auditProcedure({
      imageBase64: frame.base64,
      sopText: state.sopText,
      mimeType: 'image/jpeg',
      detections: state.detections,
      audioTranscript: state.transcript,
      evidenceLabel: frame.label,
    });
    state.auditResult = result;
    state.auditedFrameIndex = state.activeFrameIndex;
    state.selectedStepIndex = 0;
  } catch (e) {
    state.error = e?.message || 'Re-audit failed.';
  } finally {
    state.isRunning = false;
    state.stage = null;
    render();
  }
}

export async function rerunAfterSync() {
  if (isOfflineMode()) {
    state.error = 'Still offline. Reconnect, then re-run.';
    render();
    return;
  }
  if (!state.frames.length) {
    state.error = 'Evidence was kept in this tab only — please re-attach it, then re-run.';
    state.view = 'new';
    render();
    return;
  }
  await runInspection();
  if (state.auditResult) {
    state.syncSummary = state.queue.length
      ? `Synced just now — remaining queue: ${state.queue.length}. Local pre-check replaced by Spark + SAM verdicts.`
      : 'Synced just now — queue clear. Local pre-check replaced by Spark + SAM verdicts.';
    render();
  }
}

export function setReview(stepIndex, action) {
  state.reviews = { ...state.reviews, [stepIndex]: action };
  render();
}

export async function askQuestion() {
  const step = selectedStep();
  const q = state.questionDraft.trim();
  if (!step || !q || state.asking || isOfflineMode()) return;
  state.asking = true;
  state.questionDraft = '';
  render();
  try {
    const answer = await api.askAboutStep({
      question: q,
      step,
      sopText: state.sopText,
      imageBase64: activeFrame()?.base64,
      audioTranscript: state.transcript,
    });
    appendQA(step.index, q, answer);
  } catch (e) {
    appendQA(step.index, q, `Error: ${e?.message || 'failed'}`);
  } finally {
    state.asking = false;
    render();
  }
}

function appendQA(stepIndex, question, answer) {
  const thread = [...(state.qaThreads[stepIndex] || []), { question, answer }].slice(-4);
  state.qaThreads = { ...state.qaThreads, [stepIndex]: thread };
}

// ---------- offline queue ----------
function enqueueCurrent() {
  const stages = ['Spark step audit'];
  if (state.useSam) stages.unshift('SAM grounding');
  if (state.useVoice && state.audioWavBase64) stages.unshift('Voice transcription');
  const entry = { id: state.inspectionId, procedureName: state.procedureName, createdAt: Date.now(), stages };
  if (!state.queue.some((q) => q.id === entry.id)) {
    state.queue = [...state.queue, entry];
    saveQueue();
  }
}

function dequeueCurrent() {
  if (state.queue.some((q) => q.id === state.inspectionId)) {
    state.queue = state.queue.filter((q) => q.id !== state.inspectionId);
    saveQueue();
  }
}

// ---------- sample preview ----------
export function previewSample() {
  state.procedureName = 'Electrical Lockout-Tagout (sample)';
  state.sopText = DEMO_SAMPLES[0].sopText;
  state.frames = [{ dataUrl: SAMPLE_FRAME_DATA_URL, base64: '', timestamp: null, label: 'Sample frame' }];
  state.activeFrameIndex = 0;
  state.detections = SAMPLE_DETECTIONS;
  state.samStatus = 'done';
  state.auditResult = SAMPLE_AUDIT;
  state.auditedFrameIndex = 0;
  state.selectedStepIndex = 2;
  state.reviews = {};
  state.qaThreads = {};
  state.isSamplePreview = true;
  state.view = 'dashboard';
  render();
}

export function startNew() {
  state.isSamplePreview = false;
  state.view = 'new';
  state.inspectionId = newInspectionId();
  state.auditResult = null;
  state.reviews = {};
  state.qaThreads = {};
  state.error = null;
  state.syncSummary = null;
  state.selectedStepIndex = 0;
  render();
}

// ---------- export (print to PDF) ----------
export function exportReport() {
  const result = state.auditResult;
  if (!result) return;
  const frame = state.frames[state.auditedFrameIndex];
  const reviews = state.reviews;
  const stepsHtml = result.steps.map((s) => `
    <h2>Step ${s.index} — ${escapeHtml(s.title)} [${s.status}]${reviews[s.index] ? ` (reviewer: ${reviews[s.index]})` : ''}</h2>
    <p>${escapeHtml(s.assessment)}</p>
    ${s.reference ? `<p class="print-meta">Ref: ${escapeHtml(s.reference)}</p>` : ''}
    ${s.notEstablished ? `<p class="print-meta">Not established: ${escapeHtml(s.notEstablished)}</p>` : ''}
  `).join('');
  document.getElementById('print-root').innerHTML = `
    <h1>ProtocolEye Inspection Report — ${escapeHtml(state.procedureName)}</h1>
    <p class="print-meta">${escapeHtml(state.inspectionId)} · Evidence: ${escapeHtml(frame?.label || 'n/a')}</p>
    <h2>Verdict: ${result.executiveSummary.status}</h2>
    <p>${escapeHtml(result.executiveSummary.summary)}</p>
    ${state.detections.length ? `<h2>SAM 3.1 grounding</h2><ul>${state.detections.map((d) => `<li>${escapeHtml(d.label)}: ${d.boxes.length} region(s)</li>`).join('')}</ul>` : ''}
    ${state.transcript ? `<h2>Audio transcript (excerpt)</h2><p>${escapeHtml(state.transcript.slice(0, 600))}</p>` : ''}
    ${stepsHtml}
    ${result.reasoningTrace ? `<h2>Reasoning trace</h2><p>${escapeHtml(result.reasoningTrace)}</p>` : ''}
  `;
  window.print();
}
