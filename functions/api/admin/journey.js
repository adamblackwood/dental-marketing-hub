// functions/api/admin/journey.js

import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';

const supabaseHeaders = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
};

export async function onRequestGet(context) {
  try {
    const cookie = context.request.headers.get('Cookie') || '';
    if (!cookie.includes('admin_session=true')) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

    const url = new URL(context.request.url);
    const uid = url.searchParams.get('uid');

    if (!uid) return new Response(JSON.stringify({ error: 'Missing uid' }), { status: 400 });

    // 1. جلب ملف الزائر
    const visitorRes = await fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles?uid=eq.${uid}&select=*`, { headers: supabaseHeaders });
    const visitor = (await visitorRes.json())[0] || {};

    // 2. جلب المصادر (Acquisitions)
    const acqRes = await fetch(`${SUPABASE_URL}/rest/v1/acquisitions?uid=eq.${uid}&select=source,utm_campaign,first_visit_at&order=first_visit_at.asc`, { headers: supabaseHeaders });
    const acquisitions = await acqRes.json();

    // 3. جلب الزيارات (Visits)
    const visitsRes = await fetch(`${SUPABASE_URL}/rest/v1/visits?uid=eq.${uid}&select=visit_id,entry_page,exit_page,created_at,duration_sec&order=created_at.asc`, { headers: supabaseHeaders });
    const visits = await visitsRes.json();

    // 4. جلب نشاط الإيميلات (Email Activities)
    const emailRes = await fetch(`${SUPABASE_URL}/rest/v1/email_activities?uid=eq.${uid}&select=campaign_name,first_open_at,last_open_at,open_count&order=first_open_at.asc`, { headers: supabaseHeaders });
    const emails = await emailRes.json();

    // 5. جلب الأحداث (Events)
    const eventsRes = await fetch(`${SUPABASE_URL}/rest/v1/events?uid=eq.${uid}&select=event_type,event_value,created_at&order=created_at.asc`, { headers: supabaseHeaders });
    const events = await eventsRes.json();

    // 6. دمج البيانات في خط زمني واحد (Timeline)
    const timeline = [];

    acquisitions.forEach(a => {
      timeline.push({ time: a.first_visit_at, icon: '🎯', details: `Acquired from <strong>${a.source}</strong> (${a.utm_campaign || 'N/A'})` });
    });

    emails.forEach(e => {
      timeline.push({ time: e.first_open_at, icon: '📧', details: `Opened Cold Email (${e.campaign_name || 'N/A'}) - Total Opens: ${e.open_count}` });
    });

    visits.forEach(v => {
      timeline.push({ time: v.created_at, icon: '👀', details: `Entered site at <strong>${v.entry_page}</strong> (Stayed: ${v.duration_sec}s)` });
    });

    events.forEach(e => {
      let details = '';
      let icon = '⚡';
      if (e.event_type === 'form_submit') { icon = '📝'; details = 'Submitted Form (Lead Captured)'; }
      else if (e.event_type === 'file_download') { icon = '📄'; details = `Downloaded File: ${e.event_value}`; }
      else if (e.event_type === 'affiliate_redirect') { icon = '🔥'; details = `Clicked Affiliate Link (${e.event_value})`; }
      
      if (details) timeline.push({ time: e.created_at, icon: icon, details: details });
    });

    // ترتيب الخط الزمني زمنياً تصاعدياً
    timeline.sort((a, b) => new Date(a.time) - new Date(b.time));

    return new Response(JSON.stringify({ visitor, timeline }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}