'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { supabaseConfig } from '@/lib/supabase/config';

type Result = { error?: string; message?: string; success?: boolean };
const unavailable = 'Account services are not configured yet. Please try again later.';

export async function authenticate(mode: 'signin' | 'signup', form: FormData): Promise<Result> {
  const email = String(form.get('email') || '').trim();
  const password = String(form.get('password') || '');
  const fullName = String(form.get('full_name') || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
    return { error: 'Enter a valid email address.' };
  if (!password || password.length > 128)
    return { error: 'Enter a password of at most 128 characters.' };
  if (mode === 'signup' && (password.length < 8 || fullName.length < 1 || fullName.length > 100))
    return { error: 'Enter your name and a password with at least 8 characters.' };
  if (!supabaseConfig()) return { error: unavailable };
  try {
    const supabase = await createClient();
    if (mode === 'signup') {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
      if (!siteUrl) return { error: unavailable };
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName }, emailRedirectTo: `${siteUrl}/auth/callback` },
      });
      if (error)
        return {
          error:
            error.status === 429
              ? 'Too many attempts. Please wait and try again.'
              : 'Unable to create an account. Check your details or try signing in.',
        };
      if (!data.session)
        return {
          message:
            'Check your email for a confirmation link. If this address already has an account, sign in instead.',
        };
      return { success: true };
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error)
      return {
        error:
          error.code === 'email_not_confirmed'
            ? 'Confirm your email before signing in.'
            : error.status === 429
              ? 'Too many attempts. Please wait and try again.'
              : 'Unable to sign in. Check your email and password.',
      };
    return { success: true };
  } catch {
    return { error: 'Unable to reach account services. Please try again.' };
  }
}

export async function signOut(): Promise<Result> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) return { error: 'Unable to sign out. Please try again.' };
  } catch {
    return { error: 'Unable to sign out. Please try again.' };
  }
  redirect('/login');
}
