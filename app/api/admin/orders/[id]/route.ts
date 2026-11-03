import { NextResponse } from 'next/server';

import { isAdminRequest, isSameOriginRequest } from '@/lib/api-auth';
import { updateCustomerOrderStatus, listAdminCustomerOrders } from '@/lib/customer-store';
import { CustomerOrderError } from '@/lib/customer-types';
import { sendOrderStatusUpdate } from '@/lib/customer-email';

export const runtime = 'nodejs';

export async function PATCH(
  request: Request,
  context: RouteContext<'/api/admin/orders/[id]'>,
) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'Admin sign-in required.' }, { status: 401 });
  }

  try {
    const id = Number((await context.params).id);
    if (!Number.isSafeInteger(id) || id < 1) {
      return NextResponse.json({ error: 'Invalid order.' }, { status: 400 });
    }
    const body: unknown = await request.json();
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid order update.' }, { status: 400 });
    }
    const update = body as { status?: unknown; paymentStatus?: unknown };
    const allowedStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    const allowedPaymentStatuses = ['pending', 'paid', 'failed', 'refunded'];
    if (
      typeof update.status !== 'string'
      || !allowedStatuses.includes(update.status)
      || typeof update.paymentStatus !== 'string'
      || !allowedPaymentStatuses.includes(update.paymentStatus)
    ) {
      return NextResponse.json({ error: 'Choose a valid order and payment status.' }, { status: 400 });
    }

    if (!(await updateCustomerOrderStatus(id, update.status, update.paymentStatus))) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    const changedOrder = (await listAdminCustomerOrders()).find((order) => order.id === id);
    if (changedOrder?.email) {
      try {
        await sendOrderStatusUpdate(changedOrder);
      } catch (emailError) {
        console.error(`Unable to send status update for ${changedOrder.orderNumber}:`, emailError);
      }
    }
    return NextResponse.json({ order: changedOrder ?? null });
  } catch (error) {
    if (error instanceof CustomerOrderError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Request must contain valid JSON.' }, { status: 400 });
    }
    console.error('Unable to update customer order:', error);
    return NextResponse.json({ error: 'Unable to update order.' }, { status: 500 });
  }
}
