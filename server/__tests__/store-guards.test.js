// Guards against running an audit with no uploadable evidence (e.g. the
// display-only sample frame carried from the sample preview). No network.
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  state, canRun, runInspection, reAuditActiveFrame, startNew,
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
