// functions/api/go.js

import { SUPABASE_URL, SUPABASE_ANON_KEY, TELEGRAM_TOKEN, TELEGRAM_CHAT_ID, GHL_AFFILIATE_LINK } from './config.js';

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

    const cf = context.request.cf || {};
    const country = cf.country || 'Unknown';
    const region = cf.region || 'Unknown';

    const utm_source = url.searchParams.get('utm_source') || null;
    const utm_campaign = url.searchParams.get('utm_campaign') || null;

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

    const msg = `🔥 <b>Affiliate Click</b>\nTarget: ${target}\nCountry: ${country} | Region: ${region}\nFP: <code>${fingerprint_id}</code>`;
    context.waitUntil(sendTelegram(msg));

    const redirectUrl = new URL(GHL_AFFILIATE_LINK);
    if (utm_source) redirectUrl.searchParams.set('utm_source', utm_source);
    if (utm_campaign) redirectUrl.searchParams.set('utm_campaign', utm_campaign);

    return Response.redirect(redirectUrl.toString(), 302);

  } catch (error) {
    console.error('Go Redirect Error:', error);
    return Response.redirect(GHL_AFFILIATE_LINK, 302);
  }
}