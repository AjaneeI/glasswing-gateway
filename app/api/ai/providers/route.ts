import { NextResponse } from 'next/server';
import { defaultProviderId, listProviders } from '@/lib/ai/providers';

// Provider list for the Agent search UI. Kept under /api/ai so it does not
// collide with the reviewed Gateway workflow.
export async function GET() {
  return NextResponse.json({
    providers: listProviders(),
    defaultProvider: defaultProviderId,
  });
}