import { NextResponse } from 'next/server';

import { isAdminRequest, isSameOriginRequest } from '@/lib/api-auth';
import { getSiteContent, saveSiteContent } from '@/lib/store';
import { DEFAULT_SITE_CONTENT } from '@/lib/site-content';

export const runtime = 'nodejs';
const allowedFields = new Set(Object.keys(DEFAULT_SITE_CONTENT));

export async function GET() {
  try {
    return NextResponse.json(await getSiteContent());
  } catch (error) {
    console.error('Unable to load website content:', error);
    return NextResponse.json({ error: 'Unable to load website content' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
  }
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'Admin sign-in required' }, { status: 401 });
  }

  try {
    const body: unknown = await request.json();
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: 'Website content must be an object' }, { status: 400 });
    }

    const payload: Record<string, string> = {};
    for (const [key, value] of Object.entries(body)) {
      const maxLength = key === 'about_team_members' ? 100000 : 10000;
      if (!allowedFields.has(key) || typeof value !== 'string' || value.length > maxLength) {
        return NextResponse.json(
          { error: 'Only supported content fields are accepted; values must be text with at most 10,000 characters.' },
          { status: 400 },
        );
      }
      payload[key] = value;
    }

    if (payload.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.contact_email.trim())) {
      return NextResponse.json({ error: 'Enter a valid contact email address or leave it blank.' }, { status: 400 });
    }
    if (payload.contact_whatsapp && !/^[+\d().\s-]{5,40}$/.test(payload.contact_whatsapp)) {
      return NextResponse.json({ error: 'Enter a valid WhatsApp number with its country code.' }, { status: 400 });
    }
    if (payload.about_team_members !== undefined) {
      let teamMembers: unknown;
      try {
        teamMembers = JSON.parse(payload.about_team_members);
      } catch {
        return NextResponse.json({ error: 'Team members must be valid JSON.' }, { status: 400 });
      }
      if (
        !Array.isArray(teamMembers)
        || teamMembers.length > 30
        || !teamMembers.every((member) =>
          typeof member === 'object'
          && member !== null
          && typeof member.id === 'string'
          && member.id.length > 0
          && member.id.length <= 80
          && typeof member.name === 'string'
          && member.name.trim().length > 0
          && member.name.length <= 100
          && typeof member.role === 'string'
          && member.role.length <= 120
          && typeof member.bio === 'string'
          && member.bio.length <= 1000
          && typeof member.image === 'string'
          && member.image.length <= 2048
        )
      ) {
        return NextResponse.json(
          { error: 'Add up to 30 team members. Each needs a name; role, bio, and photo are optional.' },
          { status: 400 },
        );
      }
    }

    await saveSiteContent(payload);
    return NextResponse.json(await getSiteContent());
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Request must contain valid JSON.' }, { status: 400 });
    }
    console.error('Unable to save website content:', error);
    return NextResponse.json({ error: 'Unable to save website content' }, { status: 500 });
  }
}
