// functions/api/admin/analytics.js
// تجميع البيانات للـ KPIs والمخططات

import { SUPABASE_URL, SUPABASE_SERVICE_KEY, ADMIN_PASSWORD } from '../config.js';

function checkAuth(request) {
  const cookieHeader = request.headers.get('cookie') || '';
  return cookieHeader.includes(`admin_session=${ADMIN_PASSWORD}`);
}

export async function onRequestGet(context) {
  if (!checkAuth(context.request)) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const headers = { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` };
  
  try {
    // جلب إحصائيات عامة بسيطة (يمكن تطويرها لاحقاً برسوم بيانية)
    const [visitors, hotLeads, conversions, sessions] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles?select=uid`, { headers }).then(r => r.json()),
      fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles?lead_status=eq.hot&select=uid`, { headers }).then(r => r.json()),
      fetch(`${SUPABASE_URL}/rest/v1/events?event_type=eq.affiliate_redirect&select=event_id`, { headers }).then(r => r.json()),
      fetch(`${SUPABASE_URL}/rest/v1/sessions?select=session_id`, { headers }).then(r => r.json())
    ]);

    const data = {
      total_visitors: visitors.length,
      hot_leads: hotLeads.length,
      total_conversions: conversions.length,
      total_sessions: sessions.length
    };

    return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Analytics fetch failed' }), { status: 500 });
  }
}