// Tests for the single built-in demo (cabin safety briefing) + sample preview data.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEMO_SAMPLES, STEP_META, SAMPLE_AUDIT, SAMPLE_DETECTIONS,
} from '../../public/js/demo-data.js';

describe('demo samples', () => {
  it('ships exactly one demo SOP: the cabin safety briefing', () => {
    assert.deepEqual(DEMO_SAMPLES.map((s) => s.id), ['briefing']);
    const [sop] = DEMO_SAMPLES;
    assert.equal(sop.title, 'Cabin Safety Briefing');
    assert.equal((sop.sopText.match(/^\d\./gm) || []).length, 7);
  });

  it('sample preview audit matches the briefing SOP', () => {
    const titles = SAMPLE_AUDIT.steps.map((s) => s.title).join(' ').toLowerCase();
    for (const topic of ['seatbelt', 'exits', 'oxygen', 'life vest']) {
      assert.ok(titles.includes(topic), `missing sample step about ${topic}`);
    }
    const statuses = new Set(SAMPLE_AUDIT.steps.map((s) => s.status));
    for (const want of ['supported', 'deviation', 'inconclusive']) {
      assert.ok(statuses.has(want), `sample audit never shows ${want}`);
    }
    for (const det of SAMPLE_DETECTIONS) {
      assert.match(det.label, /seatbelt|oxygen|vest|mask|exit/i);
    }
  });

  it('step status metadata covers the four honest outcomes', () => {
    assert.deepEqual(
      Object.keys(STEP_META).sort(),
      ['deviation', 'inconclusive', 'not-observed', 'supported'],
    );
  });
});
