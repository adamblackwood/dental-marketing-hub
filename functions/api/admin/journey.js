// functions/api/admin/journey.js
// يجمع بيانات ملف الزائر، المصادر، الزيارات، الرحلات (المسارات)، والأحداث لتكوين عرض 360°

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

  const headers = {
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
  };

  try {
    // جلب البيانات من الجداول السبعة بالتوازي لأقصى سرعة
    const [profileRes, acqRes, visitsRes, journeysRes, eventsRes, emailRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles?uid=eq.${uid}&select=*`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/acquisitions?uid=eq.${uid}&select=source,utm_campaign,touch_order,first_visit_at`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/visits?uid=eq.${uid}&select=visit_id,entry_page,exit_page,pages_viewed,duration_sec,is_bounce,started_at&order=started_at.desc.nullslast`, { headers }),
      // جلب الرحلات (المسارات)
      fetch(`${SUPABASE_URL}/rest/v1/visit_journeys?uid=eq.${uid}&select=visit_id,journey`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/events?uid=eq.${uid}&select=event_type,event_value,visit_id,created_at&order=created_at.desc.nullslast`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/email_activities?uid=eq.${uid}&select=campaign_name,open_count,entered_site,created_at`, { headers })
    ]);

    const profile = await profileRes.json();
    const acquisitions = await acqRes.json();
    const visits = await visitsRes.json();
    const journeys = await journeysRes.json();
    const events = await eventsRes.json();
    const email_activities = await emailRes.json();

    return new Response(JSON.stringify({
      profile: profile[0] || null,
      acquisitions,
      visits,
      journeys, // إضافة الرحلات
      events,
      email_activities
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Journey fetch failed' }), { status: 500 });
  }
}