// functions/api/admin/visitors/[id].js
// PATCH تعديل + DELETE حذف

import { SUPABASE_URL, SUPABASE_SERVICE_KEY, ADMIN_PASSWORD } from '../../config.js';

function checkAuth(request) {
  const cookieHeader = request.headers.get('cookie') || '';
  return cookieHeader.includes(`admin_session=${ADMIN_PASSWORD}`);
}

export async function onRequestPatch(context) {
  if (!checkAuth(context.request)) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  const uid = context.params.id;
  const body = await context.request.json();
  
  await fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles?uid=eq.${uid}`, {
    method: 'PATCH',
    headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
}

export async function onRequestDelete(context) {
  if (!checkAuth(context.request)) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  const uid = context.params.id;
  
  await fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles?uid=eq.${uid}`, {
    method: 'DELETE',
    headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
  });
  return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
}