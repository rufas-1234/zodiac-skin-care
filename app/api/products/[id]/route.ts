import { NextResponse } from 'next/server';

import { isAdminRequest, isSameOriginRequest } from '@/lib/api-auth';
import { brandExists, categoryExists, collectionExists, deleteProduct, readProductById, updateProduct } from '@/lib/store';
import { parseProductInput, ProductValidationError } from '@/lib/product-validation';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

function parseId(value: string) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { id: rawId } = await params;
  const id = parseId(rawId);
  if (!id) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  try {
    const product = await readProductById(id);
    return product
      ? NextResponse.json(product)
      : NextResponse.json({ error: 'Product not found' }, { status: 404 });
  } catch (error) {
    console.error('Unable to load product:', error);
    return NextResponse.json({ error: 'Unable to load product' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: RouteContext) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
  }
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'Admin sign-in required' }, { status: 401 });
  }

  const { id: rawId } = await params;
  const id = parseId(rawId);
  if (!id) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  try {
    const existing = await readProductById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const product = parseProductInput(await request.json(), existing);
    if (!(await categoryExists(product.category))) {
      return NextResponse.json({ error: 'Choose a category that exists in the store.' }, { status: 400 });
    }
    if (!(await collectionExists(product.collection))) {
      return NextResponse.json({ error: 'Choose a collection that exists in the store.' }, { status: 400 });
    }
    if (product.brand && !(await brandExists(product.brand))) {
      return NextResponse.json({ error: 'Choose a brand that exists in the store.' }, { status: 400 });
    }
    await updateProduct(id, product);
    return NextResponse.json({ id, ...product });
  } catch (error) {
    if (error instanceof ProductValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY') {
      return NextResponse.json({ error: 'A product with that slug already exists.' }, { status: 409 });
    }
    console.error('Unable to update product:', error);
    return NextResponse.json({ error: 'Unable to update product' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
  }
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'Admin sign-in required' }, { status: 401 });
  }

  const { id: rawId } = await params;
  const id = parseId(rawId);
  if (!id) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  try {
    return (await deleteProduct(id))
      ? NextResponse.json({ success: true })
      : NextResponse.json({ error: 'Product not found' }, { status: 404 });
  } catch (error) {
    console.error('Unable to delete product:', error);
    return NextResponse.json({ error: 'Unable to delete product' }, { status: 500 });
  }
}
