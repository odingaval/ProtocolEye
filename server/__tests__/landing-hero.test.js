// Tests for the landing hero mini-audit (import-safe: no DOM touched at load).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  HERO_DEMO_STEPS, setHeroStep, initLandingHero, stopLandingHero,
} from '../../public/js/views.js';

describe('landing hero demo', () => {
  it('cycles through four briefing steps with valid geometry', () => {
    assert.equal(HERO_DEMO_STEPS.length, 4);
    const pct = (v) => Number(v.replace('%', ''));
    for (const s of HERO_DEMO_STEPS) {
      assert.ok(s.title.length > 0);
      assert.ok(['pill-green', 'pill-red', 'pill-yellow', 'pill-slate'].includes(s.pill));
      assert.match(s.time, /^\d\d:\d\d$/);
      for (const k of ['left', 'top', 'width', 'height']) {
        const v = pct(s.box[k]);
        assert.ok(v >= 0 && v <= 100, `${s.title} box.${k} out of range`);
      }
      assert.ok(pct(s.box.left) + pct(s.box.width) <= 100, `${s.title} box overflows horizontally`);
      assert.ok(pct(s.box.top) + pct(s.box.height) <= 100, `${s.title} box overflows vertically`);
    }
  });

  it('shows more than one outcome across the cycle', () => {
    const pills = new Set(HERO_DEMO_STEPS.map((s) => s.pill));
    assert.ok(pills.size >= 3);
  });

  it('exposes hero controls without touching the DOM at import', () => {
    assert.equal(typeof setHeroStep, 'function');
    assert.equal(typeof initLandingHero, 'function');
    assert.equal(typeof stopLandingHero, 'function');
  });
});
