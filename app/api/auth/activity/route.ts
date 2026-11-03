import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { isSameOriginRequest } from '@/lib/api-auth';
import {
  clearSessionCookie,
  refreshSessionCookie,
  SESSION_COOKIE,
} from '@/lib/auth';
import { refreshAdminSession } from '@/lib/store';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ error: 'Admin sign-in required.' }, { status: 401 });
  }

  try {
    if (!(await refreshAdminSession(token))) {
      return clearSessionCookie(NextResponse.json({ error: 'Admin session expired.' }, { status: 401 }));
    }

    return refreshSessionCookie(NextResponse.json({ ok: true }), token);
  } catch (error) {
    console.error('Unable to refresh admin session:', error);
    return NextResponse.json({ error: 'Unable to refresh admin session.' }, { status: 500 });
  }
}
