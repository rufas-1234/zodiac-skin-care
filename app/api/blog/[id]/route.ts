import { NextResponse } from 'next/server';

import { CatalogValidationError, isDuplicateCatalogEntry, parseBlogPostInput } from '@/lib/catalog-validation';
import { isAdminRequest, isSameOriginRequest } from '@/lib/api-auth';
import { deleteBlogPost, updateBlogPost } from '@/lib/store';

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
  if (!id) return NextResponse.json({ error: 'Blog post not found.' }, { status: 404 });
  try {
    return (await updateBlogPost(id, parseBlogPostInput(await request.json())))
      ? NextResponse.json({ success: true })
      : NextResponse.json({ error: 'Blog post not found.' }, { status: 404 });
  } catch (error) {
    if (error instanceof CatalogValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (isDuplicateCatalogEntry(error)) return NextResponse.json({ error: 'A blog post with that title already exists.' }, { status: 409 });
    console.error('Unable to update blog post:', error);
    return NextResponse.json({ error: 'Unable to update blog post.' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Context) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'Admin sign-in required.' }, { status: 401 });
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: 'Blog post not found.' }, { status: 404 });
  try {
    return (await deleteBlogPost(id))
      ? NextResponse.json({ success: true })
      : NextResponse.json({ error: 'Blog post not found.' }, { status: 404 });
  } catch (error) {
    console.error('Unable to delete blog post:', error);
    return NextResponse.json({ error: 'Unable to delete blog post.' }, { status: 500 });
  }
}
