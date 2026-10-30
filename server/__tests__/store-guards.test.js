// Guards against running an audit with no uploadable evidence (e.g. the
// display-only sample frame carried from the sample preview). No network.
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  state, canRun, runInspection, reAuditActiveFrame, startNew,
  setExplicitAudio, applyVideoAudio, dropVideoAudio,
} from '../../public/js/store.js';

let stateSnap;
let fetchCalls;
const realFetch = globalThis.fetch;

beforeEach(() => {
  stateSnap = structuredClone(state);
  fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls++;
    throw new Error('fetch must not be called');
  };
  state.backendOk = true;
  state.browserOnline = true;
  state.isRunning = false;
});

afterEach(() => {
  Object.assign(state, stateSnap);
  globalThis.fetch = realFetch;
});

describe('canRun', () => {
  it('is false when the active frame has no uploadable pixels', () => {
    state.sopText = 'SOP text';
    state.frames = [{ dataUrl: 'data:image/jpeg;base64,', base64: '', label: 'Sample frame' }];
    state.activeFrameIndex = 0;
    assert.equal(canRun(), false);
  });

  it('is true with SOP text and a real frame', () => {
    state.sopText = 'SOP text';
    state.frames = [{ dataUrl: 'data:image/jpeg;base64,AAA', base64: 'AAA', label: 'Photo' }];
    state.activeFrameIndex = 0;
    assert.equal(canRun(), true);
  });
});

describe('startNew', () => {
  it('clears sample-preview carryover so a fresh inspection starts empty', () => {
    state.isSamplePreview = true;
    state.sopText = 'sample SOP';
    state.sopFileName = 'sample.txt';
    state.frames = [{ base64: '' }];
    state.procedureName = 'Cabin Safety Briefing (sample)';
    state.audioWavBase64 = 'AAA';
    state.audioFileName = 'clip.wav';
    state.transcript = 'hello';
    startNew();
    assert.equal(state.isSamplePreview, false);
    assert.equal(state.view, 'new');
    assert.equal(state.sopText, '');
    assert.equal(state.sopFileName, null);
    assert.deepEqual(state.frames, []);
    assert.equal(state.procedureName, 'Untitled procedure');
    assert.equal(state.audioWavBase64, null);
    assert.equal(state.audioFileName, null);
    assert.equal(state.transcript, null);
  });

  it('preserves real inputs when not coming from a sample preview', () => {
    state.isSamplePreview = false;
    state.sopText = 'my SOP';
    state.frames = [{ base64: 'AAA' }];
    startNew();
    assert.equal(state.sopText, 'my SOP');
    assert.equal(state.frames.length, 1);
  });
});

describe('runInspection evidence guard', () => {
  it('sets a friendly error and skips the API when evidence is empty', async () => {
    state.sopText = 'SOP text';
    state.frames = [{ base64: '' }];
    state.activeFrameIndex = 0;
    await runInspection();
    assert.equal(fetchCalls, 0);
    assert.match(state.error, /Attach a photo or video/);
    assert.equal(state.isRunning, false);
  });

  it('sets a friendly error and skips the API when SOP text is missing', async () => {
    state.sopText = '   ';
    state.frames = [{ base64: 'AAA' }];
    state.activeFrameIndex = 0;
    await runInspection();
    assert.equal(fetchCalls, 0);
    assert.match(state.error, /SOP text/);
  });
});

describe('reAuditActiveFrame evidence guard', () => {
  it('sets a friendly error and skips the API when evidence is empty', async () => {
    state.sopText = 'SOP text';
    state.frames = [{ base64: '' }];
    state.activeFrameIndex = 0;
    await reAuditActiveFrame();
    assert.equal(fetchCalls, 0);
    assert.match(state.error, /Attach a photo or video/);
    assert.equal(state.isRunning, false);
  });
});

describe('runInspection multi-frame wiring', () => {
  it('posts every frame with labels in one audit call', async () => {
    state.sopText = 'SOP text';
    state.frames = [
      { dataUrl: 'x', base64: 'AAA', label: 'Video frame · 00:00:05' },
      { dataUrl: 'y', base64: 'BBB', label: 'Video frame · 00:00:10' },
    ];
    state.activeFrameIndex = 0;
    state.useSam = false;
    state.useVoice = false;
    let seenBody;
    globalThis.fetch = async (url, opts) => {
      assert.ok(String(url).endsWith('/api/audit'));
      seenBody = JSON.parse(opts.body);
      return {
        ok: true,
        json: async () => ({
          executiveSummary: { status: 'Pass', summary: 'All seen.' },
          steps: [{ index: 1, title: 'Belt', requirement: 'Demo the belt.', status: 'supported', assessment: 'Visible.', observedIn: ['Video frame · 00:00:05'] }],
        }),
      };
    };
    await runInspection();
    assert.equal(seenBody.frames.length, 2);
    assert.equal(seenBody.frames[0].imageBase64, 'AAA');
    assert.equal(seenBody.frames[1].label, 'Video frame · 00:00:10');
    assert.equal(state.view, 'dashboard');
    assert.deepEqual(state.auditResult.steps[0].observedIn, ['Video frame · 00:00:05']);
  });
});

describe('video soundtrack audio', () => {
  it('setExplicitAudio marks audio as user-attached', () => {
    state.videoAudioNote = 'old note';
    setExplicitAudio({ base64: 'AAA', fileName: 'clip.wav' });
    assert.equal(state.audioWavBase64, 'AAA');
    assert.equal(state.audioFileName, 'clip.wav');
    assert.equal(state.audioFromVideo, false);
    assert.equal(state.videoAudioNote, null);
  });

  it('applyVideoAudio stores the soundtrack as from-video', () => {
    applyVideoAudio({ base64: 'BBB', fileName: 'demo.wav' });
    assert.equal(state.audioWavBase64, 'BBB');
    assert.equal(state.audioFromVideo, true);
    assert.equal(state.videoAudioNote, null);
  });

  it('applyVideoAudio(null) notes the absence but preserves an explicit upload', () => {
    applyVideoAudio(null);
    assert.equal(state.audioWavBase64, null);
    assert.match(state.videoAudioNote, /pictures only/);
    setExplicitAudio({ base64: 'AAA', fileName: 'clip.wav' });
    applyVideoAudio(null);
    assert.equal(state.audioWavBase64, 'AAA');
    assert.equal(state.videoAudioNote, null);
  });

  it('dropVideoAudio removes auto audio but keeps explicit uploads', () => {
    applyVideoAudio({ base64: 'BBB', fileName: 'demo.wav' });
    dropVideoAudio();
    assert.equal(state.audioWavBase64, null);
    assert.equal(state.audioFromVideo, false);
    setExplicitAudio({ base64: 'AAA', fileName: 'clip.wav' });
    dropVideoAudio();
    assert.equal(state.audioWavBase64, 'AAA');
  });
});
