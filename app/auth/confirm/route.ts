import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const token_hash = request.nextUrl.searchParams.get('token_hash');
  if (token_hash) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.verifyOtp({ token_hash, type: 'email' });
      if (!error)
        return new NextResponse(null, {
          status: 303,
          headers: { Location: '/dashboard', 'Cache-Control': 'no-store' },
        });
    } catch {}
  }
  return new NextResponse(null, {
    status: 303,
    headers: { Location: '/login?error=confirmation', 'Cache-Control': 'no-store' },
  });
}
