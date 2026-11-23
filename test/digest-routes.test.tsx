import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { DigestRow } from '../src/digest/types.js';

const temporaryDirectories: string[] = [];

function makeRunsDir(): string {
  const directory = mkdtempSync(join(tmpdir(), 'rig-digest-routes-'));
  temporaryDirectories.push(directory);
  return directory;
}

function jobsFromHtml(html: string): string[] {
  const tbody = html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1];
  if (tbody === undefined) return [];

  return Array.from(tbody.matchAll(/<tr(?:\s[^>]*)?>\s*<td>(.*?)<\/td>/g), (match) => match[1]);
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('digest routes', () => {
  it('returns data from both routes with matching, sorted jobs', async () => {
    const runsDir = makeRunsDir();
    writeFileSync(
      join(runsDir, '2026-10-30.jsonl'),
      [
        JSON.stringify({ at: '2026-10-30T01:00:00+01:00', job: 'zeta', status: 'ok', owner: 'rook' }),
        JSON.stringify({ at: '2026-10-30T01:01:00+01:00', job: 'alpha', status: 'retry', owner: 'lane-07' }),
      ].join('\n'),
    );

    const app = createApp({
      adapter: 'shim',
      installed: '2026-10-29T14:06:00+01:00',
      beatEverySeconds: 60,
      runsDir,
    });
    const pageResponse = await app.request('/digest/2026-10-30');
    const apiResponse = await app.request('/api/digest/2026-10-30');
    const html = await pageResponse.text();
    const rows = (await apiResponse.json()) as DigestRow[];
    const pageJobs = jobsFromHtml(html);
    const apiJobs = rows.map((row) => row.job);

    expect(pageResponse.status).toBe(200);
    expect(apiResponse.status).toBe(200);
    expect(pageJobs).toEqual(['alpha', 'zeta']);
    expect(apiJobs).toEqual(pageJobs);
  });

  it('returns 404 from both routes when the night file is missing', async () => {
    const app = createApp({
      adapter: 'shim',
      installed: '2026-10-29T14:06:00+01:00',
      beatEverySeconds: 60,
      runsDir: makeRunsDir(),
    });

    const pageResponse = await app.request('/digest/2026-10-30');
    const apiResponse = await app.request('/api/digest/2026-10-30');

    expect(pageResponse.status).toBe(404);
    expect(apiResponse.status).toBe(404);
  });

  it('renders an empty night in HTML and returns an empty JSON array', async () => {
    const runsDir = makeRunsDir();
    writeFileSync(join(runsDir, '2026-10-30.jsonl'), '');
    const app = createApp({
      adapter: 'shim',
      installed: '2026-10-29T14:06:00+01:00',
      beatEverySeconds: 60,
      runsDir,
    });

    const pageResponse = await app.request('/digest/2026-10-30');
    const apiResponse = await app.request('/api/digest/2026-10-30');
    const html = await pageResponse.text();

    expect(pageResponse.status).toBe(200);
    expect(apiResponse.status).toBe(200);
    expect(html).toContain('nothing ran');
    expect(await apiResponse.json()).toEqual([]);
  });

  it('ignores a malformed line while keeping valid rows in the same order on both routes', async () => {
    const runsDir = makeRunsDir();
    writeFileSync(
      join(runsDir, '2026-10-30.jsonl'),
      [
        JSON.stringify({ at: '2026-10-30T01:00:00+01:00', job: 'zeta', status: 'ok', owner: 'rook' }),
        '{malformed line',
        JSON.stringify({ at: '2026-10-30T01:01:00+01:00', job: 'alpha', status: 'fail', owner: 'lane-07' }),
      ].join('\n'),
    );
    const app = createApp({
      adapter: 'shim',
      installed: '2026-10-29T14:06:00+01:00',
      beatEverySeconds: 60,
      runsDir,
    });

    const pageResponse = await app.request('/digest/2026-10-30');
    const apiResponse = await app.request('/api/digest/2026-10-30');
    const html = await pageResponse.text();
    const rows = (await apiResponse.json()) as DigestRow[];
    const pageJobs = jobsFromHtml(html);
    const apiJobs = rows.map((row) => row.job);

    expect(pageResponse.status).toBe(200);
    expect(apiResponse.status).toBe(200);
    expect(pageJobs).toEqual(['alpha', 'zeta']);
    expect(apiJobs).toEqual(pageJobs);
  });
});
