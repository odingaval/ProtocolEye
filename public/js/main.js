// Event delegation, file handling, and boot.
import * as store from './store.js';
import { renderApp, setHeroStep } from './views.js';
import { convertToWav16kMono, extractPdfText, extractVideoFrames, readImageFile } from './media.js';
import { deriveProcedureName } from './store.js';

store.onRender(renderApp);

function refreshRunButton() {
  const btn = document.querySelector('[data-action="run"]');
  if (!btn) return;
  const can = store.canRun();
  btn.disabled = !can;
}

// Text inputs update state without re-rendering (preserves focus).
document.addEventListener('input', (e) => {
  const field = e.target?.dataset?.field;
  if (!field) return;
  store.state[field] = e.target.value;
  if (field === 'sopText') {
    if (store.state.procedureName === 'Untitled procedure' && e.target.value.trim()) {
      store.state.procedureName = deriveProcedureName(e.target.value);
      const proc = document.getElementById('proc-name');
      if (proc) proc.value = store.state.procedureName;
    }
    refreshRunButton();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target?.dataset?.field === 'questionDraft') {
    e.preventDefault();
    void store.askQuestion();
  }
});

document.addEventListener('change', async (e) => {
  const toggle = e.target?.dataset?.toggle;
  if (toggle) {
    store.state[toggle] = e.target.checked;
    store.render();
    return;
  }
  const id = e.target?.id;
  if (id === 'sopFileInput') await handleSopFile(e.target.files?.[0]);
  if (id === 'evidenceFileInput') await handleEvidenceFile(e.target.files?.[0]);
  if (id === 'audioFileInput') await handleAudioFile(e.target.files?.[0]);
  e.target.value = '';
});

document.addEventListener('click', (e) => {
  const stopper = e.target.closest('[data-stop]');
  const actionEl = e.target.closest('[data-action]');
  if (!actionEl || (stopper && !e.target.closest('.frame-thumb'))) {
    if (!actionEl) return;
  }
  // Clicks inside the selected-frames strip shouldn't retrigger the dropzone file dialog,
  // except clicks on a frame thumbnail itself (handled by its own action).
  if (actionEl.dataset.action === 'evidence-file' && e.target.closest('[data-stop]') && !e.target.closest('.frame-thumb')) {
    return;
  }
  handleAction(actionEl.dataset, e);
});

function handleAction(dataset, e) {
  switch (dataset.action) {
    case 'go-landing': store.goLanding(); break;
    case 'go-new': store.startNew(); break;
    case 'demo': store.loadDemo(dataset.id); break;
    case 'sop-file': document.getElementById('sopFileInput')?.click(); break;
    case 'evidence-file': document.getElementById('evidenceFileInput')?.click(); break;
    case 'audio-file': document.getElementById('audioFileInput')?.click(); break;
    case 'audio-clear':
      store.state.audioWavBase64 = null;
      store.state.audioFileName = null;
      store.render();
      break;
    case 'toggle-analysis':
      store.state.showAnalysisSettings = !store.state.showAnalysisSettings;
      store.render();
      break;
    case 'run': void store.runInspection(); break;
    case 'rerun': void store.rerunAfterSync(); break;
    case 'preview': store.previewSample(); break;
    case 'hero-step': setHeroStep(Number(dataset.index)); break;
    case 'select-frame':
      e.stopPropagation();
      store.state.activeFrameIndex = Number(dataset.index);
      store.render();
      break;
    case 'select-frame-dash':
      store.state.activeFrameIndex = Number(dataset.index);
      store.render();
      break;
    case 'select-step':
      store.state.selectedStepIndex = Number(dataset.index);
      store.render();
      break;
    case 'reaudit': void store.reAuditActiveFrame(); break;
    case 'review': {
      const step = store.selectedStep();
      if (step) store.setReview(step.index, dataset.value);
      break;
    }
    case 'ask': void store.askQuestion(); break;
    case 'export': store.exportReport(); break;
  }
}

// Drag & drop for evidence (delegated since the dropzone re-renders).
document.addEventListener('dragover', (e) => {
  const dz = e.target.closest?.('#evidenceDrop');
  if (dz) {
    e.preventDefault();
    dz.classList.add('dragging');
  }
});
document.addEventListener('dragleave', (e) => {
  const dz = e.target.closest?.('#evidenceDrop');
  if (dz && !dz.contains(e.relatedTarget)) dz.classList.remove('dragging');
});
document.addEventListener('drop', async (e) => {
  const dz = e.target.closest?.('#evidenceDrop');
  if (!dz) return;
  e.preventDefault();
  dz.classList.remove('dragging');
  const file = e.dataTransfer?.files?.[0];
  if (file) await handleEvidenceFile(file);
});

async function handleSopFile(file) {
  if (!file) return;
  store.state.sopFileName = file.name;
  try {
    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      store.state.sopText = await extractPdfText(file);
    } else {
      store.state.sopText = await file.text();
    }
    store.state.procedureName = deriveProcedureName(store.state.sopText);
    store.state.error = null;
  } catch (err) {
    store.state.error = err?.message || 'Could not read that SOP file.';
  }
  store.render();
}

async function handleEvidenceFile(file) {
  if (!file) return;
  store.state.error = null;
  try {
    if (file.type.startsWith('video/')) {
      store.state.preparingMedia = 'Extracting frames from video…';
      store.render();
      store.setEvidence(await extractVideoFrames(file, 3), true);
    } else if (file.type.startsWith('image/')) {
      store.state.preparingMedia = 'Preparing photo…';
      store.render();
      const { dataUrl, base64 } = await readImageFile(file);
      store.setEvidence([{ dataUrl, base64, timestamp: null, label: 'Photo evidence' }], false);
    } else {
      store.state.error = 'Evidence must be an image or a video file.';
      store.render();
    }
  } catch (err) {
    store.state.error = err?.message || 'Could not read that evidence file.';
    store.render();
  } finally {
    store.state.preparingMedia = null;
    if (!store.state.error) store.render();
  }
}

async function handleAudioFile(file) {
  if (!file) return;
  store.state.error = null;
  try {
    store.state.preparingMedia = 'Converting audio for transcription…';
    store.render();
    const wav = await convertToWav16kMono(file);
    store.state.audioWavBase64 = wav.base64;
    store.state.audioFileName = wav.fileName;
  } catch {
    store.state.error = 'Could not decode that audio file. Try WAV, MP3, M4A, or OGG.';
  } finally {
    store.state.preparingMedia = null;
    store.render();
  }
}

// ---------- boot ----------
window.addEventListener('online', () => {
  store.state.browserOnline = true;
  void store.checkHealth();
});
window.addEventListener('offline', () => {
  store.state.browserOnline = false;
  store.render();
});
setInterval(() => {
  if (store.state.browserOnline) void store.checkHealth();
}, 15000);

if (new URLSearchParams(window.location.search).get('preview') === 'sample') {
  store.previewSample();
} else {
  renderApp();
}
void store.checkHealth();
