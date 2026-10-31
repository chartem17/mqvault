import { NextResponse } from 'next/server';
import { resolvePrivateOwner } from '@/lib/supabase/private-owner';
import { defaultJournalLayout, parseJournalLayout } from '@/lib/journal-layout';
export const dynamic = 'force-dynamic';
function json(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } }); }
function failure(code?: string) { console.error('Journal layout database operation failed', { code }); return json({ error: 'Не вдалося виконати операцію з налаштуваннями журналу' }, 500); }
export async function GET(request: Request) {
  try {
    const owner = await resolvePrivateOwner(request); if (owner instanceof Response) return owner;
    const { data, error } = await owner.db.from('journal_layout_preferences').select('layout,revision').eq('user_id', owner.ownerId).maybeSingle();
    if (error) return failure(error.code);
    return json({ layout: data ? parseJournalLayout(data.layout) : defaultJournalLayout(), revision: data?.revision ?? 0 });
  } catch { return failure(); }
}
export async function PATCH(request: Request) {
  try {
    const owner = await resolvePrivateOwner(request); if (owner instanceof Response) return owner;
    const text = await request.text(); if (text.length > 8192) return json({ error: 'Завеликий запит' }, 413);
    let layout: ReturnType<typeof parseJournalLayout>; let revision: number;
    try {
      const value: unknown = JSON.parse(text);
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
      const body = value as Record<string, unknown>;
      if (Object.keys(body).some(key => !['layout', 'expectedRevision'].includes(key))) throw new Error();
      if (typeof body.expectedRevision !== 'number' || !Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 0 || body.expectedRevision >= 2147483647) throw new Error();
      revision = body.expectedRevision; layout = parseJournalLayout(body.layout);
    } catch { return json({ error: 'Некоректні налаштування журналу' }, 400); }
    const table = owner.db.from('journal_layout_preferences');
    const result = revision === 0
      ? await table.insert({ user_id: owner.ownerId, layout, revision: 1 }).select('layout,revision').single()
      : await table.update({ layout, revision: revision + 1, updated_at: new Date().toISOString() }).eq('user_id', owner.ownerId).eq('revision', revision).select('layout,revision').maybeSingle();
    if (result.error && result.error.code !== '23505') return failure(result.error.code);
    if (result.error || !result.data) return json({ error: 'Налаштування змінено в іншій вкладці. Перечитайте їх перед збереженням.', code: 'revision_conflict' }, 409);
    return json({ layout: parseJournalLayout(result.data.layout), revision: result.data.revision });
  } catch { return failure(); }
}
