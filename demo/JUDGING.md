# Judging-criteria mapping (Indie · Push the Frontier)

Rubric: impact 30% · creative Meta tool use 25% · demo+video 25% · technical depth 20%.

## Impact (30%) — safety audits anyone can run

- Problem: SOP compliance in factories/labs is manual, slow, and inconsistent.
  A missed lockout or missing glove can injure or kill.
- ProtocolEye turns any phone photo + SOP into an audit-ready report in ~30s:
  verdict, matches, discrepancy log with SOP references, reasoning trace, PDF.
- Push-the-Frontier fit: Meta models meet the physical world — understanding
  and controlling real industrial procedures, not chatbots.

## Creative use of Meta AI (25%) — Spark + SAM as a team

- **SAM 3.1** (`sam-3.1` via Responses API): open-vocabulary segmentation of
  PPE and equipment; boxes parsed from the special-token stream and overlaid
  on the evidence.
- **Muse Spark 1.3** (`muse-spark-1.3` via Chat Completions + `json_schema`
  structured output): audits SOP vs pixels, with SAM detections injected as
  grounding context — findings reference regions, not vibes.
- The pairing follows Meta's own recommended pattern: Spark interprets the
  scene, SAM supplies the geometry.

## Demo (25%) — one-click story

- Two built-in Push-the-Frontier SOPs (Electrical LOTO, CNC Setup Check).
- Flow: New inspection → per-step dashboard — sidebar triage, SAM overlay,
  confirm/reject, per-step Q&A, PDF export with reviewer decisions.
- Show a FAIL photo (missing lock) → red verdict → step 3 deviation →
  confirm it → export. Then a PASS photo → green verdict.
- `?preview=sample` gives judges a no-key tour of the dashboard.
- 2-minute script: `demo/VIDEO_SCRIPT.md`.

## Technical depth (20%) — real engineering

- Three Meta models: Spark 1.3 (per-step audit JSON + Q&A), SAM 3.1
  (grounding), Muse Voice Transcribe (audio); graceful degradation at
  every stage, always labeled honestly in the UI.
- Browser media engineering: video key-frame extraction, WAV 16kHz mono
  conversion for the ASR endpoint — no native deps.
- Offline mode: connectivity detection, persisted sync queue, heuristic
  local pre-check (full Glimmer-weights inference is the stated roadmap),
  re-run after sync with summary.
- Zero-dependency everything: static vanilla-JS frontend served by the same
  plain-Node process that proxies `/api/*`; `MODEL_API_KEY` stays server-side.
  No build step, no `npm install`.
- 30 maintained tests (`npm test`, Node built-in runner) cover the SAM box
  grammar, SSE parsing, per-step schema contract, Q&A + transcription
  builders, the `.env` loader, and all Meta calls (mocked).
- PDF SOP ingestion (reader lazy-loaded on demand), report export with
  reviews via a print stylesheet (save as PDF).
