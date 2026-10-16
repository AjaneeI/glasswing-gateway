'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button, Card, CardHeader, EmptyState, StatusBadge } from '@/components/ui/primitives';
import { gatewayRequest, GatewayApiError, type FindingResult } from '@/lib/gateway/client';
import { groupFindings, urgencyLabel } from '@/lib/gateway/finding-guidance';
import type { Scan, Session } from '@/lib/gateway/schemas';
import { Check, Copy, Sparkles, Wrench } from 'lucide-react';
import { ScanEconomics } from './scan-economics';
import { ScanExecution } from './scan-execution';

export function useGatewayData<T>(path: string | null, version: unknown = 0) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!path) {
      setLoading(false);
      setData(null);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError('');
    void gatewayRequest<T>(path, { signal: controller.signal })
      .then((value) => {
        if (!controller.signal.aborted) setData(value);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setData(null);
          setError(error instanceof Error ? error.message : 'Unable to load results.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [path, version, retry]);
  return { data, error, loading, reload: () => setRetry((value) => value + 1) };
}
export function ErrorNotice({ message, retry }: { message: string; retry?: () => void }) {
  if (!message) return null;
  return (
    <div className="portal-error gateway-error" role="alert">
      <span>{message}</span>
      {retry && (
        <Button size="sm" variant="outline" onClick={retry}>
          Retry
        </Button>
      )}
    </div>
  );
}
export function errorMessage(error: unknown) {
  if (error instanceof GatewayApiError && error.status === 401)
    return 'Sign in to inspect a storefront and save your scans.';
  return error instanceof Error ? error.message : 'The request failed. Please retry.';
}
export function FixtureBadge({ fixture }: { fixture: boolean }) {
  return (
    <StatusBadge tone={fixture ? 'amber' : 'blue'}>
      {fixture ? 'Fixture · development only' : 'OpenAI run'}
    </StatusBadge>
  );
}
export function OutcomeBadge({ session }: { session: Pick<Session, 'status' | 'evaluation'> }) {
  const label = session.evaluation?.outcome || session.status;
  return (
    <StatusBadge
      tone={
        label === 'passed' ? 'green' : ['failed', 'interrupted'].includes(label) ? 'red' : 'amber'
      }
    >
      {label}
    </StatusBadge>
  );
}
/**
 * Collapsed by default: most merchants want the plain-language fix, not an
 * AI-editor prompt, so this stays a click away rather than shown up front.
 */
function AiPromptToggle({ prompt }: { prompt: string }) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const textRef = useRef<HTMLPreElement>(null);
  const reset = () => setTimeout(() => setCopyState('idle'), 2500);
  return (
    <details className="finding-ai-prompt">
      <summary>
        <Sparkles size={13} />
        AI website-builder prompt
      </summary>
      <p className="finding-ai-prompt-note">
        Paste this into your site's AI editor (Shopify Sidekick, Wix ADI, Framer AI, Squarespace
        AI, or a coding assistant) to make this change automatically.
      </p>
      <pre className="finding-ai-prompt-text" ref={textRef}>
        {prompt}
      </pre>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          navigator.clipboard
            .writeText(prompt)
            .then(() => setCopyState('copied'))
            .catch(() => {
              // Clipboard access can be denied by browser policy even on a
              // real click. Select the text instead so the merchant can still
              // copy it with their own keyboard shortcut.
              const range = document.createRange();
              if (textRef.current) range.selectNodeContents(textRef.current);
              window.getSelection()?.removeAllRanges();
              window.getSelection()?.addRange(range);
              setCopyState('failed');
            })
            .finally(reset);
        }}
      >
        {copyState === 'copied' ? <Check size={13} /> : <Copy size={13} />}
        {copyState === 'copied'
          ? 'Copied'
          : copyState === 'failed'
            ? 'Selected — press Ctrl+C'
            : 'Copy prompt'}
      </Button>
    </details>
  );
}
export function FindingsList({ findings }: { findings: FindingResult[] }) {
  return (
    <Card>
      <CardHeader
        title="What to fix"
        subtitle="What a shopper ran into, and what to change on your store. Each one links to the recorded session."
      />
      {findings.length ? (
        groupFindings(findings).map((group) => {
          const help = group.guidance;
          const count = group.occurrences.length;
          const first = group.occurrences[0];
          return (
            <article className="gateway-finding" data-severity={group.severity} key={group.category}>
              <div className="gateway-toolbar">
                <StatusBadge tone={group.severity === 'high' ? 'red' : 'amber'}>
                  {urgencyLabel(group.severity)}
                </StatusBadge>
                <span className="finding-label">{help.label}</span>
                <span className="finding-count">
                  {count === 1 ? '1 shopper affected' : `${count} shoppers affected`}
                </span>
                <FixtureBadge fixture={first.fixture} />
              </div>
              <h3>{help.headline}</h3>
              <p>{help.whatHappened}</p>
              <div className="finding-fix">
                <span className="finding-fix-heading">
                  <Wrench size={13} />
                  Recommended fix
                </span>
                <p>{help.fix}</p>
                <span className="finding-fix-subheading">Common causes to check</span>
                <ul>
                  {help.commonCauses.map((cause) => (
                    <li key={cause}>{cause}</li>
                  ))}
                </ul>
              </div>
              <AiPromptToggle prompt={help.aiPrompt} />
              <details className="finding-detail">
                <summary>
                  Technical detail{count > 1 ? ` · ${count} sessions` : ''}
                </summary>
                {group.occurrences.map((finding) => (
                  <div className="finding-detail-item" key={finding.id}>
                    <strong>{finding.title}</strong>
                    <p>{finding.summary}</p>
                  </div>
                ))}
              </details>
              <div className="finding-sessions">
                {group.occurrences.map((finding, index) => (
                  <Link
                    key={finding.id}
                    className="text-link"
                    href={`/replays/${finding.sessionId}?evidence=${encodeURIComponent(finding.evidenceIds[0] || '')}`}
                  >
                    {count === 1 ? 'Watch what the shopper did' : `Watch shopper ${index + 1}`} →
                  </Link>
                ))}
              </div>
            </article>
          );
        })
      ) : (
        <EmptyState
          title="Nothing to fix yet"
          description="If a shopper gets stuck or ends up with the wrong product, it will show up here with a suggested fix."
        />
      )}
    </Card>
  );
}
export function ScanResults({ scan }: { scan: Scan }) {
  return (
    <div className="gateway-stack">
      <ScanExecution scan={scan} />
      <ScanEconomics scan={scan} />
      <FindingsList
        findings={scan.findings.map((finding) => ({
          ...finding,
          scanId: scan.id,
          fixture: scan.fixture,
        }))}
      />
    </div>
  );
}
