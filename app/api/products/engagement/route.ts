import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';

import { isSameOriginRequest } from '@/lib/api-auth';
import { readProductById, recordProductView } from '@/lib/store';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
  }

  try {
    const body: unknown = await request.json();
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid engagement data' }, { status: 400 });
    }

    const input = body as Record<string, unknown>;
    const productId = input.productId;
    const visitId = input.visitId;
    const durationSeconds = input.durationSeconds;
    if (
      typeof productId !== 'number' ||
      !Number.isSafeInteger(productId) ||
      productId < 1 ||
      typeof visitId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(visitId) ||
      typeof durationSeconds !== 'number' ||
      !Number.isInteger(durationSeconds) ||
      durationSeconds < 0 ||
      durationSeconds > 86_400
    ) {
      return NextResponse.json({ error: 'Invalid engagement data' }, { status: 400 });
    }

    if (!(await readProductById(productId))) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const eventHash = createHash('sha256').update(visitId).digest('hex');
    await recordProductView(productId, eventHash, durationSeconds);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unable to record product engagement:', error);
    return NextResponse.json({ error: 'Unable to record product engagement' }, { status: 500 });
  }
}
