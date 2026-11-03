import { randomInt } from 'node:crypto';

import { NextResponse } from 'next/server';

import { isSameOriginRequest } from '@/lib/api-auth';
import { sendCustomerLoginCode, isCustomerSmsConfigured } from '@/lib/customer-sms';
import {
  makeCustomerCodeHash,
  requestCustomerLoginCode,
} from '@/lib/customer-store';
import { normalizeCustomerPhone } from '@/lib/customer-types';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }
  try {
    const body: unknown = await request.json();
    const phone = typeof body === 'object' && body !== null && 'phone' in body && typeof body.phone === 'string'
      ? normalizeCustomerPhone(body.phone)
      : null;
    if (!phone) {
      return NextResponse.json({ error: 'Enter a valid phone number, including its country code.' }, { status: 400 });
    }
    if (!isCustomerSmsConfigured()) {
      return NextResponse.json({ error: 'Phone sign-in is not configured yet. Please contact the store.' }, { status: 503 });
    }
    if (!process.env.AUTH_SECRET || Buffer.byteLength(process.env.AUTH_SECRET, 'utf8') < 32) {
      return NextResponse.json({ error: 'Phone sign-in is temporarily unavailable.' }, { status: 503 });
    }

    const code = String(randomInt(100_000, 1_000_000));
    const codeHash = await makeCustomerCodeHash(phone, code);
    if (!(await requestCustomerLoginCode(phone, codeHash))) {
      return NextResponse.json({ error: 'Please wait one minute before requesting another code.' }, { status: 429 });
    }

    try {
      await sendCustomerLoginCode(phone, code);
    } catch (smsError) {
      console.error('Unable to deliver customer sign-in code:', smsError);
      return NextResponse.json({ error: 'We could not send a sign-in code. Please try again in one minute.' }, { status: 503 });
    }

    return NextResponse.json({
      phone,
      message: `A sign-in code was sent to ${phone}.`,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Request must contain valid JSON.' }, { status: 400 });
    }
    console.error('Unable to start customer sign-in:', error);
    return NextResponse.json({ error: 'Unable to send a sign-in code.' }, { status: 500 });
  }
}
