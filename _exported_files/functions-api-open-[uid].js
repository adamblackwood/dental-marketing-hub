// functions/api/open/[uid].js
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';

export async function onRequestGet(context) {
  try {
    const uid = context.params.uid;
    const url = new URL(context.request.url);
    const campaign = url.searchParams.get('c') || 'unknown_campaign';
    const now = new Date().toISOString();

    if (!uid) return new Response('No UID', { status: 400 });

    // 1. Insert email_open event
    context.waitUntil(
      fetch(`${SUPABASE_URL}/rest/v1/events`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          event_uuid: crypto.randomUUID(),
          uid: uid,
          event_type: 'email_open',
          event_value: campaign,
          created_at: now
        })
      })
    );

    // 2. Upsert into email_activities (increment open_count)
    context.waitUntil(
      (async () => {
        const eaRes = await fetch(`${SUPABASE_URL}/rest/v1/email_activities?uid=eq.${uid}&campaign_name=eq.${campaign}&select=open_count`, {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
          }
        });
        const eaData = await eaRes.json();
        
        if (eaData.length > 0) {
          await fetch(`${SUPABASE_URL}/rest/v1/email_activities?uid=eq.${uid}&campaign_name=eq.${campaign}`, {
            method: 'PATCH',
            headers: {
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ open_count: eaData[0].open_count + 1 })
          });
        } else {
          await fetch(`${SUPABASE_URL}/rest/v1/email_activities`, {
            method: 'POST',
            headers: {
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              uid: uid,
              campaign_name: campaign,
              open_count: 1
            })
          });
        }
      })()
    );

    // 3. Return 1x1 transparent GIF
    const gifBase64 = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    const gifBuffer = Uint8Array.from(atob(gifBase64), c => c.charCodeAt(0));
    
    return new Response(gifBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-store'
      }
    });

  } catch (err) {
    return new Response('Error', { status: 500 });
  }
}