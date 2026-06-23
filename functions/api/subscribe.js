// functions/api/subscribe.js
import { SUPABASE_URL, SUPABASE_ANON_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, GOOGLE_SHEETS_WEBHOOK } from './config.js';

const sbFetch = (path, method, body) => {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
};

export async function onRequestPost(context) {
  try {
    const data = await context.request.json();
    const { uid, identified_name, identified_email, phone_number, biggest_challenge } = data;
    const now = new Date().toISOString();

    if (!uid || !identified_email) {
      return new Response(JSON.stringify({ error: 'Missing uid or email' }), { status: 400 });
    }

    // 1. Insert form_submit event
    await sbFetch('events', 'POST', {
      event_uuid: crypto.randomUUID(),
      uid: uid,
      event_type: 'form_submit',
      event_value: 'Lead Magnet Form',
      created_at: now
    });

    // 2. Update visitor_profiles
    const profRes = await sbFetch(`visitor_profiles?uid=eq.${uid}&select=lead_score,total_conversions`, 'GET');
    const profData = await profRes.json();
    let newScore = 30;
    let newConversions = 1;

    if (profData.length > 0) {
      newScore = profData[0].lead_score + 30;
      newConversions = profData[0].total_conversions + 1;
    }
    const newStatus = newScore >= 70 ? 'hot' : (newScore >= 30 ? 'warm' : 'cold');

    await sbFetch(`visitor_profiles?uid=eq.${uid}`, 'PATCH', {
      identified_name,
      identified_email,
      is_identified: true,
      lead_score: newScore,
      total_conversions: newConversions,
      lead_status: newStatus,
      last_seen_at: now
    });

    // 3. Send Telegram Notification
    const tgMsg = `🦷 *New Lead Captured!*\n\n*Name:* ${identified_name}\n*Email:* ${identified_email}\n*Phone:* ${phone_number}\n*Challenge:* ${biggest_challenge}\n*UID:* ${uid}\n*Lead Status:* ${newStatus}`;
    context.waitUntil(
      fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: tgMsg, parse_mode: 'Markdown' })
      })
    );

    // 4. Send Google Sheets Webhook
    context.waitUntil(
      fetch(GOOGLE_SHEETS_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, identified_name, identified_email, phone_number, biggest_challenge, timestamp: now })
      })
    );

    return new Response(JSON.stringify({ success: true, redirect: '/thank-you.html' }), { status: 200 });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}