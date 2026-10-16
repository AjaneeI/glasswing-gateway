import { ScanningPage } from '@/components/discover/scanning-page';
import type { Metadata } from 'next';
import { Suspense } from 'react';

export const metadata: Metadata = { title: 'Scanning Storefront' };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ScanningPage />
    </Suspense>
  );
}