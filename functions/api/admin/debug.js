// functions/api/admin/debug.js
// واجهة فحص النظام الشاملة: تجلب البيانات من الجداول السبعة دفعة واحدة

import { SUPABASE_URL, SUPABASE_SERVICE_KEY, ADMIN_PASSWORD } from '../config.js';

function checkAuth(request) {
  const cookieHeader = request.headers.get('cookie') || '';
  return cookieHeader.includes(`admin_session=${ADMIN_PASSWORD}`);
}

export async function onRequestGet(context) {
  if (!checkAuth(context.request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const url = new URL(context.request.url);
  const uid = url.searchParams.get('uid');
  if (!uid) return new Response(JSON.stringify({ error: 'Missing uid' }), { status: 400 });

  const headers = { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` };

  try {
    const [profileRes, acqRes, visitsRes, sessionsRes, journeysRes, emailRes, eventsRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles?uid=eq.${uid}&select=*`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/acquisitions?uid=eq.${uid}&select=*`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/visits?uid=eq.${uid}&select=*&order=started_at.desc.nullslast`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/sessions?uid=eq.${uid}&select=*&order=started_at.desc.nullslast`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/visit_journeys?uid=eq.${uid}&select=*`, { headers }), // إضافة الرحلات
      fetch(`${SUPABASE_URL}/rest/v1/email_activities?uid=eq.${uid}&select=*`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/events?uid=eq.${uid}&select=*&order=created_at.desc.nullslast`, { headers })
    ]);

    const debugData = {
      profile: (await profileRes.json())[0] || null,
      acquisitions: await acqRes.json() || [],
      visits: await visitsRes.json() || [],
      sessions: await sessionsRes.json() || [],
      journeys: await journeysRes.json() || [], // الرحلات
      email_activities: await emailRes.json() || [],
      events: await eventsRes.json() || []
    };

    return new Response(JSON.stringify(debugData), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Debug fetch failed', details: err.message }), { status: 500 });
  }
}