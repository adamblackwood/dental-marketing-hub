// functions/api/go.js
import { SUPABASE_URL, SUPABASE_ANON_KEY, GHL_AFFILIATE_LINK } from './config.js';

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const params = url.searchParams;
    const uid = params.get('uid');
    const sid = params.get('sid');

    if (!uid) {
      return new Response('Missing UID', { status: 400 });
    }

    const supabaseHeaders = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    };

    // Use waitUntil to ensure database updates complete even during redirect
    context.waitUntil(
      (async () => {
        const now = new Date().toISOString();

        // 1. Insert Affiliate Click Event
        await fetch(`${SUPABASE_URL}/rest/v1/events`, {
          method: 'POST',
          headers: supabaseHeaders,
          body: JSON.stringify({
            event_uuid: crypto.randomUUID(),
            uid: uid,
            session_id: sid,
            event_type: 'affiliate_click',
            created_at: now
          })
        });

        // 2. Update Lead Score (+50) and Conversions
        const profRes = await fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles?uid=eq.${uid}&select=lead_score,total_conversions`, {
          headers: supabaseHeaders
        });
        const profData = await profRes.json();
        
        if (profData.length > 0) {
          const newScore = profData[0].lead_score + 50;
          const newConversions = profData[0].total_conversions + 1;
          
          await fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles?uid=eq.${uid}`, {
            method: 'PATCH',
            headers: supabaseHeaders,
            body: JSON.stringify({
              lead_score: newScore,
              total_conversions: newConversions,
              lead_status: 'hot', // Direct to Hot
              last_seen_at: now
            })
          });
        }
      })()
    );

    // Build redirect URL
    const separator = GHL_AFFILIATE_LINK.includes('?') ? '&' : '?';
    const redirectUrl = `${GHL_AFFILIATE_LINK}${separator}sub_id=${uid}`;
    
    return Response.redirect(redirectUrl, 302);

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}