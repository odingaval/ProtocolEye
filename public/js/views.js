// HTML rendering for all three screens. Text inputs update state without
// re-rendering (to preserve focus); actions re-render via store.render().
import {
  state, activeFrame, canRun, selectedStep,
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
  const inLanding = state.view === 'landing';
  const right = inLanding
    ? `<nav class="site-nav">
         <a href="#how">How it works</a>
         <button type="button" class="nav-link" data-action="preview">Dashboard</button>
         <a href="#trust">Why trust it</a>
       </nav>
       <button type="button" class="btn btn-primary" data-action="go-new">Try the demo</button>`
    : inDash
      ? `<button type="button" class="nav-link" data-action="go-landing">Back to home</button>
         ${statusPill()}
         ${state.auditResult ? `<button type="button" class="btn" data-action="export">Export report</button>` : ''}`
      : statusPill();
  return `
  <header class="site-header">
    <div class="site-header-inner">
      <button type="button" class="logo" data-action="go-landing">Protocol<span class="logo-eye">Eye</span></button>
      <div class="header-right">${right}</div>
    </div>
    ${state.serviceError ? `<div class="header-note">${escapeHtml(state.serviceError)}</div>` : ''}
  </header>`;
}

function footer() {
  return `<footer class="site-footer"><p>Protocol<span class="logo-eye">Eye</span> · Meta Global AI Developer Hackathon</p></footer>`;
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

// ---------------- landing ----------------
// Mini self-playing audit for the hero card: cycles briefing steps,
// moving the tracked box and swapping the verdict pill per step.
export const HERO_DEMO_STEPS = [
  { n: 2, title: 'Seatbelt demonstration', pill: 'pill-green', glyph: '✓', label: 'Supported', time: '00:12', box: { left: '10%', top: '24%', width: '32%', height: '54%' } },
  { n: 3, title: 'Emergency exits', pill: 'pill-green', glyph: '✓', label: 'Supported', time: '00:24', box: { left: '58%', top: '24%', width: '32%', height: '54%' } },
  { n: 4, title: 'Oxygen masks', pill: 'pill-red', glyph: '!', label: 'Deviation', time: '00:36', box: { left: '33%', top: '12%', width: '34%', height: '46%' } },
  { n: 5, title: 'Life vest', pill: 'pill-yellow', glyph: '?', label: 'Inconclusive', time: '00:48', box: { left: '24%', top: '46%', width: '52%', height: '40%' } },
];

let heroIndex = 0;
let heroTimer = null;

function renderHeroStep() {
  const s = HERO_DEMO_STEPS[heroIndex];
  const title = document.getElementById('heroTitle');
  if (!title) return;
  title.textContent = `Step ${s.n} · ${s.title}`;
  const pill = document.getElementById('heroPill');
  pill.className = `pill ${s.pill}`;
  pill.textContent = `${s.glyph} ${s.label}`;
  const box = document.getElementById('heroBox');
  box.style.left = s.box.left;
  box.style.top = s.box.top;
  box.style.width = s.box.width;
  box.style.height = s.box.height;
  document.getElementById('heroCap').textContent = `Video ${s.time} · key area highlighted`;
  document.querySelectorAll('.hero-dot').forEach((d, i) => {
    d.classList.toggle('active', i === heroIndex);
  });
  const frame = document.getElementById('heroFrame');
  frame.classList.remove('scan');
  void frame.offsetWidth;
  frame.classList.add('scan');
}

export function setHeroStep(i) {
  heroIndex = ((i % HERO_DEMO_STEPS.length) + HERO_DEMO_STEPS.length) % HERO_DEMO_STEPS.length;
  renderHeroStep();
}

export function stopLandingHero() {
  if (heroTimer) {
    clearInterval(heroTimer);
    heroTimer = null;
  }
}

export function initLandingHero() {
  stopLandingHero();
  if (!document.getElementById('heroCard')) return;
  renderHeroStep();
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  heroTimer = setInterval(() => {
    const card = document.getElementById('heroCard');
    if (!card) {
      stopLandingHero();
      return;
    }
    if (document.hidden || card.matches(':hover, :focus-within')) return;
    heroIndex = (heroIndex + 1) % HERO_DEMO_STEPS.length;
    renderHeroStep();
  }, 3500);
}

function landingView() {
  return `
  <div class="landing">
    <div class="wrap-wide landing-top">
      <div class="landing-intro">
        <p><span class="pill pill-wine">AI safety checks</span></p>
        <h1 class="landing-title">Did the work match the manual?</h1>
        <p class="landing-lede">Upload your procedure and a video of the work. ProtocolEye checks each
          step and shows the proof, so a person can make the final call.</p>
        <div class="landing-cta-row">
          <button type="button" class="btn btn-primary btn-lg" data-action="go-new">Try the demo</button>
        </div>
      </div>
      <div class="hero-card" id="heroCard" aria-label="Sample audit playing">
        <div class="hero-card-head">
          <p class="hero-card-title" id="heroTitle"></p>
          <span class="pill pill-green" id="heroPill"></span>
        </div>
        <div class="hero-frame" id="heroFrame"><span class="hero-tracked" id="heroBox"></span></div>
        <p class="hero-cap" id="heroCap"></p>
        <div class="hero-dots" role="group" aria-label="Sample audit steps">
          ${HERO_DEMO_STEPS.map((s, i) => `<button type="button" class="hero-dot" data-action="hero-step" data-index="${i}" aria-label="Show step ${s.n}: ${s.title}"></button>`).join('')}
        </div>
      </div>
    </div>

    <section class="band" id="how">
      <div class="wrap-wide">
        <h2>How an audit works</h2>
        <p class="section-sub">Four steps, from document to decision.</p>
        <div class="card-grid-3">
          <div class="info-card"><span class="num-badge">1</span><h3>Add the procedure</h3><p>Upload your procedure. ProtocolEye splits it into clear steps.</p></div>
          <div class="info-card"><span class="num-badge">2</span><h3>Add the video</h3><p>Drop in a video or photo, plus audio if the checks are spoken aloud.</p></div>
          <div class="info-card"><span class="num-badge">3</span><h3>The AI checks each step</h3><p>AI compares each step with what the video and audio show. If it can't tell, it says so.</p></div>
        </div>
        <div class="info-card card-wide"><span class="num-badge">4</span><h3>You decide</h3><p>Confirm, reject, or ask for more proof. Every decision is saved.</p></div>
      </div>
    </section>

    <section class="band band-white" id="trust">
      <div class="wrap-wide">
        <h2>Built so you can check its work</h2>
        <p class="section-sub">The AI helps. A person always has the last word.</p>
        <div class="card-grid-3">
          <div class="info-card"><h3>Proof you can check</h3><p>Every result links back to the step, the video, and the reason.</p></div>
          <div class="info-card"><h3>A clear record</h3><p>Each result shows which AI made it, and whether it ran on your device or online.</p></div>
          <div class="info-card"><h3>Works offline</h3><p>No signal? Keep reviewing. Your work syncs when you reconnect.</p></div>
        </div>
      </div>
    </section>

    <section class="final-cta">
      <div class="wrap-narrow">
        <h2>See the proof behind every result</h2>
        <p class="section-sub">Try it with your own procedure.</p>
        <button type="button" class="btn btn-primary btn-lg" data-action="go-new">Try the demo</button>
      </div>
    </section>
  </div>`;
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
      <span class="mini-label" style="margin-right:4px">Demo:</span>
      <button type="button" class="chip" data-action="demo" data-id="briefing">Cabin Safety Briefing</button>
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

function stepsSidebar(result) {
  const items = result.steps.map((s, i) => `
    <button type="button" class="step-btn ${state.selectedStepIndex === i ? 'selected' : ''}" data-action="select-step" data-index="${i}">
      <span class="title">${s.index} · ${escapeHtml(s.title)}</span>
      ${glyphFor(s.status)}
    </button>`).join('');
  return `
  <aside class="steps-panel">
    <h2>Steps</h2>
    ${items}
  </aside>`;
}

function statusCounts(result) {
  const counts = { supported: 0, deviation: 0, inconclusive: 0, 'not-observed': 0 };
  for (const s of result.steps) counts[s.status] = (counts[s.status] || 0) + 1;
  return counts;
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
          ${escapeHtml(f.label)} · audited
        </button>`).join('')}
      <button type="button" class="frame-pill reaudit" data-action="reaudit" ${state.isRunning ? 'disabled' : ''}>${state.isRunning ? 'Auditing…' : 'Re-run audit'}</button>
    </div>` : '';
  const audioBody = state.transcript
    ? `“${escapeHtml(state.transcript.slice(0, 220))}${state.transcript.length > 220 ? '…' : ''}”`
    : 'No spoken confirmation found for this check.';
  return `
  <div class="evidence-grid">
    <div>
      <div class="evidence-frame">
        <img src="${frame.dataUrl}" alt="${escapeHtml(frame.label)}" />
        ${samOverlay()}
      </div>
      <div class="evidence-meta">
        <span class="cap">${escapeHtml(frame.label)}</span>
        <label class="overlay-toggle"><input type="checkbox" data-toggle="showSam" ${state.showSam ? 'checked' : ''} /> Show tracked component</label>
      </div>
      ${pills}
    </div>
    <div class="audio-card">
      <p><span class="pill pill-slate">Audio</span></p>
      <p>${audioBody}</p>
    </div>
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
  const counts = statusCounts(result);
  const review = state.reviews[step.index];
  const subtitle = `${state.procedureName} · Inspection ${state.inspectionId}`;
  return `
  <div class="wrap-wide dash">
    <div class="dash-head">
      <h1>Inspection dashboard</h1>
      <p class="dash-sub">${escapeHtml(subtitle)}</p>
    </div>
    <div class="count-row">
      <span class="pill pill-green">${counts.supported} ✓ Supported</span>
      <span class="pill pill-red">${counts.deviation} ! Deviation</span>
      <span class="pill pill-yellow">${counts.inconclusive} ? Inconclusive</span>
      <span class="pill pill-slate">${counts['not-observed']} – Not observed</span>
    </div>
    <div class="dash-grid">
      ${stepsSidebar(result)}
      <div class="step-detail">
        <div class="step-head">
          <h2>Step ${step.index} · ${escapeHtml(step.title)}</h2>
          <span class="pill ${{ supported: 'pill-green', deviation: 'pill-red', inconclusive: 'pill-yellow', 'not-observed': 'pill-slate' }[step.status]}">${STEP_META[step.status].glyph} ${STEP_META[step.status].label}</span>
        </div>
        <div>
          <p class="req-kicker">Requirement · ${escapeHtml(step.reference || 'SOP')}</p>
          <p class="req-text">${escapeHtml(step.requirement)}</p>
        </div>
        ${evidenceBlock()}
        <section class="assessment">
          <div class="assessment-head">
            <h3>AI assessment</h3>
            <span class="pill pill-slate">Spark 1.3 · remote</span>
          </div>
          <p>${escapeHtml(step.assessment)}</p>
          ${step.observedIn?.length ? `<p class="hint">Seen in: ${escapeHtml(step.observedIn.join(', '))}</p>` : ''}
          ${step.notEstablished ? `<p class="not-established">Not established: ${escapeHtml(step.notEstablished)}</p>` : ''}
        </section>
        <div class="review-row">
          <button type="button" class="btn btn-primary" data-action="review" data-value="confirmed">Confirm</button>
          <button type="button" class="btn ${review === 'rejected' ? 'btn-red-active' : ''}" data-action="review" data-value="rejected">Reject</button>
          <button type="button" class="btn ${review === 'needs-evidence' ? 'btn-yellow-active' : ''}" data-action="review" data-value="needs-evidence">Needs more evidence</button>
        </div>
        ${qaBlock(step)}
        ${result.reasoningTrace ? `<details class="trace"><summary>Reasoning trace</summary><p>${escapeHtml(result.reasoningTrace)}</p></details>` : ''}
      </div>
    </div>
    ${errorBlock()}
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
  const body = state.view === 'landing'
    ? landingView()
    : state.view === 'new'
      ? newInspectionView()
      : state.auditResult
        ? dashboardView()
        : offlineView();
  app.innerHTML = header() + body + footer();
  if (state.view === 'landing') initLandingHero();
  else stopLandingHero();
}
