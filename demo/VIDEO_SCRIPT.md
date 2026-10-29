# Demo video script (~2 minutes)

## 0:00–0:15 — Hook
"Every flight, cabin crew perform the same safety demo — seatbelt, exits,
oxygen mask, life vest. Skip one, and nobody may notice. ProtocolEye
notices, step by step, from a single video."

## 0:15–0:45 — New inspection (screen: new-inspection view)
"This is ProtocolEye — zero dependencies, one Node command to run — built for
the Meta Global AI Developer Hackathon on Muse Spark, SAM 3.1, and Muse
Voice. I'll load the Cabin Safety Briefing demo — [click Cabin Safety
Briefing] — drop in a briefing clip — [drop video] — and run the
inspection. Voice transcribes, SAM segments, Spark audits each step."

## 0:45–1:25 — Dashboard triage (screen: dashboard)
"The counts show a deviation — and the sidebar tells me exactly where:
step 3, oxygen masks. [click step 3] The requirement, the evidence with
SAM boxes I can toggle, and the AI assessment with what it could not
establish. I confirm the deviation — [click Confirm] — and ask a
follow-up: 'is a mask visible anywhere?' [ask] The PDF export carries my
review decisions. [click Export report]"

## 1:25–1:50 — Pass case + offline (screen: reset, good clip, then offline)
"Same SOP, complete briefing: supported across the board. And when the
floor has no signal, inspections queue offline with a local pre-check —
[show offline banner] — then sync and re-run on reconnect."

## 1:50–2:00 — Close
"Three Meta models, one honest workflow: Spark judges, SAM shows where,
Voice hears what was said. Push the Frontier — Meta's models watching over
the real world."

## Recording checklist
- [ ] Server running (`npm start`), key set in `.env`, app on :3001
- [ ] Two evidence clips ready (skipped step + complete) for the briefing SOP
- [ ] Zoom the browser to 110% so boxes and text read on video
- [ ] Keep the SAM overlay visible when narrating grounding
- [ ] Backup: `?preview=sample` tours the dashboard with no key at all
