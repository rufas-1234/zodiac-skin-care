import { NextResponse } from 'next/server';

import { isSameOriginRequest } from '@/lib/api-auth';
import { clearSessionCookie } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
  }
  return clearSessionCookie(NextResponse.json({ ok: true }));
}
