# Demo video script (~2 minutes)

## 0:00–0:15 — Hook
"Every year, workers are hurt because a safety step was skipped — a missing
lock, missing gloves — and nobody caught it. ProtocolEye catches it, step by
step, from a single photo."

## 0:15–0:45 — New inspection (screen: new-inspection view)
"This is ProtocolEye — zero dependencies, one Node command to run — built for
the Meta Global AI Developer Hackathon on Muse Spark, SAM 3.1, and Muse
Voice. I'll load the Electrical Lockout-Tagout demo — [click Electrical
LOTO] — drop in a floor photo — [drop photo] — and run the inspection.
Voice transcribes, SAM segments, Spark audits each step."

## 0:45–1:25 — Dashboard triage (screen: dashboard)
"Verdict: FAIL — and the sidebar tells me exactly where: step 3, missing
lock. [click step 3] The requirement, the evidence with SAM boxes I can
toggle, and the AI assessment with what it could not establish. I confirm
the deviation — [click Confirm] — and ask a follow-up: 'is a tag visible?'
[ask] The PDF export carries my review decisions. [click Export report]"

## 1:25–1:50 — Pass case + offline (screen: reset, good photo, then offline)
"Same SOP, compliant photo: PASS across the board. And when the floor has no
signal, inspections queue offline with a local pre-check — [show offline
banner] — then sync and re-run on reconnect."

## 1:50–2:00 — Close
"Three Meta models, one honest workflow: Spark judges, SAM shows where,
Voice hears what was said. Push the Frontier — Meta's models watching over
the real world."

## Recording checklist
- [ ] Server running (`npm start`), key set in `.env`, app on :3001
- [ ] Two evidence photos ready (fail + pass) for the LOTO SOP
- [ ] Zoom the browser to 110% so boxes and text read on video
- [ ] Keep the SAM overlay visible when narrating grounding
- [ ] Backup: `?preview=sample` tours the dashboard with no key at all
