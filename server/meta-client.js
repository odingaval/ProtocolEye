// Meta Model API client + pure helpers (no framework deps).
// Docs: https://dev.meta.ai/docs/ — Base URL https://api.meta.ai/v1,
// Bearer MODEL_API_KEY. Spark via Chat Completions, SAM 3.1 + Voice via their endpoints.
import { randomUUID } from 'node:crypto';

export const META_BASE_URL = process.env.META_BASE_URL || 'https://api.meta.ai/v1';
export const SPARK_MODEL = process.env.META_SPARK_MODEL || 'muse-spark-1.3';
export const SAM_MODEL = process.env.META_SAM_MODEL || 'sam-3.1';
export const VOICE_MODEL = process.env.META_VOICE_MODEL || 'muse-voice-transcribe-1.0';

export const STEP_STATUSES = ['supported', 'deviation', 'inconclusive', 'not-observed'];

export function getApiKey() {
  return (
    process.env.MODEL_API_KEY ||
    process.env.META_API_KEY ||
    process.env.API_KEY ||
    ''
  );
}

export const AUDIT_JSON_SCHEMA = {
  type: 'object',
  properties: {
    executiveSummary: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['Pass', 'Fail', 'Caution'] },
        summary: { type: 'string' },
      },
      required: ['status', 'summary'],
      additionalProperties: false,
    },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          index: { type: 'integer' },
          title: { type: 'string' },
          requirement: { type: 'string' },
          reference: { type: 'string' },
          status: { type: 'string', enum: STEP_STATUSES },
          assessment: { type: 'string' },
          observedIn: { type: 'array', items: { type: 'string' } },
          notEstablished: { type: 'string' },
        },
        required: ['index', 'title', 'requirement', 'status', 'assessment'],
        additionalProperties: false,
      },
    },
    reasoningTrace: { type: 'string' },
  },
  required: ['executiveSummary', 'steps'],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `You are the "ProtocolEye Multimodal Audit Agent" powered by Meta Muse Spark. You audit industrial safety procedures (factory floor, lab, field site) by comparing a Standard Operating Procedure against visual evidence frames and an optional audio transcript. Be professional, objective, and slightly skeptical.

You receive the evidence as an ordered frame list and the images follow the same order. First enumerate the SOP as discrete verifiable steps (at most 8; merge trivial sub-steps). Then assess EACH step against ALL frames with exactly one status:
- "supported": at least one frame clearly shows the step was followed, and no frame clearly shows it violated.
- "deviation": at least one frame clearly shows the step was NOT followed (even if another frame looks compliant — name both frames).
- "inconclusive": the frames covering this step are ambiguous, partial, or too low quality to judge.
- "not-observed": no frame covers this step at all.

Rules: base findings ONLY on the provided SOP, images, grounding, and transcript. Never hallucinate unseen details. The one-sentence "assessment" states why this status. "observedIn" lists the frame labels backing the verdict (empty array when not-observed). "notEstablished" names what the evidence cannot show for this step (empty string if fully established). Overall status: Fail if any deviation, Caution if any inconclusive/not-observed but no deviation, else Pass.`;

export function buildAuditMessages(sopText, imageBase64, mimeType, detections, audioTranscript, evidenceLabel) {
  const frames = Array.isArray(imageBase64)
    ? imageBase64.filter((f) => f && f.imageBase64)
    : [{ imageBase64, mimeType, label: evidenceLabel }];
  const grounding =
    detections && detections.length
      ? `\n\nVISUAL GROUNDING (SAM 3.1 detections, normalized 0-1000 boxes):\n${JSON.stringify(detections).slice(0, 4000)}\nUse these to reference WHERE each finding appears; still verify against the pixels.`
      : '';
  const audio = audioTranscript
    ? `\n\nAUDIO TRANSCRIPT (spoken during the procedure, may be partial):\n${String(audioTranscript).slice(0, 2000)}`
    : '';
  const frameList = frames.map((f, i) => `${i + 1}. ${f.label || `Frame ${i + 1}`}`).join('\n');
  const content = [
    {
      type: 'text',
      text: `SOP TEXT:\n---\n${sopText}\n---\n\nEVIDENCE FRAMES (images attached in this order):\n${frameList}${grounding}${audio}\n\nEnumerate the SOP steps and assess each against ALL attached frames. Return the audit report as JSON matching the schema.`,
    },
  ];
  for (const f of frames) {
    content.push({
      type: 'image_url',
      image_url: { url: `data:${f.mimeType || 'image/jpeg'};base64,${f.imageBase64}` },
    });
  }
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content },
  ];
}

export function extractJson(text) {
  if (!text) throw new Error('Empty model response');
  const raw = String(text).trim();
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(raw.slice(start, end + 1));
    throw new Error('Model response was not valid JSON');
  }
}

export function normalizeAudit(parsed) {
  const status = parsed?.executiveSummary?.status;
  if (!['Pass', 'Fail', 'Caution'].includes(status)) {
    throw new Error('Audit missing valid executiveSummary.status');
  }
  if (!Array.isArray(parsed?.steps) || !parsed.steps.length) {
    throw new Error('Audit missing steps array');
  }
  return {
    executiveSummary: {
      status,
      summary: String(parsed.executiveSummary.summary || ''),
    },
    steps: parsed.steps.map((s, i) => ({
      index: Number.isInteger(s?.index) ? s.index : i + 1,
      title: String(s?.title || `Step ${i + 1}`),
      requirement: String(s?.requirement || ''),
      reference: s?.reference ? String(s.reference) : undefined,
      status: STEP_STATUSES.includes(s?.status) ? s.status : 'inconclusive',
      assessment: String(s?.assessment || ''),
      observedIn: Array.isArray(s?.observedIn) ? s.observedIn.map((f) => String(f)) : undefined,
      notEstablished: s?.notEstablished ? String(s.notEstablished) : undefined,
    })),
    reasoningTrace: parsed?.reasoningTrace ? String(parsed.reasoningTrace) : undefined,
  };
}

export async function callSparkAudit({ sopText, imageBase64, mimeType, frames, detections, audioTranscript, evidenceLabel, fetchImpl = fetch }) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('MODEL_API_KEY is not set on the server');
  const provided = Array.isArray(frames) ? frames.filter((f) => f && f.imageBase64) : [];
  const auditFrames = provided.length ? provided : (imageBase64 ? [{ imageBase64, mimeType, label: evidenceLabel }] : []);
  if (!sopText || !auditFrames.length) throw new Error('sopText and imageBase64 are required');

  const res = await fetchImpl(`${META_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: SPARK_MODEL,
      messages: buildAuditMessages(sopText, auditFrames, null, detections, audioTranscript),
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'ProtocolEyeAudit', schema: AUDIT_JSON_SCHEMA },
      },
      temperature: 0.2,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Meta Model API error ${res.status}: ${body.slice(0, 500)}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  return normalizeAudit(extractJson(content));
}

// --- Per-step Q&A ("Ask about this step") ---

export function buildAskMessages({ question, step, sopText, audioTranscript, imageBase64, mimeType, frames }) {
  const context = [
    `SOP step ${step.index} — ${step.title}: ${step.requirement}`,
    `Current assessment (${step.status}): ${step.assessment}`,
    step.notEstablished ? `Not established: ${step.notEstablished}` : '',
    audioTranscript ? `Audio transcript excerpt: ${String(audioTranscript).slice(0, 1000)}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  const askFrames = Array.isArray(frames)
    ? frames.filter((f) => f && f.imageBase64)
    : (imageBase64 ? [{ imageBase64, mimeType }] : []);
  const frameNote = Array.isArray(frames) && askFrames.some((f) => f.label)
    ? `\nEvidence frames (images in this order): ${askFrames.map((f, i) => f.label || `Frame ${i + 1}`).join(', ')}`
    : '';
  const userContent = [
    { type: 'text', text: `Context:\n${context}${frameNote}\n\nSOP (may be truncated):\n${String(sopText).slice(0, 3000)}\n\nQuestion: ${question}\n\nAnswer in 2-3 sentences, grounded only in the evidence. If the evidence cannot answer it, say so.` },
  ];
  for (const f of askFrames) {
    userContent.push({
      type: 'image_url',
      image_url: { url: `data:${f.mimeType || 'image/jpeg'};base64,${f.imageBase64}` },
    });
  }
  return [
    { role: 'system', content: 'You are ProtocolEye, a precise industrial-safety audit assistant. Answer briefly and only from the provided evidence.' },
    { role: 'user', content: userContent },
  ];
}

/** Pull answer text from a chat-completion payload, tolerating shape variants. */
export function extractChatText(data) {
  const choice = data?.choices?.[0];
  const content = choice?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((b) => (typeof b?.text === 'string' ? b.text : '')).join('');
  }
  if (typeof choice?.text === 'string') return choice.text;
  if (typeof data?.output_text === 'string') return data.output_text;
  return '';
}

export async function callSparkAsk(args) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('MODEL_API_KEY is not set on the server');
  if (!args?.question || !args?.step) throw new Error('question and step are required');
  const res = await (args.fetchImpl || fetch)(`${META_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: SPARK_MODEL,
      messages: buildAskMessages(args),
      temperature: 0.3,
      // Generous: Spark reasons before answering and reasoning draws from this budget.
      max_tokens: 2000,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Meta Model API error ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  const text = extractChatText(data).trim();
  if (!text) {
    const choices = data?.choices;
    const reason = choices?.[0]?.finish_reason;
    const detail = !Array.isArray(choices) || !choices.length
      ? ' (no choices returned)'
      : reason ? ` (finish_reason: ${reason})` : '';
    throw new Error(`Empty answer from model${detail}`);
  }
  return text;
}

// --- Voice transcription (Muse Voice Transcribe, file endpoint) ---
// POST /v1/asr/transcribe?sessionId=<id>, multipart, WAV mono 16-bit 16/24kHz.

export function buildTranscribeForm(audioBuffer, fileName) {
  const form = new FormData();
  const blob = new Blob([audioBuffer], { type: 'audio/wav' });
  form.append('file', blob, fileName || 'clip.wav');
  return form;
}

export function extractTranscript(data) {
  if (!data) return '';
  if (typeof data === 'string') return data;
  return (
    data.transcript || data.text ||
    data.results?.[0]?.transcript || data.results?.[0]?.text || ''
  );
}

export async function callVoiceTranscribe({ audioBase64, fileName, fetchImpl = fetch }) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('MODEL_API_KEY is not set on the server');
  if (!audioBase64) throw new Error('audioBase64 is required');
  const audioBuffer = Buffer.from(audioBase64, 'base64');
  if (audioBuffer.length > 15 * 1024 * 1024) throw new Error('Audio clip too large (max ~15MB WAV)');
  const sessionId = randomUUID();
  const res = await fetchImpl(`${META_BASE_URL}/asr/transcribe?sessionId=${sessionId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: buildTranscribeForm(audioBuffer, fileName),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Transcription failed ${res.status}: ${body.slice(0, 300)}`);
  }
  const text = await res.text();
  let transcript = '';
  try {
    transcript = extractTranscript(JSON.parse(text));
  } catch {
    transcript = text.trim();
  }
  if (!transcript) throw new Error('Transcription returned no text');
  return { transcript, sessionId };
}

// --- SAM 3.1 ---
// Output line: <0f>0<|box;x1=..;y1=..;x2=..;y2=..;w=..;h=..|><|mask;...|>,1<|box;...|>...

const BOX_RE = /(\d+)<\|box;x1=(\d+);y1=(\d+);x2=(\d+);y2=(\d+);w=(\d+);h=(\d+)(?:;c=([\d.]+))?\|>/g;

export function parseSamBoxes(outputText) {
  const boxes = [];
  if (!outputText) return boxes;
  BOX_RE.lastIndex = 0;
  let m;
  while ((m = BOX_RE.exec(outputText)) !== null) {
    const [, id, x1, y1, x2, y2, w, h, c] = m;
    const W = Number(w);
    const H = Number(h);
    boxes.push({
      id: Number(id),
      x1: Number(x1),
      y1: Number(y1),
      x2: Number(x2),
      y2: Number(y2),
      w: W,
      h: H,
      // Normalized 0-1000 for UI overlay regardless of source resolution
      nx1: Math.round((Number(x1) / W) * 1000),
      ny1: Math.round((Number(y1) / H) * 1000),
      nx2: Math.round((Number(x2) / W) * 1000),
      ny2: Math.round((Number(y2) / H) * 1000),
      confidence: c !== undefined ? Number(c) : undefined,
    });
  }
  return boxes;
}

export function parseSseOutputText(sseBody) {
  let out = '';
  for (const line of String(sseBody).split('\n')) {
    const t = line.trim();
    if (!t.startsWith('data:')) continue;
    const data = t.slice(5).trim();
    if (!data || data === '[DONE]') continue;
    try {
      const ev = JSON.parse(data);
      if (ev.type === 'response.output_text.delta' && ev.delta) out += ev.delta;
      else if (typeof ev.output_text === 'string') out += ev.output_text;
    } catch {
      // ignore malformed SSE line
    }
  }
  return out;
}

export function extractResponsesText(data) {
  if (!data) return '';
  if (typeof data.output_text === 'string' && data.output_text) return data.output_text;
  const parts = [];
  const outputs = Array.isArray(data.output) ? data.output : [];
  for (const o of outputs) {
    const content = Array.isArray(o?.content) ? o.content : [];
    for (const c of content) {
      if (typeof c?.text === 'string') parts.push(c.text);
    }
  }
  return parts.join('');
}

export async function callSamSegment({ imageBase64, mimeType, prompt, fetchImpl = fetch }) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('MODEL_API_KEY is not set on the server');
  const imageUrl = `data:${mimeType || 'image/jpeg'};base64,${imageBase64}`;
  const res = await fetchImpl(`${META_BASE_URL}/responses`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({
      model: SAM_MODEL,
      input: [
        {
          type: 'message',
          role: 'user',
          content: [
            { type: 'input_text', text: prompt },
            { type: 'input_image', image_url: imageUrl },
          ],
        },
      ],
      stream: true,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`SAM request failed ${res.status}: ${body.slice(0, 500)}`);
  }
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('text/event-stream')) {
    const sse = await res.text();
    const outputText = parseSseOutputText(sse);
    return { boxes: parseSamBoxes(outputText), raw: outputText };
  }
  const data = await res.json();
  const outputText = extractResponsesText(data);
  return { boxes: parseSamBoxes(outputText), raw: outputText };
}

// --- Multi-prompt SAM orchestration (shared by api-server.js and api/segment.js) ---

export const DEFAULT_SAFETY_PROMPTS = [
  'hard hat',
  'safety vest',
  'safety glasses',
  'gloves',
  'pressure gauge',
  'valve handle',
  'warning sign',
];

export async function handleSegment(body) {
  const { imageBase64, mimeType, prompts } = body || {};
  if (!imageBase64) throw new Error('imageBase64 is required');
  const list = Array.isArray(prompts) && prompts.length ? prompts.slice(0, 8) : DEFAULT_SAFETY_PROMPTS.slice(0, 4);
  const detections = [];
  const errors = [];
  for (const prompt of list) {
    try {
      const { boxes } = await callSamSegment({
        imageBase64,
        mimeType: mimeType || 'image/jpeg',
        prompt: String(prompt),
      });
      if (boxes.length) detections.push({ label: String(prompt), boxes });
    } catch (e) {
      errors.push(`${prompt}: ${e.message}`);
    }
  }
  return { detections, promptsUsed: list, samErrors: errors, model: SAM_MODEL };
}
