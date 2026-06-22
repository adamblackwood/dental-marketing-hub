// functions/api/admin/sessions/index.js
// GET الجلسات

import { SUPABASE_URL, SUPABASE_SERVICE_KEY, ADMIN_PASSWORD } from '../../config.js';

export async function onRequestGet(context) {
  const cookieHeader = context.request.headers.get('cookie') || '';
  if (!cookieHeader.includes(`admin_session=${ADMIN_PASSWORD}`)) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  
  const res = await fetch(`${SUPABASE_URL}/rest/v1/sessions?select=*&order=started_at.desc.nullslast`, {
    headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
  });
  return new Response(JSON.stringify(await res.json()), { headers: { 'Content-Type': 'application/json' } });
}