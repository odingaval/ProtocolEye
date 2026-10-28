// Maintained tests for the Meta Model API layer (Node built-in runner).
// Run: npm test  →  node --test server/__tests__/meta-client.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  AUDIT_JSON_SCHEMA,
  STEP_STATUSES,
  buildAskMessages,
  buildAuditMessages,
  buildTranscribeForm,
  callSamSegment,
  callSparkAsk,
  callSparkAudit,
  callVoiceTranscribe,
  extractJson,
  extractResponsesText,
  extractTranscript,
  normalizeAudit,
  parseSamBoxes,
  parseSseOutputText,
} from '../meta-client.js';

describe('parseSamBoxes', () => {
  it('parses the documented SAM 3.1 line format with normalized coords', () => {
    const line =
      '<0f>0<|box;x1=211;y1=228;x2=270;y2=254;w=320;h=334|>' +
      '<|mask;x=0;y=0;data=27,60,~abc|>,' +
      '1<|box;x1=155;y1=228;x2=202;y2=254;w=320;h=334|><|mask;x=0;y=0;data=27,48,~def|>';
    const boxes = parseSamBoxes(line);
    assert.equal(boxes.length, 2);
    assert.deepEqual(
      { x1: boxes[0].x1, y1: boxes[0].y1, x2: boxes[0].x2, y2: boxes[0].y2 },
      { x1: 211, y1: 228, x2: 270, y2: 254 }
    );
    assert.equal(boxes[0].nx1, Math.round((211 / 320) * 1000));
    assert.equal(boxes[0].ny2, Math.round((254 / 334) * 1000));
    assert.equal(boxes[1].id, 1);
  });

  it('returns [] for empty output (zero matches is valid)', () => {
    assert.deepEqual(parseSamBoxes(''), []);
    assert.deepEqual(parseSamBoxes(null), []);
  });

  it('captures confidence when present', () => {
    const boxes = parseSamBoxes(
      '<0f>0<|box;x1=1;y1=2;x2=3;y2=4;w=10;h=10;c=0.87|><|mask;x=0;y=0;data=1,1,~x|>'
    );
    assert.equal(boxes.length, 1);
    assert.equal(boxes[0].confidence, 0.87);
  });
});

describe('parseSseOutputText', () => {
  it('accumulates output_text deltas and stops at [DONE]', () => {
    const sse = [
      'data: {"type":"response.output_text.delta","delta":"<0f>0<|box;"}',
      'data: {"type":"response.output_text.delta","delta":"x1=1|>"}',
      'data: [DONE]',
    ].join('\n');
    assert.equal(parseSseOutputText(sse), '<0f>0<|box;x1=1|>');
  });

  it('ignores malformed lines', () => {
    assert.equal(parseSseOutputText('not sse\ndata: {{{'), '');
  });
});

describe('extractResponsesText', () => {
  it('reads non-streaming output lanes', () => {
    const data = {
      output: [{ content: [{ text: 'a' }, { text: 'b' }] }],
    };
    assert.equal(extractResponsesText(data), 'ab');
  });
});

describe('extractJson', () => {
  it('parses raw JSON', () => {
    assert.deepEqual(extractJson('{"a":1}'), { a: 1 });
  });

  it('extracts JSON wrapped in prose', () => {
    assert.deepEqual(extractJson('Here you go:\n{"a":1}\nDone.'), { a: 1 });
  });

  it('throws on empty or non-JSON', () => {
    assert.throws(() => extractJson(''), /Empty/);
    assert.throws(() => extractJson('no json here'), /not valid JSON/);
  });
});

describe('normalizeAudit (per-step schema)', () => {
  const valid = {
    executiveSummary: { status: 'Fail', summary: 'A lock is missing.' },
    steps: [
      {
        index: 1,
        title: 'De-energize',
        requirement: 'Open the main disconnect.',
        reference: 'Sec 3.2',
        status: 'supported',
        assessment: 'The disconnect is visibly open.',
      },
      {
        index: 2,
        title: 'Apply lock',
        requirement: 'Apply a personal red lock.',
        status: 'deviation',
        assessment: 'No lock is visible on the handle.',
        notEstablished: 'Whether a lock was applied off-camera.',
      },
    ],
    reasoningTrace: 'Compared each SOP step to the frame.',
  };

  it('passes through a valid per-step audit', () => {
    const out = normalizeAudit(valid);
    assert.equal(out.executiveSummary.status, 'Fail');
    assert.equal(out.steps.length, 2);
    assert.equal(out.steps[1].status, 'deviation');
    assert.equal(out.steps[1].notEstablished, 'Whether a lock was applied off-camera.');
  });

  it('rejects an invalid verdict status', () => {
    assert.throws(
      () => normalizeAudit({ ...valid, executiveSummary: { status: 'Maybe', summary: '' } }),
      /valid executiveSummary.status/
    );
  });

  it('rejects a missing steps array', () => {
    assert.throws(() => normalizeAudit({ executiveSummary: valid.executiveSummary }), /steps/);
  });

  it('coerces unknown step statuses to inconclusive', () => {
    const out = normalizeAudit({
      ...valid,
      steps: [{ ...valid.steps[0], status: 'bogus' }],
    });
    assert.equal(out.steps[0].status, 'inconclusive');
  });

  it('keeps the schema enums in sync with the UI contract', () => {
    assert.deepEqual(AUDIT_JSON_SCHEMA.properties.executiveSummary.properties.status.enum, [
      'Pass',
      'Fail',
      'Caution',
    ]);
    assert.deepEqual(STEP_STATUSES, ['supported', 'deviation', 'inconclusive', 'not-observed']);
    assert.deepEqual(
      AUDIT_JSON_SCHEMA.properties.steps.items.properties.status.enum,
      STEP_STATUSES
    );
  });
});

describe('buildAuditMessages', () => {
  it('sends SOP text plus a data-URL image', () => {
    const msgs = buildAuditMessages('SOP here', 'AAA', 'image/png');
    assert.equal(msgs[0].role, 'system');
    const user = msgs[1];
    assert.equal(user.role, 'user');
    assert.ok(user.content[0].text.includes('SOP here'));
    assert.equal(user.content[1].image_url.url, 'data:image/png;base64,AAA');
  });

  it('embeds SAM grounding, transcript, and evidence label', () => {
    const msgs = buildAuditMessages('SOP', 'AAA', 'image/jpeg', [{ label: 'hard hat', boxes: [] }], 'locking now', 'Video frame · 00:00:12');
    const text = msgs[1].content[0].text;
    assert.ok(text.includes('hard hat'));
    assert.ok(text.includes('locking now'));
    assert.ok(text.includes('00:00:12'));
  });
});

describe('buildAskMessages', () => {
  const step = { index: 2, title: 'Apply lock', requirement: 'Apply a personal red lock.', status: 'deviation', assessment: 'No lock visible.' };

  it('grounds the question in step context plus image', () => {
    const msgs = buildAskMessages({ question: 'Where is the lock?', step, sopText: 'SOP', imageBase64: 'AAA' });
    assert.equal(msgs[0].role, 'system');
    assert.ok(msgs[1].content[0].text.includes('Where is the lock?'));
    assert.ok(msgs[1].content[0].text.includes('Apply a personal red lock.'));
    assert.equal(msgs[1].content.length, 2);
  });

  it('works without an image', () => {
    const msgs = buildAskMessages({ question: 'Why?', step, sopText: 'SOP' });
    assert.equal(msgs[1].content.length, 1);
  });
});

describe('transcribe helpers', () => {
  it('builds a multipart form with a WAV blob', () => {
    const form = buildTranscribeForm(Buffer.from([1, 2, 3]), 'clip.wav');
    assert.ok(form instanceof FormData);
    const file = form.get('file');
    assert.equal(file.type, 'audio/wav');
    assert.equal(file.name, 'clip.wav');
  });

  it('extracts transcripts from response shapes', () => {
    assert.equal(extractTranscript({ transcript: 'hi' }), 'hi');
    assert.equal(extractTranscript({ text: 'hi' }), 'hi');
    assert.equal(extractTranscript({ results: [{ transcript: 'hi' }] }), 'hi');
    assert.equal(extractTranscript(null), '');
  });
});

describe('callSparkAudit (mocked fetch)', () => {
  const OLD = process.env.MODEL_API_KEY;

  it('posts to Meta chat completions and normalizes', async () => {
    process.env.MODEL_API_KEY = 'test-key';
    let seenUrl = '';
    let seenBody;
    const fetchImpl = async (url, opts) => {
      seenUrl = url;
      seenBody = JSON.parse(opts.body);
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  executiveSummary: { status: 'Pass', summary: 'All good.' },
                  steps: [
                    { index: 1, title: 'Lock', requirement: 'Apply lock.', status: 'supported', assessment: 'Lock visible.' },
                  ],
                }),
              },
            },
          ],
        }),
      };
    };
    const out = await callSparkAudit({
      sopText: 'SOP',
      imageBase64: 'AAA',
      mimeType: 'image/jpeg',
      fetchImpl,
    });
    assert.ok(seenUrl.endsWith('/chat/completions'));
    assert.equal(seenBody.model, 'muse-spark-1.3');
    assert.equal(seenBody.response_format.type, 'json_schema');
    assert.equal(out.executiveSummary.status, 'Pass');
    assert.equal(out.steps.length, 1);
    process.env.MODEL_API_KEY = OLD;
  });

  it('throws without an API key', async () => {
    delete process.env.MODEL_API_KEY;
    delete process.env.META_API_KEY;
    delete process.env.API_KEY;
    await assert.rejects(
      () => callSparkAudit({ sopText: 'x', imageBase64: 'y', fetchImpl: async () => ({}) }),
      /MODEL_API_KEY/
    );
    process.env.MODEL_API_KEY = OLD;
  });
});

describe('callSparkAsk (mocked fetch)', () => {
  it('returns the trimmed answer', async () => {
    process.env.MODEL_API_KEY = 'test-key';
    const fetchImpl = async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '  Because the handle is bare. ' } }] }),
    });
    const answer = await callSparkAsk({
      question: 'Why deviation?',
      step: { index: 1, title: 't', requirement: 'r', status: 'deviation', assessment: 'a' },
      sopText: 'SOP',
      fetchImpl,
    });
    assert.equal(answer, 'Because the handle is bare.');
  });
});

describe('callVoiceTranscribe (mocked fetch)', () => {
  it('posts multipart audio and returns the transcript', async () => {
    process.env.MODEL_API_KEY = 'test-key';
    let seenUrl = '';
    const fetchImpl = async (url, opts) => {
      seenUrl = url;
      assert.ok(opts.body instanceof FormData);
      return { ok: true, text: async () => JSON.stringify({ transcript: 'locking the panel now' }) };
    };
    const { transcript } = await callVoiceTranscribe({
      audioBase64: Buffer.from([1, 2, 3]).toString('base64'),
      fileName: 'clip.wav',
      fetchImpl,
    });
    assert.ok(seenUrl.includes('/asr/transcribe?sessionId='));
    assert.equal(transcript, 'locking the panel now');
  });

  it('rejects oversized clips', async () => {
    process.env.MODEL_API_KEY = 'test-key';
    const big = Buffer.alloc(16 * 1024 * 1024).toString('base64');
    await assert.rejects(
      () => callVoiceTranscribe({ audioBase64: big, fetchImpl: async () => ({}) }),
      /too large/
    );
  });
});

describe('callSamSegment (mocked fetch)', () => {
  it('parses streamed SSE boxes', async () => {
    process.env.MODEL_API_KEY = 'test-key';
    const sse =
      'data: {"type":"response.output_text.delta","delta":"<0f>0<|box;x1=10;y1=10;x2=20;y2=20;w=100;h=100|><|mask;x=0;y=0;data=1,1,~x|>"}\n' +
      'data: [DONE]\n';
    const fetchImpl = async () => ({
      ok: true,
      headers: { get: () => 'text/event-stream' },
      text: async () => sse,
    });
    const { boxes } = await callSamSegment({
      imageBase64: 'AAA',
      mimeType: 'image/jpeg',
      prompt: 'hard hat',
      fetchImpl,
    });
    assert.equal(boxes.length, 1);
    assert.equal(boxes[0].nx2, 200);
  });
});
