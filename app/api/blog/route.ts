import { NextResponse } from 'next/server';

import { CatalogValidationError, isDuplicateCatalogEntry, parseBlogPostInput } from '@/lib/catalog-validation';
import { isAdminRequest, isSameOriginRequest } from '@/lib/api-auth';
import { createBlogPost, readBlogPosts } from '@/lib/store';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const includeDrafts = new URL(request.url).searchParams.get('admin') === '1';
    if (includeDrafts && !(await isAdminRequest())) {
      return NextResponse.json({ error: 'Admin sign-in required.' }, { status: 401 });
    }
    return NextResponse.json(await readBlogPosts(includeDrafts));
  } catch (error) {
    console.error('Unable to load blog posts:', error);
    return NextResponse.json({ error: 'Unable to load blog posts.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'Admin sign-in required.' }, { status: 401 });
  try {
    return NextResponse.json(await createBlogPost(parseBlogPostInput(await request.json())), { status: 201 });
  } catch (error) {
    if (error instanceof CatalogValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (isDuplicateCatalogEntry(error)) return NextResponse.json({ error: 'A blog post with that title already exists.' }, { status: 409 });
    console.error('Unable to create blog post:', error);
    return NextResponse.json({ error: 'Unable to create blog post.' }, { status: 500 });
  }
}
