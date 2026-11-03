import { NextResponse } from 'next/server';

import { CatalogValidationError, isDuplicateCatalogEntry, parseCatalogResource } from '@/lib/catalog-validation';
import { isAdminRequest, isSameOriginRequest } from '@/lib/api-auth';
import { createCollection, readCollections } from '@/lib/store';

export const runtime = 'nodejs';

export async function GET() {
  try {
    return NextResponse.json(await readCollections());
  } catch (error) {
    console.error('Unable to load collections:', error);
    return NextResponse.json({ error: 'Unable to load collections.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'Admin sign-in required.' }, { status: 401 });
  try {
    return NextResponse.json(await createCollection(parseCatalogResource(await request.json())), { status: 201 });
  } catch (error) {
    if (error instanceof CatalogValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (isDuplicateCatalogEntry(error)) return NextResponse.json({ error: 'A collection with that name already exists.' }, { status: 409 });
    console.error('Unable to create collection:', error);
    return NextResponse.json({ error: 'Unable to create collection.' }, { status: 500 });
  }
}
