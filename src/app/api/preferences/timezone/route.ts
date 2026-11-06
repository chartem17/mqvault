import { NextResponse } from 'next/server';
import { resolvePrivateOwner } from '@/lib/supabase/private-owner';
import { isValidTimeZone } from '@/lib/timezone';
export const dynamic = 'force-dynamic';
function json(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } }); }
function failure(code?: string) { console.error('Timezone preference database operation failed', { code }); return json({ error: 'Time zone operation failed' }, 500); }

/** The owner's display time zone, or null when it was never chosen (the client then uses the browser zone). */
export async function GET(request: Request) {
  try {
    const owner = await resolvePrivateOwner(request); if (owner instanceof Response) return owner;
    const { data, error } = await owner.db.from('app_users').select('timezone').eq('id', owner.ownerId).maybeSingle();
    if (error) return failure(error.code);
    const timezone = typeof data?.timezone === 'string' && isValidTimeZone(data.timezone) ? data.timezone : null;
    return json({ timezone });
  } catch { return failure(); }
}

export async function PATCH(request: Request) {
  try {
    const owner = await resolvePrivateOwner(request); if (owner instanceof Response) return owner;
    const text = await request.text(); if (text.length > 512) return json({ error: 'Request too large' }, 413);
    let timezone: string;
    try {
      const value: unknown = JSON.parse(text);
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
      const body = value as Record<string, unknown>;
      if (Object.keys(body).some(key => key !== 'timezone')) throw new Error();
      if (typeof body.timezone !== 'string' || body.timezone.length > 64 || !isValidTimeZone(body.timezone)) throw new Error();
      timezone = body.timezone;
    } catch { return json({ error: 'Invalid time zone' }, 400); }
    const { data, error } = await owner.db.from('app_users').update({ timezone, updated_at: new Date().toISOString() }).eq('id', owner.ownerId).select('timezone').maybeSingle();
    if (error) return failure(error.code);
    if (!data) return json({ error: 'Owner not found' }, 404);
    return json({ timezone: data.timezone });
  } catch { return failure(); }
}
