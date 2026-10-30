// POST /api/ask — answer a follow-up question about one audit step.
import { SPARK_MODEL, callSparkAsk } from '../server/meta-client.js';
import { send, sendError, getBody, handleOptions, requireMethod } from '../server/vercel-lib.js';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (!requireMethod(req, res, 'POST')) return;
  try {
    const body = await getBody(req);
    const answer = await callSparkAsk({
      question: body?.question,
      step: body?.step,
      sopText: body?.sopText || '',
      audioTranscript: body?.audioTranscript,
      imageBase64: body?.imageBase64,
      mimeType: body?.mimeType || 'image/jpeg',
    });
    send(res, 200, { answer, model: SPARK_MODEL });
  } catch (e) {
    sendError(res, e);
  }
}
