// Thin client for the ProtocolEye API proxy (same origin, /api/*).
async function post(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export async function checkHealth() {
  const res = await fetch('/api/health');
  if (!res.ok) throw new Error(`Health check failed (${res.status})`);
  return res.json();
}

export async function segmentEvidence(imageBase64, mimeType, prompts) {
  const res = await post('/api/segment', { imageBase64, mimeType, prompts });
  return res.detections || [];
}

export async function auditProcedure({ imageBase64, sopText, mimeType, detections, audioTranscript, evidenceLabel }) {
  const result = await post('/api/audit', {
    sopText, imageBase64, mimeType: mimeType || 'image/jpeg',
    detections, audioTranscript: audioTranscript || undefined, evidenceLabel,
  });
  if (!result?.executiveSummary?.status || !Array.isArray(result.steps)) {
    throw new Error('Invalid audit response from server');
  }
  return result;
}

export async function askAboutStep({ question, step, sopText, imageBase64, audioTranscript }) {
  const res = await post('/api/ask', {
    question, step, sopText,
    imageBase64, audioTranscript: audioTranscript || undefined,
  });
  return res.answer;
}

export async function transcribeAudio(audioBase64, fileName) {
  const res = await post('/api/transcribe', { audioBase64, fileName });
  return res.transcript;
}
