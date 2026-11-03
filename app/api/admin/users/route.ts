import { NextResponse } from 'next/server';

import { isAdminRequest, isSameOriginRequest } from '@/lib/api-auth';
import { isEmailTwoFactorConfigured } from '@/lib/email-2fa';
import { createAdminUser, listAdminUsers } from '@/lib/store';

export const runtime = 'nodejs';

export async function GET() {
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'Admin sign-in required.' }, { status: 401 });
  try {
    return NextResponse.json(await listAdminUsers());
  } catch (error) {
    console.error('Unable to load admin accounts:', error);
    return NextResponse.json({ error: 'Unable to load admin accounts.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'Admin sign-in required.' }, { status: 401 });

  try {
    const body: unknown = await request.json();
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: 'Name, email, and password are required.' }, { status: 400 });
    }
    const input = body as {
      name?: unknown;
      email?: unknown;
      password?: unknown;
      emailTwoFactorEnabled?: unknown;
    };
    if (typeof input.name !== 'string' || typeof input.email !== 'string' || typeof input.password !== 'string') {
      return NextResponse.json({ error: 'Name, email, and password are required.' }, { status: 400 });
    }
    if (input.emailTwoFactorEnabled !== undefined && typeof input.emailTwoFactorEnabled !== 'boolean') {
      return NextResponse.json({ error: 'Email verification preference is invalid.' }, { status: 400 });
    }
    const name = input.name.trim();
    const email = input.email.trim().toLowerCase();
    const password = input.password;
    if (!name || name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return NextResponse.json({ error: 'Enter a valid name and email address.' }, { status: 400 });
    }
    if (password.length < 12 || password.length > 1024) {
      return NextResponse.json({ error: 'Password must be between 12 and 1024 characters.' }, { status: 400 });
    }
    const emailTwoFactorEnabled = input.emailTwoFactorEnabled === true;
    if (emailTwoFactorEnabled && !isEmailTwoFactorConfigured()) {
      return NextResponse.json(
        { error: 'Configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM, and AUTH_SECRET before enabling email verification.' },
        { status: 503 },
      );
    }

    return NextResponse.json(
      await createAdminUser(email, name, password, emailTwoFactorEnabled),
      { status: 201 },
    );
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY'
      || error instanceof Error && /unique constraint/i.test(error.message)) {
      return NextResponse.json({ error: 'An account already uses that email address.' }, { status: 409 });
    }
    console.error('Unable to create admin account:', error);
    return NextResponse.json({ error: 'Unable to create admin account.' }, { status: 500 });
  }
}
