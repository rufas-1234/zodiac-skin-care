import { NextResponse } from 'next/server';

import { isAdminRequest, isSameOriginRequest } from '@/lib/api-auth';
import { getCurrentUser } from '@/lib/auth';
import { deleteAdminUser, LastAdminUserError } from '@/lib/store';

export const runtime = 'nodejs';
type Context = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, { params }: Context) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'Admin sign-in required.' }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json({ error: 'Admin account not found.' }, { status: 404 });
  const currentUser = await getCurrentUser();
  if (currentUser?.id === id) return NextResponse.json({ error: 'You cannot delete your own account.' }, { status: 409 });
  try {
    return (await deleteAdminUser(id))
      ? NextResponse.json({ success: true })
      : NextResponse.json({ error: 'Admin account not found.' }, { status: 404 });
  } catch (error) {
    if (error instanceof LastAdminUserError) return NextResponse.json({ error: error.message }, { status: 409 });
    console.error('Unable to delete admin account:', error);
    return NextResponse.json({ error: 'Unable to delete admin account.' }, { status: 500 });
  }
}
