import { NextResponse } from 'next/server';

import { getCurrentCustomer } from '@/lib/customer-auth';
import { isSameOriginRequest } from '@/lib/api-auth';
import { addCustomerPasswordLogin, updateCustomerProfile } from '@/lib/customer-store';
import { normalizeCustomerUsername } from '@/lib/customer-types';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const customer = await getCurrentCustomer();
    if (!customer) return NextResponse.json({ error: 'Customer sign-in required.' }, { status: 401 });
    return NextResponse.json({ customer }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Unable to load customer account:', error);
    return NextResponse.json({ error: 'Unable to load your account.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  try {
    const customer = await getCurrentCustomer();
    if (!customer) return NextResponse.json({ error: 'Customer sign-in required.' }, { status: 401 });
    const body: unknown = await request.json();
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: 'Enter a valid name and email address.' }, { status: 400 });
    }

    const input = body as {
      name?: unknown;
      email?: unknown;
      username?: unknown;
      password?: unknown;
    };
    if (typeof input.name !== 'string' || typeof input.email !== 'string') {
      return NextResponse.json({ error: 'Enter a valid name and email address.' }, { status: 400 });
    }
    const name = input.name.trim();
    const email = input.email.trim().toLowerCase();
    if (name.length > 120 || email.length > 254 || (
      email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    )) {
      return NextResponse.json({ error: 'Enter a valid name and email address.' }, { status: 400 });
    }

    let username = customer.username;
    if (input.username !== undefined || input.password !== undefined) {
      if (typeof input.username !== 'string' || typeof input.password !== 'string') {
        return NextResponse.json({ error: 'Enter both a username and password to enable password sign-in.' }, { status: 400 });
      }
      if (customer.username) {
        return NextResponse.json({ error: 'This account already has username and password sign-in enabled.' }, { status: 409 });
      }
      const normalizedUsername = normalizeCustomerUsername(input.username);
      if (!normalizedUsername) {
        return NextResponse.json({ error: 'Username must be 3-32 characters using letters, numbers, dots, underscores, or hyphens.' }, { status: 400 });
      }
      if (input.password.length < 12 || input.password.length > 1024) {
        return NextResponse.json({ error: 'Password must be between 12 and 1024 characters.' }, { status: 400 });
      }
      if (!(await addCustomerPasswordLogin(customer.id, normalizedUsername, input.password))) {
        return NextResponse.json({ error: 'Unable to enable username and password sign-in.' }, { status: 500 });
      }
      username = normalizedUsername;
    }

    if (!(await updateCustomerProfile(customer.id, name, email || null))) {
      return NextResponse.json({ error: 'Unable to save your account details.' }, { status: 500 });
    }
    return NextResponse.json({
      customer: { ...customer, name, email: email || null, username },
    });
  } catch (error) {
    if (error instanceof Error && /already taken|already has username/i.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Request must contain valid JSON.' }, { status: 400 });
    }
    console.error('Unable to update customer account:', error);
    return NextResponse.json({ error: 'Unable to save your account details.' }, { status: 500 });
  }
}
