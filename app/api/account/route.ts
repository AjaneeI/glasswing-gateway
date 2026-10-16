import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user)
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, created_at')
      .eq('id', user.id)
      .single();
    if (profileError)
      return NextResponse.json({ error: 'Unable to load your profile.' }, { status: 503 });
    return NextResponse.json(
      { user: { id: user.id, email: user.email }, profile },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch {
    return NextResponse.json({ error: 'Account services unavailable.' }, { status: 503 });
  }
}
