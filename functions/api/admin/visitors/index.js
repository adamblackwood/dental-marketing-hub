// functions/api/admin/visitors/index.js
// GET جميع الزوار + POST إضافة زائر

import { SUPABASE_URL, SUPABASE_SERVICE_KEY, ADMIN_PASSWORD } from '../../config.js';

function checkAuth(request) {
  const cookieHeader = request.headers.get('cookie') || '';
  return cookieHeader.includes(`admin_session=${ADMIN_PASSWORD}`);
}

export async function onRequestGet(context) {
  if (!checkAuth(context.request)) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles?select=*&order=last_seen_at.desc.nullslast`, {
    headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
  });
  const data = await res.json();
  return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
}

export async function onRequestPost(context) {
  if (!checkAuth(context.request)) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  const body = await context.request.json();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  return new Response(JSON.stringify(data), { status: 201, headers: { 'Content-Type': 'application/json' } });
}