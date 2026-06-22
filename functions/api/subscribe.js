// functions/api/subscribe.js
// يستقبل بيانات النماذج ويسجلها كحدث form_submit ويحدث حالة العميل

import { SUPABASE_URL, SUPABASE_SERVICE_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, GOOGLE_SHEETS_WEBHOOK } from './config.js';

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const { uid, identified_name, identified_email, phone_number, biggest_challenge, form_type } = body;
    if (!uid || !identified_email) return new Response(JSON.stringify({ error: 'Missing uid or email' }), { status: 400 });

    const headers = { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' };
    const now = new Date().toISOString();

    // 1. إدراج حدث النموذج (سيقوم track.js الأصلي أو هذا الملف بتحديث الـ profile، لنكرره هنا للضمان)
    await fetch(`${SUPABASE_URL}/rest/v1/events`, { 
      method: 'POST', headers, 
      body: JSON.stringify({ uid, event_type: 'form_submit', event_value: form_type || 'smart_form', created_at: now }) 
    });

    // 2. تحديث ملف الزائر المباشر (تعريفه وزيادة النقاط)
    const pRes = await fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles?uid=eq.${uid}&select=total_conversions,lead_score,lead_status`, { headers });
    const profiles = await pRes.json();
    if (profiles.length > 0) {
      const currentConv = Number(profiles[0].total_conversions) || 0;
      const currentScore = Number(profiles[0].lead_score) || 0;
      const newScore = currentScore + 30;
      let newStatus = profiles[0].lead_status;
      if (newScore >= 70) newStatus = 'hot'; else if (newScore >= 30) newStatus = 'warm';
      
      await fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles?uid=eq.${uid}`, { 
        method: 'PATCH', headers, 
        body: JSON.stringify({ 
          identified_name: identified_name || null, 
          identified_email, 
          phone_number: phone_number || null, 
          biggest_challenge: biggest_challenge || null,
          is_identified: true, 
          total_conversions: currentConv + 1, 
          lead_score: newScore, 
          lead_status: newStatus, 
          last_seen_at: now 
        }) 
      });
    }

    // 3. توزيع البيانات (Telegram & Sheets)
    context.waitUntil((async () => {
      if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
        const text = `🦷 *New Lead (${form_type})*\nName: ${identified_name || 'N/A'}\nEmail: ${identified_email}\nPhone: ${phone_number || 'N/A'}\nChallenge: ${biggest_challenge || 'N/A'}\nUID: ${uid}`;
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: 'Markdown' }) });
      }
      if (GOOGLE_SHEETS_WEBHOOK) {
        await fetch(GOOGLE_SHEETS_WEBHOOK, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uid, identified_name, identified_email, phone_number, biggest_challenge, form_type }) });
      }
    })());

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Server Error' }), { status: 500 });
  }
}