// Tests for the Vercel serverless routes (api/*.js) with mocked req/res — no network.
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import health from '../../api/health.js';
import segment from '../../api/segment.js';
import audit from '../../api/audit.js';
import ask from '../../api/ask.js';
import transcribe from '../../api/transcribe.js';
import { getBody } from '../vercel-lib.js';

function mockReq({ method = 'GET', body } = {}) {
  return { method, body, headers: {} };
}

function mockRes() {
  const headers = {};
  const res = {
    statusCode: null,
    headers,
    bodyText: '',
    setHeader(k, v) { headers[String(k).toLowerCase()] = v; },
    writeHead(status, extra) {
      res.statusCode = status;
      for (const [k, v] of Object.entries(extra || {})) headers[String(k).toLowerCase()] = v;
    },
    end(chunk) { if (chunk) res.bodyText += chunk; },
  };
  return res;
}

const json = (res) => JSON.parse(res.bodyText);

const KEY_VARS = ['MODEL_API_KEY', 'META_API_KEY', 'API_KEY'];
let savedKeys;
beforeEach(() => {
  savedKeys = Object.fromEntries(KEY_VARS.map((k) => [k, process.env[k]]));
  for (const k of KEY_VARS) delete process.env[k];
});
afterEach(() => {
  for (const k of KEY_VARS) {
    if (savedKeys[k] === undefined) delete process.env[k];
    else process.env[k] = savedKeys[k];
  }
});

describe('api/health', () => {
  it('returns ok:true with keyConfigured=false when no key is set', async () => {
    const res = mockRes();
    await health(mockReq({ method: 'GET' }), res);
    assert.equal(res.statusCode, 200);
    const data = json(res);
    assert.equal(data.ok, true);
    assert.equal(data.provider, 'meta');
    assert.equal(data.keyConfigured, false);
    assert.ok(data.sparkModel);
  });

  it('reports keyConfigured=true when MODEL_API_KEY is set', async () => {
    process.env.MODEL_API_KEY = 'test-key';
    const res = mockRes();
    await health(mockReq({ method: 'GET' }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(json(res).keyConfigured, true);
  });

  it('rejects POST with 405', async () => {
    const res = mockRes();
    await health(mockReq({ method: 'POST', body: {} }), res);
    assert.equal(res.statusCode, 405);
  });

  it('answers OPTIONS preflight with 204 + CORS headers', async () => {
    const res = mockRes();
    await health(mockReq({ method: 'OPTIONS' }), res);
    assert.equal(res.statusCode, 204);
    assert.equal(res.headers['access-control-allow-origin'], '*');
  });
});

describe('api/audit', () => {
  it('rejects GET with 405', async () => {
    const res = mockRes();
    await audit(mockReq({ method: 'GET' }), res);
    assert.equal(res.statusCode, 405);
  });

  it('returns 400 naming the key when no key is set', async () => {
    const res = mockRes();
    await audit(mockReq({ method: 'POST', body: { sopText: 'SOP', imageBase64: 'AAA' } }), res);
    assert.equal(res.statusCode, 400);
    assert.match(json(res).error, /MODEL_API_KEY/);
  });

  it('returns 400 when required fields are missing', async () => {
    process.env.MODEL_API_KEY = 'test-key';
    const res = mockRes();
    await audit(mockReq({ method: 'POST', body: {} }), res);
    assert.equal(res.statusCode, 400);
    assert.match(json(res).error, /required/);
  });

  it('returns 400 on an unparseable string body', async () => {
    process.env.MODEL_API_KEY = 'test-key';
    const res = mockRes();
    await audit(mockReq({ method: 'POST', body: '{not-json' }), res);
    assert.equal(res.statusCode, 400);
    assert.match(json(res).error, /Invalid JSON/);
  });
});

describe('api/segment', () => {
  it('rejects GET with 405', async () => {
    const res = mockRes();
    await segment(mockReq({ method: 'GET' }), res);
    assert.equal(res.statusCode, 405);
  });

  it('returns 400 when imageBase64 is missing', async () => {
    process.env.MODEL_API_KEY = 'test-key';
    const res = mockRes();
    await segment(mockReq({ method: 'POST', body: {} }), res);
    assert.equal(res.statusCode, 400);
    assert.match(json(res).error, /imageBase64 is required/);
  });
});

describe('api/ask', () => {
  it('rejects GET with 405', async () => {
    const res = mockRes();
    await ask(mockReq({ method: 'GET' }), res);
    assert.equal(res.statusCode, 405);
  });

  it('returns 400 naming the key when no key is set', async () => {
    const res = mockRes();
    await ask(mockReq({ method: 'POST', body: { question: 'Q', step: { index: 1 } } }), res);
    assert.equal(res.statusCode, 400);
    assert.match(json(res).error, /MODEL_API_KEY/);
  });

  it('returns 400 when question/step are missing', async () => {
    process.env.MODEL_API_KEY = 'test-key';
    const res = mockRes();
    await ask(mockReq({ method: 'POST', body: {} }), res);
    assert.equal(res.statusCode, 400);
    assert.match(json(res).error, /required/);
  });
});

describe('api/transcribe', () => {
  it('rejects GET with 405', async () => {
    const res = mockRes();
    await transcribe(mockReq({ method: 'GET' }), res);
    assert.equal(res.statusCode, 405);
  });

  it('returns 400 naming the key when no key is set', async () => {
    const res = mockRes();
    await transcribe(mockReq({ method: 'POST', body: { audioBase64: 'AAA' } }), res);
    assert.equal(res.statusCode, 400);
    assert.match(json(res).error, /MODEL_API_KEY/);
  });

  it('returns 400 when audioBase64 is missing', async () => {
    process.env.MODEL_API_KEY = 'test-key';
    const res = mockRes();
    await transcribe(mockReq({ method: 'POST', body: {} }), res);
    assert.equal(res.statusCode, 400);
    assert.match(json(res).error, /audioBase64 is required/);
  });
});

describe('getBody stream fallback', () => {
  it('reads an unparsed request stream', async () => {
    const req = {
      method: 'POST',
      body: undefined,
      async *[Symbol.asyncIterator]() {
        yield Buffer.from(JSON.stringify({ hello: 'world' }));
      },
    };
    assert.deepEqual(await getBody(req), { hello: 'world' });
  });

  it('returns {} for an empty stream', async () => {
    const req = {
      method: 'POST',
      body: undefined,
      async *[Symbol.asyncIterator]() {},
    };
    assert.deepEqual(await getBody(req), {});
  });
});
