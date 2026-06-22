// functions/api/admin/journey.js
// دمج البيانات في خط زمني 360° للزائر الواحد

import { SUPABASE_URL, SUPABASE_SERVICE_KEY, ADMIN_PASSWORD } from '../config.js';

function checkAuth(request) {
  const cookieHeader = request.headers.get('cookie') || '';
  return cookieHeader.includes(`admin_session=${ADMIN_PASSWORD}`);
}

export async function onRequestGet(context) {
  if (!checkAuth(context.request)) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const url = new URL(context.request.url);
  const uid = url.searchParams.get('uid');
  if (!uid) return new Response(JSON.stringify({ error: 'Missing uid' }), { status: 400 });

  const headers = { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` };

  try {
    const [profile, acquisitions, sessions, events] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles?uid=eq.${uid}&select=*`, { headers }).then(r => r.json()),
      fetch(`${SUPABASE_URL}/rest/v1/acquisitions?uid=eq.${uid}&select=*`, { headers }).then(r => r.json()),
      fetch(`${SUPABASE_URL}/rest/v1/sessions?uid=eq.${uid}&select=*&order=started_at.desc.nullslast`, { headers }).then(r => r.json()),
      fetch(`${SUPABASE_URL}/rest/v1/events?uid=eq.${uid}&select=*&order=created_at.desc.nullslast`, { headers }).then(r => r.json())
    ]);

    return new Response(JSON.stringify({
      profile: profile[0] || null,
      acquisitions,
      sessions,
      events
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Journey fetch failed' }), { status: 500 });
  }
}