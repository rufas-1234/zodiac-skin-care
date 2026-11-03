import { NextResponse } from 'next/server';

import { isSameOriginRequest } from '@/lib/api-auth';
import { setCustomerSessionCookie } from '@/lib/customer-auth';
import {
  authenticateUsernameCustomer,
  createUsernameCustomer,
} from '@/lib/customer-store';
import {
  CustomerAccountError,
  CustomerLoginRateLimitError,
  normalizeCustomerUsername,
} from '@/lib/customer-types';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  try {
    const body: unknown = await request.json();
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: 'Enter your username and password.' }, { status: 400 });
    }

    const input = body as {
      action?: unknown;
      username?: unknown;
      password?: unknown;
      name?: unknown;
      email?: unknown;
    };
    if (
      (input.action !== 'signup' && input.action !== 'login')
      || typeof input.username !== 'string'
      || typeof input.password !== 'string'
    ) {
      return NextResponse.json({ error: 'Enter your username and password.' }, { status: 400 });
    }

    const username = normalizeCustomerUsername(input.username);
    if (!username) {
      return NextResponse.json(
        { error: 'Username must be 3-32 characters using letters, numbers, dots, underscores, or hyphens.' },
        { status: 400 },
      );
    }
    if (input.password.length < 12 || input.password.length > 1024) {
      return NextResponse.json({ error: 'Password must be between 12 and 1024 characters.' }, { status: 400 });
    }

    if (input.action === 'login') {
      const customer = await authenticateUsernameCustomer(username, input.password);
      if (!customer) {
        return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 });
      }
      return setCustomerSessionCookie(NextResponse.json({ customer }), customer.id);
    }

    const name = input.name === undefined ? '' : input.name;
    const email = input.email === undefined ? '' : input.email;
    if (
      typeof name !== 'string'
      || name.trim().length > 120
      || typeof email !== 'string'
    ) {
      return NextResponse.json({ error: 'Enter a valid name and email address.' }, { status: 400 });
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (
      normalizedEmail.length > 254
      || (normalizedEmail.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail))
    ) {
      return NextResponse.json({ error: 'Enter a valid email address or leave it blank.' }, { status: 400 });
    }

    const customer = await createUsernameCustomer(
      username,
      input.password,
      name.trim(),
      normalizedEmail || null,
    );
    return setCustomerSessionCookie(NextResponse.json({ customer }, { status: 201 }), customer.id);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Request must contain valid JSON.' }, { status: 400 });
    }
    if (error instanceof CustomerLoginRateLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    if (error instanceof CustomerAccountError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error('Unable to complete customer username sign-in:', error);
    return NextResponse.json({ error: 'Unable to complete sign-in. Please try again.' }, { status: 500 });
  }
}
