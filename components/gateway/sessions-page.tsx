'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PageHeading } from '@/components/ui/page-heading';
import { Button, Card, EmptyState, Select } from '@/components/ui/primitives';
import { formatTime, type PageResult, type SessionSummary } from '@/lib/gateway/client';
import { useGateway } from './provider';
import { ErrorNotice, FixtureBadge, OutcomeBadge, useGatewayData } from './shared';
export function GatewaySessionsPage({ replays = false }: { replays?: boolean }) {
  const [scanId, setScanId] = useState('');
  const [mode, setMode] = useState('');
  const [status, setStatus] = useState('');
  const [outcome, setOutcome] = useState('');
  const [offset, setOffset] = useState(0);
  const { activeScan, dashboard } = useGateway();
  useEffect(() => {
    setScanId(new URLSearchParams(window.location.search).get('scanId') || '');
  }, []);
  const params = new URLSearchParams({ limit: '25', offset: String(offset) });
  if (scanId) params.set('scanId', scanId);
  if (mode) params.set('mode', mode);
  if (status) params.set('status', status);
  if (outcome) params.set('outcome', outcome);
  const version = activeScan
    ? `${activeScan.status}:${activeScan.sessions.reduce((sum, session) => sum + session.trace.length + session.modelCalls.length, 0)}`
    : dashboard?.totalSessions;
  const { data, error, loading, reload } = useGatewayData<PageResult<SessionSummary>>(
    `/sessions?${params}`,
    version,
  );
  const change = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setOffset(0);
  };
  return (
    <>
      <PageHeading
        title={replays ? 'Session replays' : 'Shopping sessions'}
        subtitle="Recorded shopper sessions from your reviewed test plans."
        action={
          <Button asChild>
            <Link href="/discover">Run shopping tests</Link>
          </Button>
        }
      />
      <Card>
        <div className="gateway-panel gateway-toolbar">
          <Select
            label="Filter by test mode"
            value={mode}
            onChange={change(setMode)}
            options={[{ value: '', label: 'All modes' }, 'legitimate', 'constraint', 'red_team']}
          />
          <Select
            label="Filter by execution status"
            value={status}
            onChange={change(setStatus)}
            options={[
              { value: '', label: 'All execution states' },
              'queued',
              'running',
              'completed',
              'failed',
              'interrupted',
            ]}
          />
          <Select
            label="Filter by evaluation outcome"
            value={outcome}
            onChange={change(setOutcome)}
            options={[{ value: '', label: 'All outcomes' }, 'passed', 'failed', 'inconclusive']}
          />
          <Button variant="ghost" onClick={reload}>
            Refresh
          </Button>
          {scanId && (
            <Button
              variant="ghost"
              onClick={() => {
                setScanId('');
                setOffset(0);
                window.history.replaceState(null, '', window.location.pathname);
              }}
            >
              Show all scans
            </Button>
          )}
        </div>
        <ErrorNotice message={error} retry={reload} />
        {loading && (
          <p className="gateway-panel" role="status">
            Loading sessions…
          </p>
        )}
        {data &&
          (data.items.length ? (
            <div className="gateway-table-wrap">
              <table className="gateway-table">
                <thead>
                  <tr>
                    <th>Goal</th>
                    <th>Archetype</th>
                    <th>Mode</th>
                    <th>Execution</th>
                    <th>Evaluation</th>
                    <th>Started</th>
                    <th>Replay</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((session) => (
                    <tr key={session.id}>
                      <td>
                        {session.scenario.goal}
                        <small>{session.id.slice(0, 8)}</small>
                        <FixtureBadge fixture={session.fixture} />
                      </td>
                      <td>{session.archetype.name}</td>
                      <td>{session.scenario.mode}</td>
                      <td>{session.status}</td>
                      <td>
                        <OutcomeBadge session={session} />
                      </td>
                      <td>{formatTime(session.startedAt)}</td>
                      <td>
                        <Link className="text-link" href={`/replays/${session.id}`}>
                          Inspect {session.steps} events
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No matching sessions"
              description="Run an approved test plan or adjust your filters."
            />
          ))}
        {data && (
          <div className="gateway-panel gateway-toolbar">
            <span>
              {data.total} sessions · page {Math.floor(offset / 25) + 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={offset === 0}
              onClick={() => setOffset((value) => Math.max(0, value - 25))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={offset + 25 >= data.total}
              onClick={() => setOffset((value) => value + 25)}
            >
              Next
            </Button>
          </div>
        )}
      </Card>
    </>
  );
}
