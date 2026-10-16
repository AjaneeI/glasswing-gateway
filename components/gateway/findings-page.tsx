'use client';
import { useState } from 'react';
import Link from 'next/link';
import { PageHeading } from '@/components/ui/page-heading';
import { Button } from '@/components/ui/primitives';
import type { FindingResult, PageResult } from '@/lib/gateway/client';
import { useGateway } from './provider';
import { ErrorNotice, FindingsList, useGatewayData } from './shared';
export function GatewayFindingsPage() {
  const [offset, setOffset] = useState(0);
  const { dashboard } = useGateway();
  const { data, error, loading, reload } = useGatewayData<PageResult<FindingResult>>(
    `/findings?limit=25&offset=${offset}`,
    dashboard,
  );
  return (
    <>
      <PageHeading
        title="Findings & next steps"
        subtitle="Review the supporting evidence, update your storefront, and rerun an approved plan to verify the outcome."
        action={
          <Button asChild>
            <Link href="/discover">Review a test plan</Link>
          </Button>
        }
      />
      <ErrorNotice message={error} retry={reload} />
      {loading && <p role="status">Loading findings…</p>}
      {data && (
        <>
          <FindingsList findings={data.items} />
          <div className="gateway-toolbar gateway-panel">
            <span>{data.total} findings</span>
            <Button
              variant="outline"
              disabled={offset === 0}
              onClick={() => setOffset((value) => Math.max(0, value - 25))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              disabled={offset + 25 >= data.total}
              onClick={() => setOffset((value) => value + 25)}
            >
              Next
            </Button>
          </div>
        </>
      )}
    </>
  );
}
