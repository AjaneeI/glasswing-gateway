'use client';
import { SeverityBadge } from '@/components/ui/primitives';
import type { Finding } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ArrowRight, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
export function FindingRow({ finding, index }: { finding: Finding; index: number }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={cn('finding', expanded && 'expanded')}>
      <button
        className="finding-row"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        <span
          className={cn(
            'finding-number',
            finding.severity === 'Critical'
              ? 'critical'
              : finding.severity === 'High'
                ? 'high'
                : 'medium',
          )}
        >
          {index + 1}
        </span>
        <span className="finding-text">
          <strong>{finding.title}</strong>
          <span>{finding.description}</span>
        </span>
        <SeverityBadge severity={finding.severity} />
        <ChevronRight className="finding-chevron" size={15} />
      </button>
      {expanded && (
        <div className="finding-details">
          <p>{finding.detail}</p>
          <div>
            <code>{finding.path}</code>
            <span>{finding.affected} affected sessions</span>
          </div>
          <Link href="/recommendations">
            View recommended fix
            <ArrowRight size={13} />
          </Link>
        </div>
      )}
    </div>
  );
}
