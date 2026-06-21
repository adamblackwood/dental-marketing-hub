// functions/api/open/[uid].js

import { SUPABASE_URL, SUPABASE_ANON_KEY, TELEGRAM_TOKEN, TELEGRAM_CHAT_ID } from '../../config.js';

const supabaseHeaders = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal'
};

const transparentGif = atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');

function parseUserAgent(ua) {
  const device_type = /Mobi|Android|iPhone/i.test(ua) ? 'mobile' : (/iPad|Tablet/i.test(ua) ? 'tablet' : 'desktop');
  let operating_system = 'other';
  if (/Windows/i.test(ua)) operating_system = 'windows';
  else if (/Mac OS/i.test(ua)) operating_system = 'macos';
  else if (/Android/i.test(ua)) operating_system = 'android';
  else if (/iPhone|iPad|iPod/i.test(ua)) operating_system = 'ios';
  return { device_type, operating_system };
}

export async function onRequestGet(context) {
  try {
    const uid = context.params.uid;
    if (!uid) return new Response(transparentGif, { headers: { 'Content-Type': 'image/gif' } });

    const cf = context.request.cf || {};
    const country = cf.country || 'Unknown';
    const city = cf.city || 'Unknown';
    const userAgent = context.request.headers.get('User-Agent') || 'Unknown';
    const deviceInfo = parseUserAgent(userAgent);

    // 1. جلب بيانات الزائر لمعرفة الإيميل والاسم (للتليجرام)
    const visitorRes = await fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles?uid=eq.${uid}&select=identified_name,identified_email`, { headers: supabaseHeaders });
    const visitor = (await visitorRes.json())[0] || {};

    // 2. Upsert لجدول نشاط الإيميلات
    const emailActivityData = {
      uid: uid,
      campaign_name: 'cold_outreach', // افتراضي، يمكن تمريره كـ Query Param لاحقاً
      email_address: visitor.identified_email || null,
      first_open_at: new Date().toISOString(),
      last_open_at: new Date().toISOString(),
      open_count: 1, // سيتم تجاهله إذا كان موجوداً وسنحدّثه يدوياً
      country: country,
      city: city,
      device_type: deviceInfo.device_type,
      operating_system: deviceInfo.operating_system
    };

    // محاولة الإدراج، إذا كان موجوداً نجلب العدد ونحدثه
    const checkExistRes = await fetch(`${SUPABASE_URL}/rest/v1/email_activities?uid=eq.${uid}&campaign_name=eq.cold_outreach&select=open_count`, { headers: supabaseHeaders });
    const existData = await checkExistRes.json();
    
    if (existData.length > 0) {
      const newCount = (existData[0].open_count || 0) + 1;
      await fetch(`${SUPABASE_URL}/rest/v1/email_activities?uid=eq.${uid}&campaign_name=eq.cold_outreach`, {
        method: 'PATCH',
        headers: supabaseHeaders,
        body: JSON.stringify({ last_open_at: new Date().toISOString(), open_count: newCount, country, city })
      });
    } else {
      await fetch(`${SUPABASE_URL}/rest/v1/email_activities`, {
        method: 'POST',
        headers: supabaseHeaders,
        body: JSON.stringify(emailActivityData)
      });
    }

    // 3. إدراج حدث فتح الإيميل في Events
    await fetch(`${SUPABASE_URL}/rest/v1/events`, {
      method: 'POST',
      headers: supabaseHeaders,
      body: JSON.stringify({ uid: uid, event_type: 'email_open', event_value: 'cold_outreach' })
    });

    // 4. تحديث total_email_opens في ملف الزائر (Fetch -> Increment -> Patch)
    const newTotalOpens = (visitor.total_email_opens || 0) + 1; // ملاحظة: القيمة القديمة تحتاج لجلبها
    // لتجنب خطأ التزامن (Race Condition)، نجلب العدد الحالي أولاً
    const countRes = await fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles?uid=eq.${uid}&select=total_email_opens`, { headers: supabaseHeaders });
    const countData = await countRes.json();
    const currentOpens = countData[0]?.total_email_opens || 0;

    context.waitUntil(fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles?uid=eq.${uid}`, {
      method: 'PATCH',
      headers: supabaseHeaders,
      body: JSON.stringify({ total_email_opens: currentOpens + 1, last_seen_at: new Date().toISOString() })
    }));

    // 5. إرسال تنبيه تليجرام
    const msg = `📧 <b>Cold Lead Opened Email!</b>\nName: ${visitor.identified_name || 'Unknown'}\nUID: <code>${uid}</code>\nLocation: ${country}, ${city}`;
    context.waitUntil(fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: msg, parse_mode: 'HTML' })
    }));

    return new Response(transparentGif, { headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store, max-age=0' } });

  } catch (error) {
    return new Response(transparentGif, { headers: { 'Content-Type': 'image/gif' } });
  }
}