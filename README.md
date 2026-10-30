# ProtocolEye — Evidence-Grounded Procedure Audits (Meta Global AI Developer Hackathon)

**Track:** Indie · **Theme:** Push the Frontier (frontline safety procedures)

ProtocolEye helps a human reviewer check real work against its Standard
Operating Procedure: upload a video or photo of the job, and it cross-checks
each SOP step against the pixels — supported, deviation, inconclusive, or
not observed — with every finding pinned to the evidence behind it. The AI
assists; the reviewer decides. The bundled demo audits a cabin-crew safety
briefing. The Meta-native pipeline pairs three models:

1. **Muse Voice Transcribe** turns spoken narration into a transcript excerpt.
2. **SAM 3.1** segments the evidence and grounds every finding to pixel
   regions with overlay boxes.
3. **Muse Spark 1.3** (`muse-spark-1.3` via Meta Model API) reasons over the
   SOP + pixels + grounding + transcript into a per-step audit, and answers
   follow-up questions per step.

The whole project is **zero dependencies**: a static HTML/CSS/vanilla-JS
frontend served by a plain-Node backend. No build step, no bundler, no
`npm install` required. Built with Muse Code.

## Prerequisites

- Node.js 20+ (for local runs)
- A Meta Model API key — `MODEL_API_KEY` from https://dev.meta.ai.
  Live audits need it everywhere, including Vercel — only *where* you
  set it changes.

## Where to set the API key

**Local:** copy the example file, paste your key, restart:

```bash
cp .env.example .env
# then set MODEL_API_KEY=paste_your_key_here inside .env
npm start
```

The server prints `key: configured` when it picked the key up, and the
app's header warning disappears.

**Vercel:** the backend runs as serverless functions (`api/*.js`, same
`/api/*` paths as local). In the Vercel dashboard go to Project →
Settings → Environment Variables, add `MODEL_API_KEY` for Production,
then **redeploy** (new vars only apply to new deployments). Verify with
`https://<your-app>.vercel.app/api/health` — it should return JSON with
`"ok":true`. Keep narration clips short: very large uploads can exceed
Vercel's request-size limit.

Without a key, the app still runs: tour the sample dashboard from the
landing page (**Dashboard** link) or `?preview=sample`, or queue an
inspection offline.

## Run

```bash
npm start     # app + API on http://localhost:3001
npm test      # 74 maintained checks, no runner to install
npm run build # deploy-time syntax check (used by Vercel)
```

Open http://localhost:3001/ in a browser.

## Usage

1. Land on the home page: what the app does, how an audit runs, and a
   playing sample audit. Click **Try the demo** to start.
2. On **New inspection**, click **Cabin Safety Briefing**
   to load the demo SOP (or paste your own / upload `.txt`, `.md`, `.pdf` —
   PDFs load their reader on demand, so the first PDF needs a connection).
3. Drop a photo or video as evidence (video → key frames are extracted in
   the browser) and optionally attach audio narration.
4. Click **Run inspection**: voice transcribes, SAM 3.1 grounds, Spark audits.
5. On the **dashboard**, check the outcome counts, walk the steps sidebar,
   toggle the tracked-component overlay, confirm/reject each assessment,
   ask follow-up questions, export the report (print view → save as PDF).
6. Run offline and the inspection is queued instead: a local pre-check plus
   "waiting for connection" list appear, with **Re-run after sync**.

## Offline mode

The app watches two signals — the browser's online state and
`GET /api/health` (polled every 15s). If either fails, it switches to
offline mode:

- Running an inspection **queues** a job entry (procedure name + planned
  stages) in `localStorage` instead of calling the API.
- A **local pre-check** lists SOP steps detected by a text-only heuristic
  (regex over numbered/bullet lines, up to 8) — no model runs offline, so
  AI verdicts, grounding, and Q&A stay "not assessed" until reconnection.
- Evidence and SOP text stay in the tab — re-attach evidence after a
  reload.
- **Re-run after sync** runs the queued inspection once reconnected and
  reports a sync summary; the queue entry clears on success.

Roadmap: replace the heuristic with on-device inference using Glimmer
weights, so the local pre-check becomes a real preliminary audit.

## Project layout

```
├── public/                 # static frontend (served by the server)
│   ├── index.html          # app shell
│   ├── styles.css          # light wine theme + print stylesheet
│   └── js/
│       ├── main.js         # events, file handling, boot
│       ├── views.js        # landing, inspection, dashboard, offline views
│       ├── store.js        # state, pipeline, reviews, Q&A, offline queue
│       ├── api.js          # /api/* client
│       ├── media.js        # frame extraction, WAV conversion, PDF text
│       └── demo-data.js    # briefing demo SOP + labeled sample preview
├── api/                    # Vercel serverless routes (same /api/* paths)
├── server/
│   ├── api-server.js       # static server + Meta API proxy (zero deps)
│   ├── meta-client.js      # Spark / SAM / Voice calls + parsers
│   ├── vercel-lib.js       # shared helpers for the api/* routes
│   ├── dotenv.js           # .env loader
│   └── __tests__/          # npm test (74 checks)
├── demo/                   # demo video script
├── .env.example            # copy to .env and add MODEL_API_KEY
└── package.json            # scripts only — zero dependencies
```
