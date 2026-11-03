import { NextResponse } from 'next/server';

import { isSameOriginRequest } from '@/lib/api-auth';
import { getCurrentCustomer, setCustomerSessionCookie } from '@/lib/customer-auth';
import {
  linkCustomerPhone,
  makeCustomerCodeHash,
  verifyCustomerLoginCode,
} from '@/lib/customer-store';
import { CustomerAccountError, normalizeCustomerPhone } from '@/lib/customer-types';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  try {
    const body: unknown = await request.json();
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: 'Enter your phone number and six-digit code.' }, { status: 400 });
    }
    const payload = body as { phone?: unknown; code?: unknown };
    const phone = typeof payload.phone === 'string' ? normalizeCustomerPhone(payload.phone) : null;
    if (!phone || typeof payload.code !== 'string' || !/^\d{6}$/.test(payload.code)) {
      return NextResponse.json({ error: 'Enter your phone number and six-digit code.' }, { status: 400 });
    }

    const codeHash = await makeCustomerCodeHash(phone, payload.code);
    const currentCustomer = await getCurrentCustomer();
    if (currentCustomer) {
      const linkedCustomer = await linkCustomerPhone(currentCustomer.id, phone, codeHash);
      if (!linkedCustomer) {
        return NextResponse.json({ error: 'That code is invalid or expired. Request a new code and try again.' }, { status: 401 });
      }
      return NextResponse.json({ customer: linkedCustomer });
    }

    const customer = await verifyCustomerLoginCode(phone, codeHash);
    if (!customer) {
      return NextResponse.json({ error: 'That code is invalid or expired. Request a new code and try again.' }, { status: 401 });
    }

    return setCustomerSessionCookie(NextResponse.json({ customer }), customer.id);
  } catch (error) {
    if (error instanceof CustomerAccountError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Request must contain valid JSON.' }, { status: 400 });
    }
    console.error('Unable to verify customer sign-in:', error);
    return NextResponse.json({ error: 'Unable to verify your sign-in code.' }, { status: 500 });
  }
}
