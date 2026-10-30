// ProtocolEye server — static frontend + Meta API proxy (MODEL_API_KEY stays server-side).
// Zero dependencies: plain Node http + global fetch.
// Endpoints: GET /api/health, POST /api/audit, POST /api/segment, POST /api/ask, POST /api/transcribe
// Everything else serves public/ (single-page app with fallback to index.html).

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { URL } from 'node:url';
import { fileURLToPath } from 'node:url';
import { loadDotenv } from './dotenv.js';
import {
  SPARK_MODEL,
  SAM_MODEL,
  VOICE_MODEL,
  getApiKey,
  callSparkAudit,
  callSparkAsk,
  callVoiceTranscribe,
  handleSegment,
} from './meta-client.js';

loadDotenv();

const PORT = Number(process.env.PORT || 3001);
const MAX_BODY = 30 * 1024 * 1024; // 30MB for base64 images
const PUBLIC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function send(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error('Request body too large (max 30MB)'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function serveStatic(pathname, res) {
  try {
    let rel = decodeURIComponent(pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.normalize(path.join(PUBLIC_DIR, rel));
    if (!file.startsWith(PUBLIC_DIR)) {
      send(res, 403, { error: 'Forbidden' });
      return;
    }
    const target = fs.existsSync(file) && fs.statSync(file).isFile()
      ? file
      : path.join(PUBLIC_DIR, 'index.html');
    res.writeHead(200, { 'Content-Type': MIME[path.extname(target)] || 'application/octet-stream' });
    fs.createReadStream(target).pipe(res);
  } catch {
    send(res, 500, { error: 'Static serve failed' });
  }
}

export function createServer() {
  return http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      res.end();
      return;
    }
    try {
      const url = new URL(req.url || '/', 'http://localhost');
      if (req.method === 'GET' && url.pathname === '/api/health') {
        send(res, 200, {
          ok: true,
          provider: 'meta',
          sparkModel: SPARK_MODEL,
          samModel: SAM_MODEL,
          voiceModel: VOICE_MODEL,
          keyConfigured: Boolean(getApiKey()),
        });
        return;
      }
      if (req.method === 'POST' && url.pathname === '/api/segment') {
        const body = await readBody(req);
        const t0 = Date.now();
        const result = await handleSegment(body);
        send(res, 200, { ...result, latencyMs: Date.now() - t0 });
        return;
      }
      if (req.method === 'POST' && url.pathname === '/api/audit') {
        const body = await readBody(req);
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
        return;
      }
      if (req.method === 'POST' && url.pathname === '/api/ask') {
        const body = await readBody(req);
        const answer = await callSparkAsk({
          question: body?.question,
          step: body?.step,
          sopText: body?.sopText || '',
          audioTranscript: body?.audioTranscript,
          imageBase64: body?.imageBase64,
          mimeType: body?.mimeType || 'image/jpeg',
        });
        send(res, 200, { answer, model: SPARK_MODEL });
        return;
      }
      if (req.method === 'POST' && url.pathname === '/api/transcribe') {
        const body = await readBody(req);
        const t0 = Date.now();
        const result = await callVoiceTranscribe({
          audioBase64: body?.audioBase64,
          fileName: body?.fileName || 'clip.wav',
        });
        send(res, 200, { ...result, latencyMs: Date.now() - t0 });
        return;
      }
      if (req.method === 'GET' && !url.pathname.startsWith('/api/')) {
        serveStatic(url.pathname, res);
        return;
      }
      send(res, 404, { error: 'Not found' });
    } catch (e) {
      const msg = e?.message || 'Server error';
      const status = /not set|required|too large|Invalid JSON/i.test(msg) ? 400 : 502;
      send(res, status, { error: msg });
    }
  });
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop());
if (isMain || process.argv[1]?.endsWith('api-server.js')) {
  createServer().listen(PORT, () => {
    console.log(`ProtocolEye app + API on http://localhost:${PORT}`);
    console.log(`Spark: ${SPARK_MODEL} | SAM: ${SAM_MODEL} | key: ${getApiKey() ? 'configured' : 'MISSING (add MODEL_API_KEY to .env)'}`);
  });
}
