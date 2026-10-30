// POST /api/audit — audit SOP steps against visual evidence with Muse Spark.
import { SPARK_MODEL, callSparkAudit } from '../server/meta-client.js';
import { send, sendError, getBody, handleOptions, requireMethod } from '../server/vercel-lib.js';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (!requireMethod(req, res, 'POST')) return;
  try {
    const body = await getBody(req);
    const t0 = Date.now();
    const result = await callSparkAudit({
      sopText: body?.sopText,
      imageBase64: body?.imageBase64,
      mimeType: body?.mimeType || 'image/jpeg',
      detections: body?.detections,
      audioTranscript: body?.audioTranscript,
      evidenceLabel: body?.evidenceLabel,
    });
    send(res, 200, { ...result, meta: { model: SPARK_MODEL, latencyMs: Date.now() - t0 } });
  } catch (e) {
    sendError(res, e);
  }
}
