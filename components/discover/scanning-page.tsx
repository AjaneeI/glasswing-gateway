'use client';
import { useApp } from '@/components/layout/app-provider';
import { GatewayLogo } from '@/components/layout/app-shell';
import { runBuyerSwarm, runIntake } from '@/lib/agent/client';
import type { BuyerPersona } from '@/lib/agent/contracts';
import { buyerPersonas } from '@/lib/agent/personas';
import { computeReadiness, hostFromDomain, siteNameFromDomain } from '@/lib/agent/readiness';
import { productConfig } from '@/lib/mock-data/merchant';
import { Globe2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

const MIN_DURATION = 3400;

interface SwarmMetrics {
  agents: number;
  goals: number;
  succeeded: number;
  failed: number;
  findings: number;
  mode: string;
  model: string | null;
}

function phaseFor(_progress: number, done: boolean, error: string): string {
  if (error) return 'Scan stopped';
  if (done) return 'Preparing your dashboard…';
  return 'Waiting for the legacy request; progress is illustrative…';
}

export function ScanningPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { setScanSite, scanConfig } = useApp();
  const query = params.get('q') ?? '';
  const provider = params.get('provider') ?? undefined;
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [storefront, setStorefront] = useState(hostFromDomain(query));
  const [personas, setPersonas] = useState<BuyerPersona[]>(() => {
    const selected = buyerPersonas.filter((persona) => scanConfig.personaIds.includes(persona.id));
    return selected.length ? selected : buyerPersonas;
  });
  const [metrics, setMetrics] = useState<SwarmMetrics | null>(null);

  useEffect(() => {
    if (!query) {
      router.replace('/discover');
      return;
    }

    const startedAt = Date.now();
    let cancelled = false;
    const interval = setInterval(() => {
      const ratio = Math.min(1, (Date.now() - startedAt) / MIN_DURATION);
      setProgress(Math.round(ratio * 92));
    }, 80);

    (async () => {
      try {
        const intake = await runIntake(query, scanConfig);
        if (cancelled) return;
        setStorefront(intake.storefrontLabel);
        setPersonas(intake.personas);
        const swarm = await runBuyerSwarm(intake, provider);
        if (cancelled) return;
        setMetrics({
          agents: swarm.personas.length,
          goals: swarm.goalCount,
          succeeded: swarm.succeeded,
          failed: swarm.failed,
          findings: swarm.findings.length,
          mode: swarm.mode,
          model: swarm.model,
        });
        const remaining = MIN_DURATION - (Date.now() - startedAt);
        if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
        if (cancelled) return;
        clearInterval(interval);
        setProgress(100);
        setDone(true);
        const host = hostFromDomain(swarm.storefront);
        setScanSite({
          domain: host,
          name: siteNameFromDomain(swarm.storefront),
          score: computeReadiness(swarm.findings),
          mode: swarm.mode,
          model: swarm.model,
          succeeded: swarm.succeeded,
          failed: swarm.failed,
          goalCount: swarm.goalCount,
          findings: swarm.findings,
          scannedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });
        await new Promise((resolve) => setTimeout(resolve, 800));
        if (!cancelled) router.push('/dashboard');
      } catch (err) {
        if (cancelled) return;
        clearInterval(interval);
        setProgress(100);
        setError(err instanceof Error ? err.message : 'Agent run failed');
      }
    })();

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [query, provider, router, setScanSite, scanConfig]);

  const phase = phaseFor(progress, done, error);

  return (
    <div className="portal-page scanning-page">
      <header className="portal-brand">
        <span className="portal-logo">
          <GatewayLogo />
          <strong>{productConfig.name}</strong>
        </span>
        <span className="portal-brand-note">Legacy preview · illustrative progress</span>
      </header>

      <section className="scanning-stage">
        <div className="scanning-heading">
          <Globe2 size={16} />
          Legacy preview <strong>{storefront}</strong>
        </div>

        <div
          className="scanning-bigbar"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Illustrative waiting progress, not measured execution"
        >
          <i style={{ width: `${progress}%` }} />
        </div>
        <div className="scanning-pct">{progress}% · illustrative</div>
        <div className="scanning-phase" role="status" aria-live="polite">
          {phase}
        </div>
        <p>
          Legacy results are shopper self-reports. Catalog, policy, and checkout tools use synthetic
          fixtures, even with a live model.
        </p>

        <div className="scanning-agents">
          {personas.map((persona, index) => (
            <div
              className={`scanning-agent scanning-${persona.color}`}
              key={persona.id}
              style={{ animationDelay: `${index * 0.12}s` }}
            >
              <span className="scanning-avatar">{persona.short}</span>
              <span>{persona.name}</span>
            </div>
          ))}
        </div>

        <div className="scanning-metrics">
          {metrics ? (
            <>
              <span>
                <strong>{metrics.agents}</strong> buyer agents
              </span>
              <span>
                <strong>{metrics.goals}</strong> goal checks
              </span>
              <span>
                <strong>{metrics.succeeded}</strong> completed
              </span>
              <span>
                <strong>{metrics.failed}</strong> failed
              </span>
              <span>
                <strong>{metrics.findings}</strong> findings
              </span>
            </>
          ) : (
            <>
              <span>Intake building shared context…</span>
              <span>Buyer agents queued</span>
              <span>Findings will aggregate here</span>
            </>
          )}
        </div>

        {error && (
          <div className="scanning-error">
            {error}
            <button onClick={() => router.replace('/discover')}>Back to search</button>
          </div>
        )}
      </section>
    </div>
  );
}
