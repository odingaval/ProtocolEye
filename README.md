# ProtocolEye — Grounded Safety Inspections (Meta Global AI Developer Hackathon)

**Track:** Indie · **Theme:** Push the Frontier (manufacturing / energy safety)

ProtocolEye audits a photo or video of factory-floor or lab work against a
Standard Operating Procedure and returns a structured Pass/Fail/Caution
verdict — broken down per SOP step, with a human review workflow. The
Meta-native pipeline pairs three models:

1. **Muse Voice Transcribe** turns spoken narration into a transcript excerpt.
2. **SAM 3.1** segments the evidence (PPE, gauges, signs…) and grounds every
   finding to pixel regions with overlay boxes.
3. **Muse Spark 1.3** (`muse-spark-1.3` via Meta Model API) reasons over the
   SOP + pixels + grounding + transcript into a per-step audit, and answers
   follow-up questions per step.

The whole project is **zero dependencies**: a static HTML/CSS/vanilla-JS
frontend served by a plain-Node backend. No build step, no bundler, no
`npm install` required. Built with Muse Code.

## Prerequisites

- Node.js 20+
- A Meta Model API key — `MODEL_API_KEY` from https://dev.meta.ai
  (hackathon participants get $150 in credits)

## Where to set the API key

1. Copy the example file:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and paste your key:
   ```
   MODEL_API_KEY=paste_your_key_here
   ```
3. (Re)start the server:
   ```bash
   npm start
   ```
   The server prints `key: configured` when it picked the key up, and the
   app's header warning disappears. The key never leaves the server — the
   browser only talks to `/api/*` on the same origin.

Without a key, the app still runs: explore `?preview=sample` or queue an
inspection offline.

## Run

```bash
npm start     # app + API on http://localhost:3001
npm test      # 30 maintained checks, no runner to install
```

Open http://localhost:3001/ in a browser.

## Usage

1. On **New inspection**, click **Electrical LOTO** or **CNC Setup Check**
   to load a demo SOP (or paste your own / upload `.txt`, `.md`, `.pdf` —
   PDFs load their reader on demand, so the first PDF needs a connection).
2. Drop a photo or video as evidence (video → key frames are extracted in
   the browser) and optionally attach audio narration.
3. Click **Run inspection**: voice transcribes, SAM 3.1 grounds, Spark audits.
4. On the **dashboard**, walk the steps sidebar, toggle the SAM overlay,
   confirm/reject each assessment, ask follow-up questions, export the
   report (print view → save as PDF).
5. Run offline and the inspection is queued instead: a local pre-check plus
   "waiting for connection" list appear, with **Re-run after sync**.

## Project layout

```
├── public/                 # static frontend (served by the server)
│   ├── index.html          # app shell
│   ├── styles.css          # dark theme + print stylesheet
│   └── js/
│       ├── main.js         # events, file handling, boot
│       ├── views.js        # the 3 wireframe screens
│       ├── store.js        # state, pipeline, reviews, Q&A, offline queue
│       ├── api.js          # /api/* client
│       ├── media.js        # frame extraction, WAV conversion, PDF text
│       └── demo-data.js    # demo SOPs + labeled sample preview
├── server/
│   ├── api-server.js       # static server + Meta API proxy (zero deps)
│   ├── meta-client.js      # Spark / SAM / Voice calls + parsers
│   ├── dotenv.js           # .env loader
│   └── __tests__/          # npm test (30 checks)
├── demo/                   # judging map, video script, screenshots
├── .env.example            # copy to .env and add MODEL_API_KEY
└── package.json            # scripts only — zero dependencies
```

## Docs for judges

- `demo/JUDGING.md` — how the project maps to the scoring rubric
- `demo/VIDEO_SCRIPT.md` — 2-minute demo video script
