import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

describe('status board', () => {
  it('shows the lane banner and the nights on disk', async () => {
    process.env.LANE_MARKER = 'TEST-MARKER';
    const res = await createApp(config).request('/');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('TEST-MARKER');
    expect(html).toContain('<a href="/digest/2026-10-28">2026-10-28</a>');
    expect(html).toContain('<a href="/digest/2026-10-27">2026-10-27</a>');
  });

  it('links each night to its digest and counts jobs by their last status', async () => {
    const runsDir = mkdtempSync(join(tmpdir(), 'rig-status-'));
    try {
      writeFileSync(
        join(runsDir, '2026-10-30.jsonl'),
        [
          JSON.stringify({ at: '2026-10-30T01:00:00+01:00', job: 'alpha', status: 'retry', owner: 'rook' }),
          JSON.stringify({ at: '2026-10-30T01:01:00+01:00', job: 'alpha', status: 'ok', owner: 'rook' }),
          JSON.stringify({ at: '2026-10-30T01:02:00+01:00', job: 'beta', status: 'retry', owner: 'rook' }),
          JSON.stringify({ at: '2026-10-30T01:03:00+01:00', job: 'gamma', status: 'fail', owner: 'rook' }),
        ].join('\n'),
      );

      const res = await createApp({ ...config, runsDir }).request('/');
      const html = await res.text();
      expect(res.status).toBe(200);
      expect(html).toContain('<a href="/digest/2026-10-30">2026-10-30</a>');
      expect(html).toContain('ok 1 · retry 1 · fail 1');
    } finally {
      rmSync(runsDir, { recursive: true, force: true });
    }
  });

  it('health answers with the lane id', async () => {
    const res = await createApp(config).request('/health');
    expect(await res.json()).toEqual({ ok: true, lane: 'lane-07' });
  });
});
