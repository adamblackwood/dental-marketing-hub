// functions/api/p/[uid].js
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';

export async function onRequestGet(context) {
  try {
    const uid = context.params.uid;
    if (!uid) return new Response('No UID', { status: 400 });

    // Update entered_site = true
    context.waitUntil(
      fetch(`${SUPABASE_URL}/rest/v1/email_activities?uid=eq.${uid}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ entered_site: true })
      })
    );

    // Redirect to homepage with identified UID
    return Response.redirect(`/?identified=${uid}`, 302);

  } catch (err) {
    return new Response('Error', { status: 500 });
  }
}