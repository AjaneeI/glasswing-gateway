'use client';
import { EmptyState, StatusBadge } from '@/components/ui/primitives';
import { agents } from '@/lib/mock-data/sessions';
import type { ShoppingSession } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
export function SessionTable({ sessions }: { sessions: ShoppingSession[] }) {
  const router = useRouter();
  return (
    <div className="table-scroll">
      <table className="data-table session-table">
        <thead>
          <tr>
            {[
              'Session',
              'Goal',
              'Agent',
              'Status',
              'Steps',
              'Duration',
              'Issues',
              'Timestamp',
              '',
            ].map((h, i) => (
              <th key={i}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr
              key={s.id}
              className="clickable-row"
              onClick={() => router.push(`/replays/${s.id}`)}
            >
              <td>
                <Link
                  className="session-id"
                  href={`/replays/${s.id}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {s.id}
                </Link>
                <span className="table-subtext">{s.environment}</span>
              </td>
              <td className="goal-cell">
                <span>{s.goal}</span>
                <span className="table-subtext">{s.goalType}</span>
              </td>
              <td>
                <div className="agent-cell">
                  <span
                    className={cn('agent-avatar', agents.find((a) => a.name === s.agent)?.color)}
                  >
                    {agents.find((a) => a.name === s.agent)?.short}
                  </span>
                  <span>{s.agent}</span>
                </div>
              </td>
              <td>
                <StatusBadge>{s.status}</StatusBadge>
              </td>
              <td className="mono">{s.steps}</td>
              <td className="mono">{s.duration}</td>
              <td>
                <span
                  className={cn(
                    'issue-count',
                    s.issues === 0
                      ? 'muted'
                      : s.severity === 'Critical'
                        ? 'danger-text'
                        : 'warning-text',
                  )}
                >
                  {s.issues === 0
                    ? '—'
                    : `${s.issues} ${s.status === 'Blocked' ? 'events' : s.severity === 'Critical' ? 'critical' : 'warning'}`}
                </span>
              </td>
              <td className="timestamp-cell">
                {s.timestamp}
                <span className="table-subtext">Sep {s.date.slice(-2)}, 2026</span>
              </td>
              <td>
                <ChevronRight size={14} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {sessions.length === 0 && <EmptyState />}
    </div>
  );
}
