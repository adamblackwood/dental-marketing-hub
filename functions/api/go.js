// functions/api/go.js

import { SUPABASE_URL, SUPABASE_ANON_KEY, TELEGRAM_TOKEN, TELEGRAM_CHAT_ID, GHL_AFFILIATE_LINK } from './config.js';

const supabaseHeaders = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal'
};

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const target = url.searchParams.get('target') || 'ghl';
    const uid = url.searchParams.get('uid') || 'unknown';
    const session_id = url.searchParams.get('sid') || null;

    const cf = context.request.cf || {};
    const country = cf.country || 'Unknown';

    // 1. إدراج الحدث
    const eventData = {
      uid: uid,
      session_id: session_id,
      event_type: 'affiliate_redirect',
      event_value: target
    };
    
    context.waitUntil(fetch(`${SUPABASE_URL}/rest/v1/events`, {
      method: 'POST',
      headers: supabaseHeaders,
      body: JSON.stringify(eventData)
    }));

    // 2. تحديث ملف الزائر (تصحيح العمليات الحسابية)
    const vRes = await fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles?uid=eq.${uid}&select=total_conversions,lead_score`, { headers: supabaseHeaders });
    const vData = await vRes.json();
    const currentConversions = Number(vData[0]?.total_conversions || 0);
    const currentScore = Number(vData[0]?.lead_score || 0);
    
    const visitorUpdate = {
      total_conversions: currentConversions + 1,
      lead_score: currentScore + 20,
      lead_status: 'hot',
      last_seen_at: new Date().toISOString()
    };

    context.waitUntil(fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles?uid=eq.${uid}`, {
      method: 'PATCH',
      headers: supabaseHeaders,
      body: JSON.stringify(visitorUpdate)
    }));

    // 3. إرسال تليجرام
    const msg = `🔥 <b>Affiliate Click</b>\nTarget: ${target}\nCountry: ${country}\nUID: <code>${uid}</code>`;
    context.waitUntil(fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: msg, parse_mode: 'HTML' })
    }));

    // 4. Redirect 302
    const redirectUrl = new URL(GHL_AFFILIATE_LINK);
    return Response.redirect(redirectUrl.toString(), 302);

  } catch (error) {
    return Response.redirect(GHL_AFFILIATE_LINK, 302);
  }
}