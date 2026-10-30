// GET /api/health — liveness + model/key configuration (no Model API call).
import { SPARK_MODEL, SAM_MODEL, VOICE_MODEL, getApiKey } from '../server/meta-client.js';
import { send, handleOptions, requireMethod } from '../server/vercel-lib.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (!requireMethod(req, res, 'GET')) return;
  send(res, 200, {
    ok: true,
    provider: 'meta',
    sparkModel: SPARK_MODEL,
    samModel: SAM_MODEL,
    voiceModel: VOICE_MODEL,
    keyConfigured: Boolean(getApiKey()),
  });
}
