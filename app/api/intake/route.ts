import { NextResponse } from 'next/server';
import { buildIntakeContext } from '@/lib/agent/intake';
import { intakeRequest } from '@/lib/agent/request-schemas';
import { readJson } from '@/lib/gateway/api';
import { requireOwner, apiError } from '@/lib/api/auth';

// Intake stage. Replace the body of buildIntakeContext with an intake LLM
// later; the response contract (IntakeContext) stays identical.
export async function POST(request: Request) {
  try {
    await requireOwner(request);
    const body = await readJson(request, intakeRequest);
    const context = await buildIntakeContext(body.query, body.config);
    return NextResponse.json(context, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return apiError(error);
  }
}
