import { NextResponse } from 'next/server';

import { getCurrentCustomer } from '@/lib/customer-auth';
import { isSameOriginRequest } from '@/lib/api-auth';
import { createCustomerOrder, listCustomerOrders } from '@/lib/customer-store';
import { CustomerOrderError, normalizeCustomerPhone } from '@/lib/customer-types';
import { sendOrderConfirmation } from '@/lib/customer-email';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const customer = await getCurrentCustomer();
    if (!customer) return NextResponse.json({ error: 'Customer sign-in required.' }, { status: 401 });
    return NextResponse.json({ orders: await listCustomerOrders(customer.id) }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('Unable to load customer orders:', error);
    return NextResponse.json({ error: 'Unable to load your orders.' }, { status: 500 });
  }
}

function parseOrderInput(value: unknown) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (
    typeof input.contactName !== 'string'
    || typeof input.phone !== 'string'
    || typeof input.addressLine1 !== 'string'
    || typeof input.addressLine2 !== 'string'
    || typeof input.city !== 'string'
    || typeof input.postalCode !== 'string'
    || (input.email !== null && typeof input.email !== 'string')
    || (input.paymentMethod !== 'cash_on_delivery' && input.paymentMethod !== 'mpesa')
    || !Array.isArray(input.items)
    || input.items.length < 1
    || input.items.length > 20
  ) {
    return null;
  }
  const contactName = input.contactName.trim();
  const phone = normalizeCustomerPhone(input.phone);
  const addressLine1 = input.addressLine1.trim();
  const addressLine2 = input.addressLine2.trim();
  const city = input.city.trim();
  const postalCode = input.postalCode.trim();
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  if (
    !contactName || contactName.length > 120
    || !phone
    || !addressLine1 || addressLine1.length > 255
    || addressLine2.length > 255
    || !city || city.length > 120
    || postalCode.length > 32
    || email.length > 254
    || (email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  ) {
    return null;
  }

  const items: Array<{ productId: number; quantity: number }> = [];
  const seenProducts = new Set<number>();
  for (const rawItem of input.items) {
    if (typeof rawItem !== 'object' || rawItem === null || Array.isArray(rawItem)) return null;
    const item = rawItem as { productId?: unknown; quantity?: unknown };
    if (
      typeof item.productId !== 'number'
      || !Number.isSafeInteger(item.productId)
      || item.productId < 1
      || typeof item.quantity !== 'number'
      || !Number.isSafeInteger(item.quantity)
      || item.quantity < 1
      || item.quantity > 20
      || seenProducts.has(item.productId)
    ) {
      return null;
    }
    seenProducts.add(item.productId);
    items.push({ productId: item.productId, quantity: item.quantity });
  }

  return {
    contactName,
    phone,
    email: email || null,
    addressLine1,
    addressLine2,
    city,
    postalCode,
    paymentMethod: input.paymentMethod,
    items,
  } as const;
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }
  try {
    const customer = await getCurrentCustomer();
    if (!customer) return NextResponse.json({ error: 'Sign in to place and manage your order.' }, { status: 401 });
    const input = parseOrderInput(await request.json());
    if (!input) {
      return NextResponse.json({ error: 'Review your contact, delivery, payment, and item details.' }, { status: 400 });
    }
    const order = await createCustomerOrder(customer.id, input);
    if (order.email) {
      try {
        await sendOrderConfirmation(order);
      } catch (emailError) {
        console.error(`Unable to send order confirmation for ${order.orderNumber}:`, emailError);
      }
    }
    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    if (error instanceof CustomerOrderError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Request must contain valid JSON.' }, { status: 400 });
    }
    console.error('Unable to place customer order:', error);
    return NextResponse.json({ error: 'Unable to place your order. Please try again.' }, { status: 500 });
  }
}
