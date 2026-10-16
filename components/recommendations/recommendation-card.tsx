'use client';
import { useApp } from '@/components/layout/app-provider';
import { Button, Card, Dialog, LoadingLabel, StatusBadge } from '@/components/ui/primitives';
import type { Recommendation } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  Check,
  CheckCheck,
  ChevronDown,
  Code2,
  Copy,
  FileCode2,
  Play,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
export function RecommendationCard({
  recommendation: r,
  index,
}: {
  recommendation: Recommendation;
  index: number;
}) {
  const [expanded, setExpanded] = useState(index === 0);
  const [implementation, setImplementation] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const { resolved, resolve, verified, verify, notify } = useApp();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isResolved = resolved.includes(r.id);
  const isVerified = verified.includes(r.id);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const verifyFix = () => {
    setVerifying(true);
    timer.current = setTimeout(() => {
      setVerifying(false);
      verify(r.id);
      resolve(r.id);
      notify(`Verification run passed · ${r.title} · simulated result`);
    }, 2400);
  };
  return (
    <Card id={r.id} className={cn('recommendation-card', isResolved && 'resolved')}>
      <button
        className="recommendation-heading"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        <span className={cn('recommendation-icon', isResolved && 'green')}>
          {isResolved ? (
            <CheckCheck size={20} />
          ) : r.category === 'Security' ? (
            <ShieldCheck size={20} />
          ) : (
            <Code2 size={20} />
          )}
        </span>
        <span>
          <span className="recommendation-id">
            {r.id}
            <span>·</span>
            {r.category}
          </span>
          <strong>{r.title}</strong>
        </span>
        <StatusBadge tone={isVerified ? 'green' : isResolved ? 'neutral' : 'blue'}>
          {isVerified ? 'Verified' : isResolved ? 'Resolved · unverified' : 'High impact'}
        </StatusBadge>
        <ChevronDown size={17} className={cn(expanded && 'rotate-180')} />
      </button>
      <p className="recommendation-problem">{r.problem}</p>
      {expanded && (
        <div className="recommendation-details">
          <div>
            <span className="eyebrow">WHY AGENTS FAIL</span>
            <p>{r.reason}</p>
          </div>
          <div className="recommended-fix">
            <span className="eyebrow">
              <FileCode2 size={13} />
              RECOMMENDED FIX
            </span>
            <p>{r.fix}</p>
          </div>
        </div>
      )}
      <div className="recommendation-metrics">
        <span>
          <TrendingUp size={14} />
          <strong>{r.impact}</strong>
        </span>
        <span>
          Implementation<strong>{r.effort} effort</strong>
        </span>
        <span>
          Affected<strong>{r.affected} sessions</strong>
        </span>
      </div>
      <div className="recommendation-actions">
        <Button variant="outline" size="sm" onClick={() => setImplementation(true)}>
          <Code2 size={13} />
          {r.id === 'REC-003' ? 'Generate policy' : 'View implementation'}
        </Button>
        <div>
          <Button
            variant="ghost"
            size="sm"
            disabled={isResolved}
            onClick={() => {
              resolve(r.id);
              notify('Marked resolved. Run verification to confirm the fix.');
            }}
          >
            <Check size={13} />
            {isResolved ? 'Resolved' : 'Mark resolved'}
          </Button>
          <Button
            variant={isVerified ? 'outline' : 'default'}
            size="sm"
            disabled={verifying || isVerified}
            onClick={verifyFix}
          >
            {verifying ? (
              <LoadingLabel>Verifying…</LoadingLabel>
            ) : isVerified ? (
              <>
                <CheckCheck size={13} />
                Verified
              </>
            ) : (
              <>
                <Play size={12} />
                Verify fix
              </>
            )}
          </Button>
        </div>
      </div>
      {isVerified && (
        <div className="verification-result">
          <CheckCheck size={14} />
          <span>Verification passed · 12 simulated shopping sessions · 0 regressions</span>
          <span>Just now</span>
        </div>
      )}
      <Dialog
        open={implementation}
        onOpenChange={setImplementation}
        title={r.id === 'REC-003' ? 'Generated confirmation policy' : 'Implementation guide'}
        description={r.title}
      >
        <div className="implementation-guide">
          <p>{r.fix}</p>
          <div className="code-block-heading">
            <span>
              {r.category === 'Security' ? 'merchant-policy.yaml' : 'structured-data.json'}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(r.code);
                  notify('Implementation copied to clipboard.');
                } catch {
                  notify('Clipboard unavailable. Select and copy the code below.');
                }
              }}
            >
              <Copy size={13} />
              Copy
            </Button>
          </div>
          <pre className="code-block">{r.code}</pre>
          <div className="info-panel">
            <FileCode2 size={16} />
            <span>
              Apply this example to your storefront, then run a verification. The demo verifies
              against simulated data.
            </span>
          </div>
          <div className="dialog-actions">
            <Button variant="outline" onClick={() => setImplementation(false)}>
              Close guide
            </Button>
            <Button
              onClick={() => {
                setImplementation(false);
                verifyFix();
              }}
              disabled={verifying || isVerified}
            >
              <Play size={13} />
              Run verification
            </Button>
          </div>
        </div>
      </Dialog>
    </Card>
  );
}
