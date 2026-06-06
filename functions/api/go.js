// functions/api/go.js

const SUPABASE_URL = 'SUPABASE_URL';
const SUPABASE_ANON_KEY = 'SUPABASE_ANON_KEY';
const TELEGRAM_TOKEN = '8424656659:AAEbo9X2Kuw1QZDRPyu_Uy-SNg6T36vQoRg';
const TELEGRAM_CHAT_ID = '7203463194';

const GHL_AFFILIATE_LINK = 'https://www.gohighlevel.com/?-aff-code=YOUR_AFFILIATE_CODE';

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

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const target = url.searchParams.get('target') || 'ghl';
    const fingerprint_id = url.searchParams.get('fp') || 'unknown';
    const session_id = url.searchParams.get('sid') || 'unknown';

    // استخراج بيانات الجهاز والموقع من Cloudflare
    const cf = context.request.cf || {};
    const country = cf.country || 'Unknown';
    const region = cf.region || 'Unknown';
    const userAgent = context.request.headers.get('User-Agent') || 'Unknown';

    // استخراج UTMs من الرابط
    const utm_source = url.searchParams.get('utm_source') || null;
    const utm_campaign = url.searchParams.get('utm_campaign') || null;

    // 1. تسجيل الحدث في Supabase (أحداث حرجة فقط)
    const eventData = {
      session_id: session_id,
      fingerprint_id: fingerprint_id,
      event_type: 'affiliate_redirect',
      event_value: target,
      created_at: new Date().toISOString()
    };
    await fetch(`${SUPABASE_URL}/rest/v1/events`, {
      method: 'POST',
      headers: supabaseHeaders,
      body: JSON.stringify(eventData)
    });

    // 2. إرسال تنبيه تليجرام
    const msg = `🔥 <b>Affiliate Click</b>\nTarget: ${target}\nCountry: ${country} | Region: ${region}\nFP: <code>${fingerprint_id}</code>`;
    // نرسل التليجرام في الخلفية (لا ننتظره لتسريع الـ Redirect)
    context.waitUntil(sendTelegram(msg));

    // 3. Redirect 302 فوري لرابط GoHighLevel
    const redirectUrl = new URL(GHL_AFFILIATE_LINK);
    if (utm_source) redirectUrl.searchParams.set('utm_source', utm_source);
    if (utm_campaign) redirectUrl.searchParams.set('utm_campaign', utm_campaign);

    return Response.redirect(redirectUrl.toString(), 302);

  } catch (error) {
    console.error('Go Redirect Error:', error);
    // في حالة الخطأ، نوجه الزائر للرابط المباشر حتى لا نفقد التحويل
    return Response.redirect(GHL_AFFILIATE_LINK, 302);
  }
}