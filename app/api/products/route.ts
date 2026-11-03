import { NextResponse } from 'next/server';

import { isAdminRequest, isSameOriginRequest } from '@/lib/api-auth';
import { brandExists, categoryExists, collectionExists, createProduct, readProducts } from '@/lib/store';
import { parseProductInput, ProductValidationError } from '@/lib/product-validation';

export const runtime = 'nodejs';

export async function GET() {
  try {
    return NextResponse.json(await readProducts());
  } catch (error) {
    console.error('Unable to load products:', error);
    return NextResponse.json({ error: 'Unable to load products' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
  }
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'Admin sign-in required' }, { status: 401 });
  }

  try {
    const draft = parseProductInput(await request.json());
    if (!(await categoryExists(draft.category))) {
      return NextResponse.json({ error: 'Choose a category that exists in the store.' }, { status: 400 });
    }
    if (!(await collectionExists(draft.collection))) {
      return NextResponse.json({ error: 'Choose a collection that exists in the store.' }, { status: 400 });
    }
    if (draft.brand && !(await brandExists(draft.brand))) {
      return NextResponse.json({ error: 'Choose a brand that exists in the store.' }, { status: 400 });
    }
    const product = await createProduct(draft);
    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    if (error instanceof ProductValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY') {
      return NextResponse.json({ error: 'A product with that slug already exists.' }, { status: 409 });
    }
    console.error('Unable to create product:', error);
    return NextResponse.json({ error: 'Unable to create product' }, { status: 500 });
  }
}
