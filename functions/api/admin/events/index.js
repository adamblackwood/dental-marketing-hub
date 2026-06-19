// functions/api/admin/events/index.js

import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../../config.js';

const supabaseHeaders = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
};

export async function onRequestGet(context) {
  try {
    const cookie = context.request.headers.get('Cookie') || '';
    if (!cookie.includes('admin_session=true')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const url = new URL(context.request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = 25;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const res = await fetch(`${SUPABASE_URL}/rest/v1/events?select=event_id,fingerprint_id,event_type,event_value,created_at&order=created_at.desc&offset=${from}&limit=${limit}`, {
      headers: { ...supabaseHeaders, 'Prefer': 'count=exact' }
    });

    const contentRange = res.headers.get('content-range');
    const total = contentRange ? parseInt(contentRange.split('/')[1]) : 0;
    const data = await res.json();

    return new Response(JSON.stringify({ data, total, page, limit }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}