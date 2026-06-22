// functions/api/admin/analytics.js
// تجميع البيانات للـ KPIs والمخططات بناءً على هيكلية V4.0

import { SUPABASE_URL, SUPABASE_SERVICE_KEY, ADMIN_PASSWORD } from '../config.js';

function checkAuth(request) {
  const cookieHeader = request.headers.get('cookie') || '';
  return cookieHeader.includes(`admin_session=${ADMIN_PASSWORD}`);
}

export async function onRequestGet(context) {
  if (!checkAuth(context.request)) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const headers = { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` };

  try {
    // 1. إجمالي الزوار (الملفات الشخصية)
    const pRes = await fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles?select=uid`, { headers });
    const total_visitors = (await pRes.json()).length;

    // 2. العملاء الساخنين
    const hRes = await fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles?lead_status=eq.hot&select=uid`, { headers });
    const hot_leads = (await hRes.json()).length;

    // 3. إجمالي الزيارات (حسب قاعدة الـ 30 دقيقة - من جدول visits)
    const vRes = await fetch(`${SUPABASE_URL}/rest/v1/visits?select=visit_id`, { headers });
    const total_visits = (await vRes.json()).length;

    // 4. إجمالي التحويلات التجارية (من جدول events للأحداث المحددة)
    const cRes = await fetch(`${SUPABASE_URL}/rest/v1/events?or=(event_type.eq.file_download,event_type.eq.form_submit,event_type.eq.affiliate_click)&select=event_id`, { headers });
    const total_conversions = (await cRes.json()).length;

    return new Response(JSON.stringify({
      total_visitors,
      hot_leads,
      total_visits,
      total_conversions
    }), { headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Analytics fetch failed' }), { status: 500 });
  }
}