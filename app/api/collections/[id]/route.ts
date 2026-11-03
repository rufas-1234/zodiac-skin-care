import { NextResponse } from 'next/server';

import { CatalogValidationError, isDuplicateCatalogEntry, parseCatalogResource } from '@/lib/catalog-validation';
import { isAdminRequest, isSameOriginRequest } from '@/lib/api-auth';
import { CatalogResourceInUseError, deleteCollection, updateCollection } from '@/lib/store';

export const runtime = 'nodejs';
type Context = { params: Promise<{ id: string }> };
function parseId(value: string) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function PUT(request: Request, { params }: Context) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'Admin sign-in required.' }, { status: 401 });
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: 'Collection not found.' }, { status: 404 });
  try {
    const updated = await updateCollection(id, parseCatalogResource(await request.json()));
    return updated ? NextResponse.json(updated) : NextResponse.json({ error: 'Collection not found.' }, { status: 404 });
  } catch (error) {
    if (error instanceof CatalogValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (isDuplicateCatalogEntry(error)) return NextResponse.json({ error: 'A collection with that name already exists.' }, { status: 409 });
    console.error('Unable to update collection:', error);
    return NextResponse.json({ error: 'Unable to update collection.' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Context) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'Admin sign-in required.' }, { status: 401 });
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: 'Collection not found.' }, { status: 404 });
  try {
    return (await deleteCollection(id))
      ? NextResponse.json({ success: true })
      : NextResponse.json({ error: 'Collection not found.' }, { status: 404 });
  } catch (error) {
    if (error instanceof CatalogResourceInUseError) return NextResponse.json({ error: error.message }, { status: 409 });
    console.error('Unable to delete collection:', error);
    return NextResponse.json({ error: 'Unable to delete collection.' }, { status: 500 });
  }
}
