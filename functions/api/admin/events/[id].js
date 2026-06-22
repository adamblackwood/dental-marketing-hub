// functions/api/admin/events/[id].js
// DELETE حذف حدث

import { SUPABASE_URL, SUPABASE_SERVICE_KEY, ADMIN_PASSWORD } from '../../config.js';

export async function onRequestDelete(context) {
  const cookieHeader = context.request.headers.get('cookie') || '';
  if (!cookieHeader.includes(`admin_session=${ADMIN_PASSWORD}`)) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  
  const eventId = context.params.id;
  await fetch(`${SUPABASE_URL}/rest/v1/events?event_id=eq.${eventId}`, {
    method: 'DELETE',
    headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
  });
  return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
}