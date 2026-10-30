// Shared helpers for the Vercel serverless routes in api/*.js (zero deps, plain Node).
// Same response shapes and error mapping as server/api-server.js.

export function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export function send(res, status, obj) {
  const body = JSON.stringify(obj);
  setCors(res);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

export function errorStatus(msg) {
  return /not set|required|too large|Invalid JSON/i.test(String(msg || '')) ? 400 : 502;
}

export function sendError(res, e) {
  const msg = e?.message || 'Server error';
  send(res, errorStatus(msg), { error: msg });
}

/** Vercel pre-parses JSON bodies into req.body; fall back to reading the stream. */
export async function getBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try {
      return req.body ? JSON.parse(req.body) : {};
    } catch {
      throw new Error('Invalid JSON body');
    }
  }
  const chunks = [];
  for await (const c of req) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new Error('Invalid JSON body');
  }
}

/** Answers CORS preflights. Returns true when the request is now handled. */
export function handleOptions(req, res) {
  if (req.method === 'OPTIONS') {
    setCors(res);
    res.writeHead(204);
    res.end();
    return true;
  }
  return false;
}

/** Sends 405 and returns false unless the request uses the expected method. */
export function requireMethod(req, res, method) {
  if (req.method !== method) {
    send(res, 405, { error: `Method not allowed (use ${method})` });
    return false;
  }
  return true;
}
