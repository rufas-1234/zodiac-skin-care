import { NextResponse } from 'next/server';

import { isAdminRequest, isSameOriginRequest } from '@/lib/api-auth';
import { CategoryValidationError, parseCategoryInput } from '@/lib/category-validation';
import { createCategory, readCategories } from '@/lib/store';

export const runtime = 'nodejs';

function isDuplicateEntry(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY'
    || error instanceof Error && /unique constraint/i.test(error.message);
}

export async function GET() {
  try {
    return NextResponse.json(await readCategories());
  } catch (error) {
    console.error('Unable to load categories:', error);
    return NextResponse.json({ error: 'Unable to load categories' }, { status: 500 });
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
    const category = parseCategoryInput(await request.json());
    return NextResponse.json(
      await createCategory(category.name, category.slug, category.image),
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof CategoryValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (isDuplicateEntry(error)) {
      return NextResponse.json({ error: 'A category with that name already exists.' }, { status: 409 });
    }
    console.error('Unable to create category:', error);
    return NextResponse.json({ error: 'Unable to create category' }, { status: 500 });
  }
}
