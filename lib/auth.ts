import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { createAdminSession, deleteAdminSession, readUserBySession } from '@/lib/store';
import { SESSION_IDLE_TIMEOUT_SECONDS } from '@/lib/auth-constants';

export const SESSION_COOKIE = 'zodiac_session';

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  return token ? readUserBySession(token) : null;
}

export async function setSessionCookie(response: NextResponse, userId: number) {
  const { token, maxAge } = await createAdminSession(userId);
  response.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge,
  });

  return response;
}

export function refreshSessionCookie(response: NextResponse, token: string) {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_IDLE_TIMEOUT_SECONDS,
  });
  return response;
}

export async function clearSessionCookie(response: NextResponse) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await deleteAdminSession(token);
  }

  response.cookies.set({
    name: SESSION_COOKIE,
    value: '',
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
  });

  return response;
}
