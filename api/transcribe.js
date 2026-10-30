// POST /api/transcribe — transcribe a WAV narration clip with Muse Voice.
import { callVoiceTranscribe } from '../server/meta-client.js';
import { send, sendError, getBody, handleOptions, requireMethod } from '../server/vercel-lib.js';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (!requireMethod(req, res, 'POST')) return;
  try {
    const body = await getBody(req);
    const t0 = Date.now();
    const result = await callVoiceTranscribe({
      audioBase64: body?.audioBase64,
      fileName: body?.fileName || 'clip.wav',
    });
    send(res, 200, { ...result, latencyMs: Date.now() - t0 });
  } catch (e) {
    sendError(res, e);
  }
}
