import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/reader.js';

const runsDir = resolve('runs');
const temporaryDirectories: string[] = [];

function makeRunsDir(): string {
  const directory = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('readNight', () => {
  it('aggregates the five jobs in the fixture and skips its malformed final line', () => {
    const fixture = readFileSync(join(runsDir, '2026-10-28.jsonl'), 'utf8');
    expect(fixture.split(/\r?\n/).filter(Boolean)).toHaveLength(16);

    const rows = readNight(runsDir, '2026-10-28');
    expect(rows).toHaveLength(5);

    expect(rows).toEqual([
      {
        job: 'rig/rotate-logs',
        owner: 'lane-07',
        runs: 1,
        retries: 0,
        lastStatus: 'ok',
        lastError: null,
        firstAt: '2026-10-28T23:00:02+01:00',
        lastAt: '2026-10-28T23:00:02+01:00',
      },
      {
        job: 'lane/sync',
        owner: 'rook',
        runs: 8,
        retries: 1,
        lastStatus: 'ok',
        lastError: 'lock held',
        firstAt: '2026-10-28T23:00:06+01:00',
        lastAt: '2026-10-29T05:00:04+01:00',
      },
      {
        job: 'fixtures/refresh',
        owner: 'rook',
        runs: 4,
        retries: 3,
        lastStatus: 'ok',
        lastError: 'upstream 503',
        firstAt: '2026-10-29T01:30:00+01:00',
        lastAt: '2026-10-29T01:37:00+01:00',
      },
      {
        job: 'notes/backup',
        owner: 'lane-07',
        runs: 1,
        retries: 0,
        lastStatus: 'fail',
        lastError: 'quota exceeded',
        firstAt: '2026-10-29T04:00:01+01:00',
        lastAt: '2026-10-29T04:00:01+01:00',
      },
      {
        job: 'digest/render',
        owner: null,
        runs: 1,
        retries: 0,
        lastStatus: 'ok',
        lastError: null,
        firstAt: '2026-10-29T05:41:09+01:00',
        lastAt: '2026-10-29T05:41:09+01:00',
      },
    ]);
  });

  it('returns no rows for an empty file and skips malformed records', () => {
    const directory = makeRunsDir();
    writeFileSync(join(directory, '2026-10-29.jsonl'), '\nnot json\n[]\n{"job":"incomplete"}\n');

    expect(readNight(directory, '2026-10-29')).toEqual([]);

    writeFileSync(join(directory, '2026-10-29.jsonl'), '');
    expect(readNight(directory, '2026-10-29')).toEqual([]);
  });

  it('rejects night names that cannot identify a JSONL night file', () => {
    expect(() => readNight(runsDir, '../2026-10-28')).toThrow(RangeError);
  });
});
