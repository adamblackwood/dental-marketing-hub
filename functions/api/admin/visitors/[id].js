// functions/api/admin/visitors/[id].js
import { SUPABASE_URL, SUPABASE_ANON_KEY, ADMIN_PASSWORD } from '../../config.js';

const checkAuth = (request) => {
  const cookie = request.headers.get('Cookie') || '';
  return cookie.includes(`admin_session=${ADMIN_PASSWORD}`);
};

export async function onRequestPatch(context) {
  if (!checkAuth(context.request)) return new Response('Unauthorized', { status: 401 });
  
  const uid = context.params.id;
  try {
    const body = await context.request.json();
    delete body.uid; // Prevent PK overwrite

    const res = await fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles?uid=eq.${uid}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

export async function onRequestDelete(context) {
  if (!checkAuth(context.request)) return new Response('Unauthorized', { status: 401 });
  
  const uid = context.params.id;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles?uid=eq.${uid}`, {
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