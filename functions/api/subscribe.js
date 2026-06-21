// functions/api/subscribe.js

import { SUPABASE_URL, SUPABASE_ANON_KEY, TELEGRAM_TOKEN, TELEGRAM_CHAT_ID, GOOGLE_SHEETS_WEBHOOK_URL } from './config.js';

const supabaseHeaders = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal'
};

export async function onRequestPost(context) {
  try {
    const payload = await context.request.json();
    const { uid, email, name, clinic_size, biggest_challenge, phone_number } = payload;

    if (!uid || !email) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
    }

    // 1. جلب النقاط والتحويلات الحالية لتجنب التراكم الخاطئ
    const vRes = await fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles?uid=eq.${uid}&select=lead_score,total_conversions`, { headers: supabaseHeaders });
    const vData = await vRes.json();
    const currentScore = Number(vData[0]?.lead_score || 0);
    const currentConversions = Number(vData[0]?.total_conversions || 0);

    // 2. تحديث ملف الزائر بالبيانات المعروفة وزيادة التحويلات والنقاط
    const visitorData = {
      identified_email: email,
      identified_name: name || null,
      clinic_size: clinic_size || null,
      biggest_challenge: biggest_challenge || null,
      phone_number: phone_number || null,
      is_identified: true,
      lead_status: 'hot',
      lead_score: currentScore + 50, // إضافة 50 نقطة للتسجيل
      total_conversions: currentConversions + 1, // زيادة التحويلات
      last_seen_at: new Date().toISOString()
    };

    context.waitUntil(fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles?uid=eq.${uid}`, {
      method: 'PATCH',
      headers: supabaseHeaders,
      body: JSON.stringify(visitorData)
    }));

    // 3. إدراج حدث التسجيل
    const eventData = {
      uid: uid,
      event_type: 'form_submit',
      event_value: JSON.stringify({ email, clinic_size })
    };
    context.waitUntil(fetch(`${SUPABASE_URL}/rest/v1/events`, {
      method: 'POST',
      headers: supabaseHeaders,
      body: JSON.stringify(eventData)
    }));

    // 4. تنبيه تليجرام
    const msg = `🟢 <b>New Lead</b>\nName: ${name || 'N/A'}\nEmail: ${email}\nClinic Size: ${clinic_size || 'N/A'}\nUID: <code>${uid}</code>`;
    context.waitUntil(fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: msg, parse_mode: 'HTML' })
    }));

    // 5. جوجل شيتس
    const sheetsData = { timestamp: new Date().toISOString(), email, name: name || '', clinic_size: clinic_size || '', fingerprint_id: uid };
    context.waitUntil(fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sheetsData)
    }));

    return new Response(JSON.stringify({ success: true, redirect: '/thank-you.html' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
}