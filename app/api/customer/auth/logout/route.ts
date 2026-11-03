import { NextResponse } from 'next/server';

import { isSameOriginRequest } from '@/lib/api-auth';
import { clearCustomerSessionCookie } from '@/lib/customer-auth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }
  return clearCustomerSessionCookie(NextResponse.json({ ok: true }));
}
