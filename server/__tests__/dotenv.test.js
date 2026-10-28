// Tests for the zero-dep .env loader.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseDotenv, loadDotenv } from '../dotenv.js';

describe('parseDotenv', () => {
  it('parses keys, strips quotes, skips comments and blanks', () => {
    const out = parseDotenv([
      '# comment',
      '',
      'MODEL_API_KEY=abc123',
      "QUOTED='hello world'",
      'DQUOTED="hi"',
      'SPACED = spaced-value ',
      'not-a-var',
    ].join('\n'));
    assert.deepEqual(out, {
      MODEL_API_KEY: 'abc123',
      QUOTED: 'hello world',
      DQUOTED: 'hi',
      SPACED: 'spaced-value',
    });
  });

  it('rejects invalid key names', () => {
    assert.deepEqual(parseDotenv('9BAD=x\nOK_KEY=y'), { OK_KEY: 'y' });
  });
});

describe('loadDotenv', () => {
  it('fills only missing variables from a file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pe-env-'));
    const file = join(dir, '.env');
    writeFileSync(file, 'PE_TEST_NEW_KEY=from-file\nPE_TEST_EXISTING=from-file\n');
    process.env.PE_TEST_EXISTING = 'from-env';
    const res = loadDotenv(file);
    assert.equal(res.loaded, true);
    assert.equal(process.env.PE_TEST_NEW_KEY, 'from-file');
    assert.equal(process.env.PE_TEST_EXISTING, 'from-env'); // environment wins
    delete process.env.PE_TEST_NEW_KEY;
    delete process.env.PE_TEST_EXISTING;
  });

  it('reports cleanly when the file is absent', () => {
    const res = loadDotenv(join(tmpdir(), 'pe-no-such-env-file'));
    assert.equal(res.loaded, false);
  });
});
