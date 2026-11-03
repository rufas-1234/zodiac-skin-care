import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import {
  createCustomerSession,
  deleteCustomerSession,
  readCustomerBySession,
} from '@/lib/customer-store';

export const CUSTOMER_SESSION_COOKIE = 'zodiac_customer_session';
const CUSTOMER_SESSION_SECONDS = 30 * 24 * 60 * 60;

export async function getCurrentCustomer() {
  const token = (await cookies()).get(CUSTOMER_SESSION_COOKIE)?.value;
  return token ? readCustomerBySession(token) : null;
}

export async function setCustomerSessionCookie(response: NextResponse, customerId: number) {
  const { token, maxAge } = await createCustomerSession(customerId);
  response.cookies.set({
    name: CUSTOMER_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge,
  });
  return response;
}

export async function clearCustomerSessionCookie(response: NextResponse) {
  const token = (await cookies()).get(CUSTOMER_SESSION_COOKIE)?.value;
  if (token) await deleteCustomerSession(token);
  response.cookies.set({
    name: CUSTOMER_SESSION_COOKIE,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
  });
  return response;
}
