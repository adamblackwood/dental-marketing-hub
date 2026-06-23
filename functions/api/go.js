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

    // Fire and forget the affiliate click event
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
          session_id: sid,
          event_type: 'affiliate_click',
          created_at: new Date().toISOString()
        })
      })
    );

    // Build redirect URL
    const separator = GHL_AFFILIATE_LINK.includes('?') ? '&' : '?';
    const redirectUrl = `${GHL_AFFILIATE_LINK}${separator}sub_id=${uid}`;
    
    return Response.redirect(redirectUrl, 302);

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}