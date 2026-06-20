// functions/api/open/[uid].js

import { SUPABASE_URL, SUPABASE_ANON_KEY, TELEGRAM_TOKEN, TELEGRAM_CHAT_ID } from '../../config.js';

const supabaseHeaders = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal'
};

// صورة GIF شفافة بحجم 1x1 (Base64)
const transparentGif = atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');

export async function onRequestGet(context) {
  try {
    const uid = context.params.uid;
    if (!uid) return new Response(transparentGif, { headers: { 'Content-Type': 'image/gif' } });

    // 1. البحث عن الزائر باستخدام الـ UID لجلب البصمة والاسم
    const visitorRes = await fetch(`${SUPABASE_URL}/rest/v1/visitors?uid=eq.${uid}&select=fingerprint_id,identified_name`, {
      headers: supabaseHeaders
    });
    const visitors = await visitorRes.json();
    const visitor = visitors[0];

    if (visitor) {
      const fingerprint_id = visitor.fingerprint_id;
      const name = visitor.identified_name || 'Unknown';

      // 2. تسجيل حدث فتح الإيميل في جدول events
      const eventData = {
        fingerprint_id: fingerprint_id,
        event_type: 'email_open',
        event_value: uid,
        created_at: new Date().toISOString()
      };
      
      context.waitUntil(fetch(`${SUPABASE_URL}/rest/v1/events`, {
        method: 'POST',
        headers: supabaseHeaders,
        body: JSON.stringify(eventData)
      }));

      // 3. إرسال تنبيه تليجرام
      const msg = `📧 <b>Cold Lead Opened Email!</b>\nName: ${name}\nUID: <code>${uid}</code>`;
      context.waitUntil(fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: msg, parse_mode: 'HTML' })
      }));
    }

    // 4. إرجاع الصورة الشفافة لاكتمال العملية دون أن يشعر الزائر
    return new Response(transparentGif, {
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-store, max-age=0'
      }
    });

  } catch (error) {
    console.error('Email Open Tracking Error:', error);
    // إرجاع الصورة حتى لو حدث خطأ لعدم تعطل الإيميل
    return new Response(transparentGif, { headers: { 'Content-Type': 'image/gif' } });
  }
}