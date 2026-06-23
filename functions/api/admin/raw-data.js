// functions/api/admin/raw-data.js
import { SUPABASE_URL, SUPABASE_ANON_KEY, ADMIN_PASSWORD } from '../config.js';

const checkAuth = (request) => {
  const cookie = request.headers.get('Cookie') || '';
  return cookie.includes(`admin_session=${ADMIN_PASSWORD}`);
};

const TABLE_MAP = {
  'visitor_profiles': 'uid',
  'acquisitions': 'acquisition_id',
  'visits': 'visit_id',
  'sessions': 'session_id',
  'visit_journeys': 'visit_id',
  'events': 'event_id',
  'email_activities': 'email_activity_id'
};

export async function onRequestGet(context) {
  if (!checkAuth(context.request)) return new Response('Unauthorized', { status: 401 });

  const url = new URL(context.request.url);
  const table = url.searchParams.get('table');
  const page = parseInt(url.searchParams.get('page') || '1', 10);

  if (!table || !TABLE_MAP[table]) {
    return new Response(JSON.stringify({ error: 'Invalid table name' }), { status: 400 });
  }

  const limit = 20;
  const start = (page - 1) * limit;
  const end = start + limit - 1;

  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Prefer': 'count=exact',
    'Range': `${start}-${end}`
  };

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?order=${TABLE_MAP[table]}.desc`, { headers });
    const data = await res.json();
    const contentRange = res.headers.get('content-range') || `0-0/0`;
    const totalItems = parseInt(contentRange.split('/')[1] || '0', 10);
    const totalPages = Math.ceil(totalItems / limit);

    return new Response(JSON.stringify({
      data,
      pagination: {
        totalItems,
        currentPage: page,
        totalPages
      }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

export async function onRequestPatch(context) {
  if (!checkAuth(context.request)) return new Response('Unauthorized', { status: 401 });

  const url = new URL(context.request.url);
  const table = url.searchParams.get('table');
  const id = url.searchParams.get('id');

  if (!table || !TABLE_MAP[table] || !id) {
    return new Response(JSON.stringify({ error: 'Missing table or id' }), { status: 400 });
  }

  try {
    const body = await context.request.json();
    const pk = TABLE_MAP[table];
    
    // Remove primary key from body before updating
    delete body[pk];

    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${pk}=eq.${id}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    return new Response(JSON.stringify({ success: true, data }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

export async function onRequestDelete(context) {
  if (!checkAuth(context.request)) return new Response('Unauthorized', { status: 401 });

  const url = new URL(context.request.url);
  const table = url.searchParams.get('table');
  const id = url.searchParams.get('id');

  if (!table || !TABLE_MAP[table] || !id) {
    return new Response(JSON.stringify({ error: 'Missing table or id' }), { status: 400 });
  }

  try {
    const pk = TABLE_MAP[table];
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${pk}=eq.${id}`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}