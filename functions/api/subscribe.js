// functions/api/subscribe.js

const SUPABASE_URL = 'https://euzfegkchpndqiixeeiy.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_nM8-NC5o-7byMLDtrB4wVA_c8rmClEM';
const TELEGRAM_TOKEN = '8424656659:AAEbo9X2Kuw1QZDRPyu_Uy-SNg6T36vQoRg';
const TELEGRAM_CHAT_ID = '7203463194';
const GOOGLE_SHEETS_WEBHOOK_URL = 'GOOGLE_SHEETS_WEBHOOK_URL';

const supabaseHeaders = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal'
};

async function sendTelegram(text) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: 'HTML' })
  });
}

async function sendToSheets(data) {
  await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
}

export async function onRequestPost(context) {
  try {
    const payload = await context.request.json();
    const { fingerprint_id, email, name, clinic_size, biggest_challenge, phone_number } = payload;

    if (!fingerprint_id || !email) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
    }

    // 1. جلب حالة الزائر الحالية لمعرفة هل هو Cold Lead أم لا
    const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/visitors?fingerprint_id=eq.${fingerprint_id}&select=is_identified,identified_name,uid`, {
      headers: { ...supabaseHeaders, 'Prefer': 'return=representation' }
    });
    const currentVisitor = (await checkRes.json())[0] || {};
    const isColdLead = currentVisitor.is_identified && currentVisitor.uid;

    // 2. بناء بيانات الـ Upsert لـ Supabase
    const visitorData = {
      fingerprint_id: fingerprint_id,
      identified_email: email,
      identified_name: name || null,
      clinic_size: clinic_size || null,
      biggest_challenge: biggest_challenge || null,
      phone_number: phone_number || null,
      is_identified: true,
      is_hot_lead: true // أصبح هوت ليد لأنه قدم بياناته
    };

    // تنفيذ الـ Upsert
    const supaPromise = fetch(`${SUPABASE_URL}/rest/v1/visitors?on_conflict=fingerprint_id`, {
      method: 'POST',
      headers: { ...supabaseHeaders, 'Prefer': 'return=minimal' },
      body: JSON.stringify(visitorData)
    });

    // 3. تسجيل الحدث في جدول events
    const eventData = {
      fingerprint_id: fingerprint_id,
      event_type: 'form_submit',
      event_value: JSON.stringify({ email, clinic_size, biggest_challenge }),
      created_at: new Date().toISOString()
    };
    const eventPromise = fetch(`${SUPABASE_URL}/rest/v1/events`, {
      method: 'POST',
      headers: supabaseHeaders,
      body: JSON.stringify(eventData)
    });

    // 4. إرسال تنبيه تليجرام
    let telegramMsg;
    if (isColdLead) {
      telegramMsg = `🚨 <b>COLD LEAD ACTIVITY!</b>\nName: ${currentVisitor.identified_name || name}\nEmail: ${email}\nClinic Size: ${clinic_size || 'N/A'}\nChallenge: ${biggest_challenge || 'N/A'}\nUID: ${currentVisitor.uid}`;
    } else {
      telegramMsg = `🟢 <b>New Lead</b>\nName: ${name || 'N/A'}\nEmail: ${email}\nClinic Size: ${clinic_size || 'N/A'}\nChallenge: ${biggest_challenge || 'N/A'}`;
    }

    // 5. إرسال لجوجل شيت
    const sheetsData = {
      timestamp: new Date().toISOString(),
      email: email,
      name: name || '',
      clinic_size: clinic_size || '',
      biggest_challenge: biggest_challenge || '',
      fingerprint_id: fingerprint_id
    };

    // تشغيل كل العمليات الخارجية بالتوازي لتسريع الاستجابة للزائر
    context.waitUntil(Promise.all([
      supaPromise,
      eventPromise,
      sendTelegram(telegramMsg),
      sendToSheets(sheetsData)
    ]));

    // الرد على الزائر بالنجاح فوراً
    return new Response(JSON.stringify({ success: true, redirect: '/thank-you.html' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Subscribe Error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
}