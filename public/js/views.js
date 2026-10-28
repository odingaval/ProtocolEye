// HTML rendering for all three screens. Text inputs update state without
// re-rendering (to preserve focus); actions re-render via store.render().
import {
  state, activeFrame, canRun, selectedStep, needsReview,
  connStatus, isOfflineMode, extractLocalSteps,
} from './store.js';
import { STEP_META } from './demo-data.js';
import { escapeHtml } from './media.js';

function statusPill() {
  const status = connStatus();
  const cls = { online: 'pill-online', offline: 'pill-offline', 'no-backend': 'pill-limited', checking: 'pill-slate' }[status];
  const label = { online: 'Online', offline: 'Offline', 'no-backend': 'Limited', checking: '…' }[status];
  const title = escapeHtml(state.serviceError || label);
  return `<span class="pill ${cls}" title="${title}">${label}</span>`;
}

function header() {
  const inDash = state.view === 'dashboard';
  return `
  <header class="site-header">
    <div class="site-header-inner">
      <button type="button" class="logo" data-action="go-new">ProtocolEye</button>
      ${inDash ? `<span class="context-line">${escapeHtml(state.procedureName)} · Inspection ${escapeHtml(state.inspectionId)}</span>` : ''}
      <div class="header-right">
        ${statusPill()}
        ${inDash && state.auditResult ? `<button type="button" class="btn" data-action="export">Export report</button>` : ''}
      </div>
    </div>
    ${state.serviceError ? `<div class="header-note">${escapeHtml(state.serviceError)}</div>` : ''}
  </header>`;
}

function footer() {
  return `<footer class="site-footer"><p>Muse Spark 1.3 · SAM 3.1 · Muse Voice · Meta Global AI Developer Hackathon</p></footer>`;
}

function errorBlock() {
  return state.error ? `<div class="alert alert-error">${escapeHtml(state.error)}</div>` : '';
}

function analysisSummary() {
  const parts = ['Spark'];
  if (state.useSam) parts.push('SAM');
  if (state.useVoice) parts.push('Voice');
  return parts.join(', ');
}

// ---------------- new inspection ----------------
function newInspectionView() {
  const frames = state.frames.map((f, i) => `
    <button type="button" class="frame-thumb ${state.activeFrameIndex === i ? 'selected' : ''}" data-action="select-frame" data-index="${i}">
      <img src="${f.dataUrl}" alt="${escapeHtml(f.label)}" />
      <span>${escapeHtml(f.label)}</span>
    </button>`).join('');

  return `
  <div class="wrap-narrow">
    <h1 class="page-title">New inspection</h1>
    <p class="page-sub">Push the Frontier · grounded safety audits with Muse Spark + SAM 3.1</p>

    <div class="chip-row" style="margin-bottom:24px">
      <span class="mini-label" style="margin-right:4px">Demos:</span>
      <button type="button" class="chip" data-action="demo" data-id="loto">Electrical LOTO</button>
      <button type="button" class="chip chip-purple" data-action="demo" data-id="cnc">CNC Setup Check</button>
    </div>

    <div class="field">
      <label class="label" for="proc-name">Procedure name</label>
      <input id="proc-name" class="text-input" type="text" data-field="procedureName" value="${escapeHtml(state.procedureName)}" />
    </div>

    <section class="glass card">
      <h2><span class="step-no">1 ·</span> Procedure</h2>
      <div class="chip-row" style="margin-bottom:12px">
        <button type="button" class="btn" data-action="sop-file">Upload SOP</button>
        <span class="hint">or paste text below</span>
        <input type="file" id="sopFileInput" accept=".txt,.md,.pdf" hidden />
        ${state.sopFileName ? `<span class="hint" style="margin-left:auto">${escapeHtml(state.sopFileName)}</span>` : ''}
      </div>
      <textarea class="text-area" rows="9" data-field="sopText" placeholder="Paste the Standard Operating Procedure here, or upload a .txt / .md / .pdf file…">${escapeHtml(state.sopText)}</textarea>
    </section>

    <section class="glass card">
      <h2><span class="step-no">2 ·</span> Evidence</h2>
      <div class="dropzone" id="evidenceDrop" data-action="evidence-file">
        ${state.preparingMedia
          ? `<p class="dropzone-title pulse" style="color:var(--primary)">${escapeHtml(state.preparingMedia)}</p>`
          : state.frames.length
            ? `<div class="frame-strip" data-stop="1">${frames}</div>
               <p class="hint" style="margin-top:12px">Click a frame to audit it · click elsewhere here to replace evidence</p>`
            : `<p class="dropzone-title">Drop video or photo here, or click to browse</p>
               <p class="dropzone-sub">Video → key frames are extracted in your browser · images up to 1600px</p>`}
        <input type="file" id="evidenceFileInput" accept="image/*,video/*" hidden />
      </div>
      <div class="audio-row">
        <button type="button" class="btn" data-action="audio-file">+ Audio <span style="font-weight:400;color:var(--muted)">(optional)</span></button>
        <input type="file" id="audioFileInput" accept="audio/*" hidden />
        ${state.audioFileName
          ? `<span class="audio-name">${escapeHtml(state.audioFileName)}</span><button type="button" class="link-danger" data-action="audio-clear">Remove</button>`
          : `<span class="hint">Spoken narration is transcribed with Muse Voice</span>`}
      </div>
    </section>

    <div class="run-row">
      <div class="analysis-wrap">
        <span>Analysis: <strong>${analysisSummary()}</strong></span>
        <button type="button" class="link" data-action="toggle-analysis" style="margin-left:4px">Change</button>
        ${state.showAnalysisSettings ? `
        <div class="popover">
          <label class="dim"><input type="checkbox" checked disabled /> Muse Spark audit (always on)</label>
          <label><input type="checkbox" data-toggle="useSam" ${state.useSam ? 'checked' : ''} /> SAM 3.1 grounding</label>
          <label><input type="checkbox" data-toggle="useVoice" ${state.useVoice ? 'checked' : ''} /> Voice transcription</label>
        </div>` : ''}
      </div>
      <button type="button" class="btn-primary btn" data-action="run" ${canRun() ? '' : 'disabled'}>
        ${state.isRunning ? `<span class="spinner"></span> ${escapeHtml(state.stage || 'Working…')}` : 'Run inspection'}
      </button>
    </div>
    ${isOfflineMode() && canRun() ? `<p class="hint-warn" style="margin-top:12px">You appear offline — running will queue this inspection and show a local pre-check until you reconnect.</p>` : ''}
    ${errorBlock()}
    <div class="preview-link-row">
      <button type="button" class="link" style="color:var(--muted)" data-action="preview">No API key handy? Preview the dashboard with sample data →</button>
    </div>
  </div>`;
}

// ---------------- dashboard ----------------
function glyphFor(status) {
  return `<span class="glyph glyph-${status}" title="${STEP_META[status].label}">${STEP_META[status].glyph}</span>`;
}

function reviewMark(stepIndex) {
  const r = state.reviews[stepIndex];
  if (r === 'confirmed') return `<span class="review-mark review-confirmed">✓✓</span>`;
  if (r === 'rejected') return `<span class="review-mark review-rejected">✗</span>`;
  if (r === 'needs-evidence') return `<span class="review-mark review-needs-evidence">+</span>`;
  return '';
}

function stepsSidebar(result) {
  const items = result.steps.map((s, i) => `
    <button type="button" class="step-btn ${state.selectedStepIndex === i ? 'selected' : ''}" data-action="select-step" data-index="${i}">
      <span class="num">${s.index}</span>
      <span class="title">${escapeHtml(s.title)}</span>
      ${reviewMark(s.index)}
      ${glyphFor(s.status)}
    </button>`).join('');
  return `
  <aside class="glass steps-panel">
    <h2 class="mini-label" style="padding:0 8px;margin-bottom:12px">Steps</h2>
    ${items}
    <p class="legend">✓ supported · ! deviation · ? inconclusive · – not observed.</p>
    <p class="legend"><strong>${needsReview().length} of ${result.steps.length} need review.</strong></p>
  </aside>`;
}

function samOverlay() {
  if (!state.showSam) return '';
  return state.detections.map((det) => det.boxes.map((box) => {
    const left = (box.nx1 / 10).toFixed(1);
    const top = (box.ny1 / 10).toFixed(1);
    const width = Math.max(0, (box.nx2 - box.nx1) / 10).toFixed(1);
    const height = Math.max(0, (box.ny2 - box.ny1) / 10).toFixed(1);
    return `<div class="sam-box" style="left:${left}%;top:${top}%;width:${width}%;height:${height}%" title="${escapeHtml(det.label)}"><span>${escapeHtml(det.label)}</span></div>`;
  }).join('')).join('');
}

function evidenceBlock() {
  const frame = activeFrame();
  if (!frame) return '';
  const pills = state.frames.length > 1 ? `
    <div class="frame-pills">
      ${state.frames.map((f, i) => `
        <button type="button" class="frame-pill ${state.activeFrameIndex === i ? 'selected' : ''}" data-action="select-frame-dash" data-index="${i}">
          ${escapeHtml(f.label)}${state.auditedFrameIndex === i ? ' · audited' : ''}
        </button>`).join('')}
      ${state.activeFrameIndex !== state.auditedFrameIndex
        ? `<button type="button" class="frame-pill reaudit" data-action="reaudit" ${state.isRunning ? 'disabled' : ''}>${state.isRunning ? 'Auditing…' : 'Re-audit this frame'}</button>`
        : ''}
    </div>` : '';
  return `
  <div>
    <div class="evidence-frame">
      <img src="${frame.dataUrl}" alt="${escapeHtml(frame.label)}" />
      ${samOverlay()}
    </div>
    <div class="evidence-meta">
      <span class="cap">[${escapeHtml(frame.label)}]</span>
      <label class="overlay-toggle"><input type="checkbox" data-toggle="showSam" ${state.showSam ? 'checked' : ''} /> Show SAM overlay</label>
    </div>
    <div class="source-pills">
      <span class="src src-doc">Document</span>
      ${state.isVideoSource ? `<span class="src src-video">Video</span>` : `<span class="src src-photo">Photo</span>`}
      ${state.transcript ? `<span class="src src-audio">Audio</span>` : ''}
    </div>
    ${pills}
    ${state.transcript ? `<p class="audio-excerpt">Audio: “${escapeHtml(state.transcript.slice(0, 220))}${state.transcript.length > 220 ? '…' : ''}”</p>` : ''}
  </div>`;
}

function qaBlock(step) {
  const thread = (state.qaThreads[step.index] || []).map((e) => `
    <div class="qa-thread"><p class="q">Q: ${escapeHtml(e.question)}</p><p class="a">A: ${escapeHtml(e.answer)}</p></div>`).join('');
  return `
  <div>
    ${thread}
    <div class="qa-row">
      <input type="text" class="text-input" data-field="questionDraft" placeholder="Ask about this step" value="${escapeHtml(state.questionDraft)}" ${isOfflineMode() ? 'disabled' : ''} />
      <button type="button" class="btn" data-action="ask" ${state.asking || isOfflineMode() ? 'disabled' : ''}>${state.asking ? '…' : 'Ask'}</button>
    </div>
    ${isOfflineMode() ? `<p class="hint" style="margin-top:4px">Q&amp;A needs a connection — it will work after sync.</p>` : ''}
  </div>`;
}

function dashboardView() {
  const result = state.auditResult;
  const step = selectedStep();
  const verdictCls = { Pass: 'verdict-pass', Fail: 'verdict-fail', Caution: 'verdict-caution' }[result.executiveSummary.status];
  const review = state.reviews[step.index];
  return `
  <div class="wrap-wide">
    ${state.isSamplePreview ? `
    <div class="sample-banner">Sample preview — explore the review workflow, then
      <button type="button" class="link" style="font-weight:700" data-action="go-new">run a real inspection</button>.
    </div>` : ''}
    <div class="verdict ${verdictCls}">
      <span class="status">${result.executiveSummary.status}</span>
      <p class="summary">${escapeHtml(result.executiveSummary.summary)}</p>
      ${result.meta ? `<span class="meta">${escapeHtml(result.meta.model)} · ${result.meta.latencyMs}ms</span>` : ''}
    </div>
    <div class="dash-grid">
      ${stepsSidebar(result)}
      <div class="step-detail">
        <div class="step-head">
          <h2>Step ${step.index} · ${escapeHtml(step.title)}</h2>
          <span class="pill ${{ supported: 'pill-green', deviation: 'pill-red', inconclusive: 'pill-yellow', 'not-observed': 'pill-slate' }[step.status]}">${STEP_META[step.status].glyph} ${STEP_META[step.status].label}</span>
        </div>
        <div>
          <p class="mini-label">Requirement</p>
          <p class="req-text">${escapeHtml(step.requirement)}</p>
          ${step.reference ? `<p class="req-ref">${escapeHtml(step.reference)}</p>` : ''}
        </div>
        ${evidenceBlock()}
        <section class="glass assessment">
          <div class="assessment-head">
            <h3>AI assessment</h3>
            <span class="pill pill-slate">Spark 1.3 · remote</span>
          </div>
          <p>${escapeHtml(step.assessment)}</p>
          ${step.notEstablished ? `<p class="not-established">Not established: ${escapeHtml(step.notEstablished)}</p>` : ''}
        </section>
        <div class="review-row">
          <button type="button" class="btn ${review === 'confirmed' ? 'btn-primary' : ''}" data-action="review" data-value="confirmed">Confirm</button>
          <button type="button" class="btn ${review === 'rejected' ? 'btn-red-active' : ''}" data-action="review" data-value="rejected">Reject</button>
          <button type="button" class="btn ${review === 'needs-evidence' ? 'btn-yellow-active' : ''}" data-action="review" data-value="needs-evidence">Needs more evidence</button>
        </div>
        ${qaBlock(step)}
        ${result.reasoningTrace ? `<details class="trace"><summary>Reasoning trace</summary><p>${escapeHtml(result.reasoningTrace)}</p></details>` : ''}
      </div>
    </div>
    ${errorBlock()}
    <div class="back-link"><button type="button" class="link" data-action="go-new">← Start new inspection</button></div>
  </div>`;
}

// ---------------- offline / queued ----------------
function offlineView() {
  const jobs = state.queue.length ? state.queue.map((job) => `
    <div class="job">
      <p class="job-name">${escapeHtml(job.procedureName)} · ${escapeHtml(job.id)}</p>
      ${job.stages.map((s) => `<p class="job-stage">${escapeHtml(s)}</p>`).join('')}
    </div>`).join('')
    : `<p class="hint">Queue is empty — run an inspection to add it here.</p>`;

  const localSteps = extractLocalSteps(state.sopText);
  return `
  <div class="wrap-wide" style="max-width:896px">
    <div class="alert alert-warn" style="margin-top:32px">
      <strong style="color:var(--yellow)">Offline.</strong> A local assistant is active. Some analysis will run when you reconnect.
    </div>
    <div class="offline-grid" style="margin-top:24px">
      <section class="glass card" style="margin-bottom:0">
        <h2>Waiting for a connection</h2>
        ${jobs}
      </section>
      <section class="glass card" style="margin-bottom:0">
        <div class="finding-head">
          <h2>Local finding · ${escapeHtml(state.procedureName)}</h2>
          <span class="pill pill-slate">Local · pre-check</span>
        </div>
        ${localSteps.length
          ? `<p class="hint" style="margin-bottom:8px">${localSteps.length} SOP step(s) detected in the document:</p>
             <ul class="finding-list">${localSteps.map((s) => `<li>· ${escapeHtml(s)}</li>`).join('')}</ul>`
          : `<p class="hint" style="margin-bottom:12px">No numbered steps detected in the SOP text yet.</p>`}
        <p class="hint" style="margin-bottom:16px">Not assessed: video tracking, audio, grounding, verdicts.</p>
        <button type="button" class="btn" data-action="rerun" ${state.isRunning ? 'disabled' : ''}>
          ${state.isRunning ? (state.stage || 'Working…') : 'Re-run after sync'}
        </button>
        ${!state.frames.length ? `<p class="hint-warn" style="margin-top:8px">Evidence is kept in this tab only — re-attach it if you reloaded.</p>` : ''}
      </section>
    </div>
    ${state.syncSummary ? `<p class="sync-note ok">${escapeHtml(state.syncSummary)}</p>` : `<p class="sync-note">After reconnecting, a sync summary and any conflicts appear here.</p>`}
    ${errorBlock()}
    <div class="back-link"><button type="button" class="link" data-action="go-new">← Back to new inspection</button></div>
  </div>`;
}

export function renderApp() {
  const app = document.getElementById('app');
  const body = state.view === 'new'
    ? newInspectionView()
    : state.auditResult
      ? dashboardView()
      : offlineView();
  app.innerHTML = header() + body + footer();
}
