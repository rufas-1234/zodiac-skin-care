import { NextResponse } from 'next/server';

import { isAdminRequest, isSameOriginRequest } from '@/lib/api-auth';
import { CategoryValidationError, parseCategoryInput } from '@/lib/category-validation';
import { CategoryInUseError, deleteCategory, updateCategory } from '@/lib/store';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

function parseId(value: string) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function isDuplicateEntry(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY'
    || error instanceof Error && /unique constraint/i.test(error.message);
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
    return NextResponse.json({ error: 'Category not found' }, { status: 404 });
  }

  try {
    const category = parseCategoryInput(await request.json());
    const updated = await updateCategory(id, category.name, category.slug, category.image);
    return updated
      ? NextResponse.json(updated)
      : NextResponse.json({ error: 'Category not found' }, { status: 404 });
  } catch (error) {
    if (error instanceof CategoryValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (isDuplicateEntry(error)) {
      return NextResponse.json({ error: 'A category with that name already exists.' }, { status: 409 });
    }
    console.error('Unable to update category:', error);
    return NextResponse.json({ error: 'Unable to update category' }, { status: 500 });
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
    return NextResponse.json({ error: 'Category not found' }, { status: 404 });
  }

  try {
    return (await deleteCategory(id))
      ? NextResponse.json({ success: true })
      : NextResponse.json({ error: 'Category not found' }, { status: 404 });
  } catch (error) {
    if (error instanceof CategoryInUseError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error('Unable to delete category:', error);
    return NextResponse.json({ error: 'Unable to delete category' }, { status: 500 });
  }
}
