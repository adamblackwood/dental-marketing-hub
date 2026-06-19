// functions/api/admin/analytics.js

import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';

const supabaseHeaders = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
};

// دالة مساعدة لجلب العدد الإجمالي بدون تحميل البيانات
async function getCount(table, query = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: { ...supabaseHeaders, 'Prefer': 'count=exact', 'Range': '0-0' }
  });
  const contentRange = res.headers.get('content-range');
  return contentRange ? parseInt(contentRange.split('/')[1]) : 0;
}

export async function onRequestGet(context) {
  try {
    const cookie = context.request.headers.get('Cookie') || '';
    if (!cookie.includes('admin_session=true')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const url = new URL(context.request.url);
    const range = url.searchParams.get('range') || '7d';

    // حساب التواريخ
    const now = new Date();
    let fromDate = new Date();
    if (range === '1d') fromDate.setDate(now.getDate() - 1);
    else if (range === '7d') fromDate.setDate(now.getDate() - 7);
    else if (range === '30d') fromDate.setDate(now.getDate() - 30);
    else fromDate = new Date('2020-01-01'); // All time

    const isoFrom = fromDate.toISOString();

    // 1. جلب الأرقام الرئيسية (KPIs)
    const totalVisits = await getCount('sessions', `started_at=gte.${isoFrom}`);
    const totalVisitors = await getCount('visitors', `last_seen_at=gte.${isoFrom}`);
    const totalLeads = await getCount('visitors', `identified_email=not.is.null&last_seen_at=gte.${isoFrom}`);
    const totalClicks = await getCount('events', `event_type=eq.affiliate_redirect&created_at=gte.${isoFrom}`);
    
    // حساب الـ Bounce Rate
    const totalBounces = await getCount('sessions', `is_bounce=eq.true&started_at=gte.${isoFrom}`);
    const bounceRate = totalVisits > 0 ? Math.round((totalBounces / totalVisits) * 100) : 0;

    // 2. جلب بيانات المخطط الزمني (آخر 7 أيام دائماً للرسم البياني)
    const chartDays = 7;
    const chartFromDate = new Date();
    chartFromDate.setDate(now.getDate() - chartDays);
    const chartIsoFrom = chartFromDate.toISOString();

    const chartRes = await fetch(`${SUPABASE_URL}/rest/v1/sessions?select=started_at&started_at=gte.${chartIsoFrom}`, {
      headers: supabaseHeaders
    });
    const sessionsData = await chartRes.json();

    // تجميع البيانات يومياً (Grouping in JS because PostgREST doesn't support Group By natively)
    const dailyData = {};
    for (let i = 0; i < chartDays; i++) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const key = d.toISOString().split('T')[0]; // YYYY-MM-DD
      dailyData[key] = 0;
    }

    sessionsData.forEach(s => {
      const dayKey = s.started_at.split('T')[0];
      if (dailyData[dayKey] !== undefined) {
        dailyData[dayKey]++;
      }
    });

    // تحويل الكائن إلى Array للـ Frontend وترتيبه زمنياً
    const chartArray = Object.entries(dailyData).map(([date, count]) => ({
      date: date.substring(5), // MM-DD
      visits: count
    })).reverse();

    return new Response(JSON.stringify({ 
      kpis: { totalVisits, totalVisitors, totalLeads, totalClicks, bounceRate },
      chart: chartArray
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}