import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseConfig } from '@/lib/supabase/config';

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const publicPage =
    ['/', '/login', '/signup', '/discover'].includes(path) || path.startsWith('/auth/');
  let response = NextResponse.next({ request });
  const config = supabaseConfig();
  let authenticated = false;
  if (config) {
    const supabase = createServerClient(config.url, config.key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(values) {
          values.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });
    try {
      const { data, error } = await supabase.auth.getUser();
      authenticated = !error && !!data.user;
    } catch {
      authenticated = false;
    }
  }
  if (!publicPage && !authenticated) {
    const blocked = path.startsWith('/api/')
      ? NextResponse.json(
          path.startsWith('/api/gateway')
            ? {
                apiVersion: 'v1',
                error: {
                  code: 'AUTHENTICATION_REQUIRED',
                  message: 'Authentication required.',
                  retryable: false,
                },
              }
            : { error: 'Authentication required.' },
          { status: 401 },
        )
      : NextResponse.redirect(new URL('/login', request.url));
    response.cookies.getAll().forEach((cookie) => blocked.cookies.set(cookie));
    response = blocked;
  }
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|backpack.jpg|mountains.jpg).*)'],
};
