// functions/api/admin/visitors/index.js
import { SUPABASE_URL, SUPABASE_ANON_KEY, ADMIN_PASSWORD } from '../../config.js';

const checkAuth = (request) => {
  const cookie = request.headers.get('Cookie') || '';
  return cookie.includes(`admin_session=${ADMIN_PASSWORD}`);
};

export async function onRequestGet(context) {
  if (!checkAuth(context.request)) return new Response('Unauthorized', { status: 401 });

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles?select=*&order=last_seen_at.desc`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    const data = await res.json();
    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

export async function onRequestPost(context) {
  if (!checkAuth(context.request)) return new Response('Unauthorized', { status: 401 });

  try {
    const body = await context.request.json();
    const res = await fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    return new Response(JSON.stringify(data), { status: 201, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}