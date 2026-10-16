import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
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
