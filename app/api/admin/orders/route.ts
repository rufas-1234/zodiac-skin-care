import { NextResponse } from 'next/server';

import { isAdminRequest } from '@/lib/api-auth';
import { listAdminCustomerOrders } from '@/lib/customer-store';

export const runtime = 'nodejs';

export async function GET() {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'Admin sign-in required.' }, { status: 401 });
  }
  try {
    return NextResponse.json({ orders: await listAdminCustomerOrders() }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('Unable to load customer orders in admin:', error);
    return NextResponse.json({ error: 'Unable to load orders.' }, { status: 500 });
  }
}
