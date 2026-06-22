// functions/api/open/[uid].js
// تتبع فتح الإيميل عبر Tracking Pixel 1x1 شفاف
// يسجل الحدث في email_activities و events

import { SUPABASE_URL, SUPABASE_SERVICE_KEY } from '../../config.js';

export async function onRequestGet(context) {
  const uid = context.params.uid;
  
  if (uid) {
    context.waitUntil((async () => {
      const headers = { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' };
      const now = new Date().toISOString();
      const campaignName = new URL(context.request.url).searchParams.get('c') || 'unknown';

      // Upsert في email_activities
      const existing = await fetch(`${SUPABASE_URL}/rest/v1/email_activities?uid=eq.${uid}&campaign_name=eq.${encodeURIComponent(campaignName)}&select=open_count`, { headers });
      const existingData = await existing.json();
      
      if (existingData.length > 0) {
        const openCount = Number(existingData[0].open_count) || 0;
        await fetch(`${SUPABASE_URL}/rest/v1/email_activities?uid=eq.${uid}&campaign_name=eq.${encodeURIComponent(campaignName)}`, { method: 'PATCH', headers, body: JSON.stringify({ open_count: openCount + 1, last_open_at: now }) });
      } else {
        await fetch(`${SUPABASE_URL}/rest/v1/email_activities`, { method: 'POST', headers, body: JSON.stringify({ uid, campaign_name: campaignName, first_open_at: now, last_open_at: now, open_count: 1 }) });
      }

      // زيادة total_email_opens
      const pRes = await fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles?uid=eq.${uid}&select=total_email_opens`, { headers });
      const profiles = await pRes.json();
      if (profiles.length > 0) {
        const currentOpens = Number(profiles[0].total_email_opens) || 0;
        await fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles?uid=eq.${uid}`, { method: 'PATCH', headers, body: JSON.stringify({ total_email_opens: currentOpens + 1 }) });
      }

      // إدراج في events
      await fetch(`${SUPABASE_URL}/rest/v1/events`, { method: 'POST', headers, body: JSON.stringify({ uid, event_type: 'email_open', event_value: campaignName, created_at: now }) });
    })());
  }

  // إرجاع صورة GIF 1x1 شفافة (Base64)
  const gifBase64 = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  const gifBuffer = Uint8Array.from(atob(gifBase64), c => c.charCodeAt(0));
  
  return new Response(gifBuffer, {
    headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store, no-cache, must-revalidate', 'Pragma': 'no-cache' }
  });
}