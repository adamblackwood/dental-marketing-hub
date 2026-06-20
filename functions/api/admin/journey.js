// functions/api/admin/journey.js

import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';

const supabaseHeaders = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
};

export async function onRequestGet(context) {
  try {
    // التحقق من الأمان
    const cookie = context.request.headers.get('Cookie') || '';
    if (!cookie.includes('admin_session=true')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const url = new URL(context.request.url);
    const fp = url.searchParams.get('fp');

    if (!fp) return new Response(JSON.stringify({ error: 'Missing fingerprint' }), { status: 400 });

    // 1. جلب بيانات الزائر الأساسية
    const visitorRes = await fetch(`${SUPABASE_URL}/rest/v1/visitors?fingerprint_id=eq.${fp}&select=*`, { headers: supabaseHeaders });
    const visitorData = (await visitorRes.json())[0] || {};

    // 2. جلب كل الجلسات (ترتيب تصاعدي)
    const sessionsRes = await fetch(`${SUPABASE_URL}/rest/v1/sessions?fingerprint_id=eq.${fp}&select=session_id,entry_page,exit_page,duration_sec,max_scroll_pct,started_at&order=started_at.asc`, { headers: supabaseHeaders });
    const sessionsData = await sessionsRes.json();

    // 3. جلب كل الأحداث (ترتيب تصاعدي)
    const eventsRes = await fetch(`${SUPABASE_URL}/rest/v1/events?fingerprint_id=eq.${fp}&select=event_type,event_value,created_at&order=created_at.asc`, { headers: supabaseHeaders });
    const eventsData = await eventsRes.json();

    // 4. دمج البيانات في خط زمني واحد (Timeline Array)
    const timeline = [];

    sessionsData.forEach(s => {
      timeline.push({
        type: 'session',
        time: s.started_at,
        icon: '👀',
        details: `Entered <strong>${s.entry_page}</strong> | Stayed: ${s.duration_sec}s | Scroll: ${s.max_scroll_pct}%`
      });
    });

    eventsData.forEach(e => {
      let details = '';
      let icon = '⚡';
      if (e.event_type === 'email_open') { icon = '📧'; details = 'Opened Cold Email'; }
      else if (e.event_type === 'form_submit') { icon = '📝'; details = 'Submitted Form (Lead)'; }
      else if (e.event_type === 'affiliate_redirect') { icon = '🔥'; details = 'Clicked Affiliate Link (GHL)'; }
      else if (e.event_type === 'file_download') { icon = '📄'; details = 'Downloaded File'; }
      
      timeline.push({
        type: 'event',
        time: e.created_at,
        icon: icon,
        details: details
      });
    });

    // ترتيب الخط الزمني بشكل نهائي من الأقدم للأحدث
    timeline.sort((a, b) => new Date(a.time) - new Date(b.time));

    return new Response(JSON.stringify({ visitor: visitorData, timeline }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}