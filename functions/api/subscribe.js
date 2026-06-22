// functions/api/subscribe.js
// يستقبل بيانات النماذج (Smart Form / Exit Intent) + يحدث بيانات الزائر + يوزع للتليجرام وشيتس

import { SUPABASE_URL, SUPABASE_SERVICE_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, GOOGLE_SHEETS_WEBHOOK } from './config.js';

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const { uid, identified_name, identified_email, phone_number, biggest_challenge, form_type } = body;
    if (!uid || !identified_email) return new Response(JSON.stringify({ error: 'Missing uid or email' }), { status: 400 });

    const headers = { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' };

    // 1. جلب البيانات الحالية لزيادة الـ lead_score
    const pRes = await fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles?uid=eq.${uid}&select=lead_score,lead_status`, { headers });
    const profiles = await pRes.json();
    let newScore = 30; // Default score for form_submit
    let newStatus = 'warm';

    if (profiles.length > 0) {
      const currentScore = Number(profiles[0].lead_score) || 0;
      newScore = currentScore + 30;
      if (newScore >= 70) newStatus = 'hot'; else if (newScore >= 30) newStatus = 'warm';
    }

    // 2. تحديث ملف الزائر (Upsert)
    const profileUpdate = {
      identified_name: identified_name || null,
      identified_email: identified_email,
      phone_number: phone_number || null,
      biggest_challenge: biggest_challenge || null,
      is_identified: true,
      lead_score: newScore,
      lead_status: newStatus,
      last_seen_at: new Date().toISOString()
    };

    await fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles?uid=eq.${uid}`, { method: 'PATCH', headers, body: JSON.stringify(profileUpdate) });

    // 3. توزيع البيانات (Webhooks) بشكل غير متزامن (لا نعطل الاستجابة للمستخدم)
    context.waitUntil((async () => {
      // Telegram
      if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
        const text = `🦷 *New Lead (${form_type})*\nName: ${identified_name || 'N/A'}\nEmail: ${identified_email}\nPhone: ${phone_number || 'N/A'}\nChallenge: ${biggest_challenge || 'N/A'}\nUID: ${uid}`;
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: 'Markdown' }) });
      }
      // Google Sheets
      if (GOOGLE_SHEETS_WEBHOOK) {
        await fetch(GOOGLE_SHEETS_WEBHOOK, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...profileUpdate, uid, form_type }) });
      }
    })());

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Server Error' }), { status: 500 });
  }
}