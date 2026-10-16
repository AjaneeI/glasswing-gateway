'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PageHeading } from '@/components/ui/page-heading';
import { Button, EmptyState } from '@/components/ui/primitives';
import { gatewayClient, terminalScan } from '@/lib/gateway/client';
import type { Scan } from '@/lib/gateway/schemas';
import { useGateway } from './provider';
import { ErrorNotice, errorMessage, ScanResults } from './shared';
export function GatewayScanPage() {
  const { dashboard, activeScan, execute, error: executionError } = useGateway();
  const [id, setId] = useState<string | null>(null);
  const [scan, setScan] = useState<Scan | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    setId(new URLSearchParams(window.location.search).get('scanId'));
  }, []);
  const selected = id || activeScan?.id || dashboard?.scans[0]?.id;
  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    setScan(null);
    setError('');
    const poll = async () => {
      try {
        const result = await gatewayClient.scan(selected, controller.signal);
        if (controller.signal.aborted) return;
        setScan(result);
        if (!terminalScan(result)) timer = setTimeout(poll, 1500);
      } catch (error) {
        if (!controller.signal.aborted) setError(errorMessage(error));
      }
    };
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [selected, retry]);
  const current = activeScan?.id === selected ? activeScan : scan;
  return (
    <>
      <PageHeading
        title="Agent test run"
        subtitle="Observe shopper actions, independent outcomes, and evidence-backed findings."
        action={
          <Button asChild>
            <Link href="/discover">New test plan</Link>
          </Button>
        }
      />
      <ErrorNotice message={executionError || error} retry={() => setRetry((value) => value + 1)} />
      {current ? (
        <>
          {current.status === 'queued' && (
            <Button onClick={() => execute(current)}>Start queued scan</Button>
          )}
          <ScanResults scan={current} />
        </>
      ) : selected ? (
        !error && <p role="status">Loading scan…</p>
      ) : (
        <EmptyState
          title="No scan selected"
          description="Inspect a storefront and approve a test plan to run your first scan."
          action={
            <Button asChild>
              <Link href="/discover">Create test plan</Link>
            </Button>
          }
        />
      )}
    </>
  );
}
