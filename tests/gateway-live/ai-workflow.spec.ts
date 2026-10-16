import { test, expect } from '@playwright/test';
import { loadEnvConfig } from '@next/env';
import { mkdir, writeFile } from 'node:fs/promises';
import { GatewayService } from '../../lib/gateway/service';
import { FileStore } from '../../lib/gateway/store';
import { handleGateway } from '../../lib/gateway/api';
import configs from '../../config/gateway-demo-environments.json';

// Explicit opt-in: real model calls are billed. Uses isolated test storage, not
// a fabricated Supabase session. Signup/authentication must be tested separately.
test.skip(process.env.GATEWAY_LIVE_AI !== '1', 'Real model calls require explicit opt-in.');
for (const config of configs) {
  test(`${config.id}: real AI inspection, review, execution and results`, async ({}, info) => {
    test.setTimeout(1_200_000);
    loadEnvConfig(process.cwd());
    process.env.GATEWAY_MODEL_MODE = 'openai';
    process.env.GATEWAY_TEST_ENVIRONMENTS = JSON.stringify(configs);
    const directory = info.outputPath('data');
    await mkdir(directory, { recursive: true });
    const service = new GatewayService(new FileStore(directory));
    const owner = `live-service-test-${config.id}`;
    const draft = await service.inspect(owner, {
      merchantUrl: new URL(config.entryPath, config.origin).href,
      environmentId: config.id,
    });
    await writeFile(info.outputPath('draft.json'), JSON.stringify(draft, null, 2));
    expect(draft.fixture).toBe(false);
    expect(draft.evidence.length).toBeGreaterThan(1);
    expect(draft.modelCalls.every((call) => !call.fixture && call.status === 'completed')).toBe(
      true,
    );
    console.log(
      `${config.id}: inspection completed; ${draft.scenarios.length} scenarios, ${draft.evidence.length} observations.`,
    );
    const approved = await service.review(owner, draft.id, {
      revision: draft.revision,
      archetypes: draft.archetypes,
      scenarios: draft.scenarios,
      approved: true,
    });
    const queued = await service.createScan(owner, {
      draftId: approved.id,
      revision: approved.revision,
    });
    console.log(`${config.id}: scan ${queued.id} started.`);
    const scan = await service.runScan(owner, queued.id);
    await writeFile(info.outputPath('scan.json'), JSON.stringify(scan, null, 2));
    console.log(
      JSON.stringify({
        site: config.id,
        status: scan.status,
        sessions: scan.sessions.map((s) => ({
          id: s.id,
          status: s.status,
          outcome: s.evaluation?.outcome,
          error: s.error,
          calls: s.modelCalls.map((c) => ({ purpose: c.purpose, status: c.status })),
        })),
      }),
    );
    expect(scan.status).toBe('completed');
    for (const session of scan.sessions) {
      expect(session.trace.length).toBeGreaterThan(0);
      expect(session.evaluation, `Missing independent evaluation for ${session.id}`).toBeTruthy();
      expect(
        session.modelCalls.some(
          (call) => call.purpose === 'evaluator' && call.status === 'completed',
        ),
      ).toBe(true);
    }
    for (const path of [
      'dashboard',
      'sessions',
      'findings',
      `scans/${scan.id}`,
      ...scan.sessions.map((s) => `sessions/${s.id}/replay`),
    ]) {
      const response = await handleGateway(
        new Request(`http://gateway.test/api/gateway/${path}`),
        path.split('/'),
        async () => owner,
        service,
      );
      expect(response.status).toBe(200);
      expect((await response.json()).apiVersion).toBe('v1');
    }
  });
}
