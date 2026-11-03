import { NextResponse } from 'next/server';

import { CatalogValidationError, isDuplicateCatalogEntry, parseBrandInput } from '@/lib/catalog-validation';
import { isAdminRequest, isSameOriginRequest } from '@/lib/api-auth';
import { createBrand, readBrands } from '@/lib/store';

export const runtime = 'nodejs';

export async function GET() {
  try {
    return NextResponse.json(await readBrands());
  } catch (error) {
    console.error('Unable to load brands:', error);
    return NextResponse.json({ error: 'Unable to load brands.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'Admin sign-in required.' }, { status: 401 });
  try {
    return NextResponse.json(await createBrand(parseBrandInput(await request.json())), { status: 201 });
  } catch (error) {
    if (error instanceof CatalogValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (isDuplicateCatalogEntry(error)) return NextResponse.json({ error: 'A brand with that name already exists.' }, { status: 409 });
    console.error('Unable to create brand:', error);
    return NextResponse.json({ error: 'Unable to create brand.' }, { status: 500 });
  }
}
