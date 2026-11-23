import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow } from './types.js';

type Run = {
  at: string;
  job: string;
  status: DigestRow['lastStatus'];
  owner: string | null;
  error?: string;
};

function isRun(value: unknown): value is Run {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;

  const record = value as Record<string, unknown>;
  return (
    typeof record.at === 'string' &&
    record.at.length > 0 &&
    typeof record.job === 'string' &&
    record.job.length > 0 &&
    (record.status === 'ok' || record.status === 'retry' || record.status === 'fail') &&
    (record.owner === null || typeof record.owner === 'string') &&
    (record.error === undefined || typeof record.error === 'string')
  );
}

function parseRun(line: string): Run | null {
  if (line.trim() === '') return null;

  try {
    const value: unknown = JSON.parse(line);
    return isRun(value) ? value : null;
  } catch {
    return null;
  }
}

export function readNight(runsDir: string, night: string): DigestRow[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) {
    throw new RangeError('night must be a date in YYYY-MM-DD format');
  }

  const contents = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  const rows = new Map<string, DigestRow>();

  for (const line of contents.split(/\r?\n/)) {
    const run = parseRun(line);
    if (run === null) continue;

    const row = rows.get(run.job);
    if (row === undefined) {
      rows.set(run.job, {
        job: run.job,
        owner: run.owner,
        runs: 1,
        retries: run.status === 'retry' ? 1 : 0,
        lastStatus: run.status,
        lastError: run.error ?? null,
        firstAt: run.at,
        lastAt: run.at,
      });
      continue;
    }

    row.owner = run.owner;
    row.runs += 1;
    if (run.status === 'retry') row.retries += 1;
    row.lastStatus = run.status;
    if (run.error !== undefined) row.lastError = run.error;
    row.lastAt = run.at;
  }

  return [...rows.values()];
}
