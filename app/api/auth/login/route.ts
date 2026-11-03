import { randomBytes, randomInt } from 'node:crypto';

import { NextResponse } from 'next/server';

import { isSameOriginRequest } from '@/lib/api-auth';
import { setSessionCookie } from '@/lib/auth';
import {
  authenticateUser,
  createEmailTwoFactorChallenge,
  deleteEmailTwoFactorChallenge,
  verifyEmailTwoFactorChallenge,
} from '@/lib/store';
import {
  hashEmailTwoFactorCode,
  isEmailTwoFactorConfigured,
  sendEmailTwoFactorCode,
} from '@/lib/email-2fa';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
  }

  try {
    const body: unknown = await request.json();
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }
    const payload = body as {
      email?: unknown;
      password?: unknown;
      challengeToken?: unknown;
      code?: unknown;
    };

    if (payload.challengeToken !== undefined || payload.code !== undefined) {
      if (
        typeof payload.challengeToken !== 'string'
        || !/^[A-Za-z0-9_-]{40,50}$/.test(payload.challengeToken)
        || typeof payload.code !== 'string'
        || !/^\d{6}$/.test(payload.code)
      ) {
        return NextResponse.json({ error: 'Enter the six-digit verification code.' }, { status: 400 });
      }

      const verifiedUser = await verifyEmailTwoFactorChallenge(
        payload.challengeToken,
        hashEmailTwoFactorCode(payload.challengeToken, payload.code),
      );
      if (!verifiedUser || verifiedUser.role !== 'admin') {
        return NextResponse.json({ error: 'The verification code is invalid or expired.' }, { status: 401 });
      }

      return setSessionCookie(
        NextResponse.json({
          user: {
            id: verifiedUser.id,
            email: verifiedUser.email,
            name: verifiedUser.name,
            role: verifiedUser.role,
          },
        }),
        verifiedUser.id,
      );
    }

    if (typeof payload.email !== 'string' || typeof payload.password !== 'string') {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const email = payload.email?.trim().toLowerCase();
    const password = payload.password;

    if (!email || !password || email.length > 254 || password.length > 1024) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const user = await authenticateUser(email, password);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    if (user.emailTwoFactorEnabled) {
      if (!isEmailTwoFactorConfigured()) {
        return NextResponse.json(
          { error: 'Email verification is not configured. Contact your administrator.' },
          { status: 503 },
        );
      }
      const challengeToken = randomBytes(32).toString('base64url');
      const code = String(randomInt(100_000, 1_000_000));
      await createEmailTwoFactorChallenge(
        user.id,
        challengeToken,
        hashEmailTwoFactorCode(challengeToken, code),
      );
      try {
        await sendEmailTwoFactorCode(user.email, code);
      } catch (mailError) {
        await deleteEmailTwoFactorChallenge(challengeToken);
        console.error('Unable to deliver administrator verification code:', mailError);
        return NextResponse.json(
          { error: 'We could not send a verification code. Please try again later.' },
          { status: 503 },
        );
      }
      return NextResponse.json({
        twoFactorRequired: true,
        challengeToken,
        message: `A verification code was sent to ${user.email}.`,
      });
    }

    const response = NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });

    return setSessionCookie(response, user.id);
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Unable to sign in' }, { status: 500 });
  }
}
