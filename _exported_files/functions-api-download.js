// functions/api/download.js
import { SUPABASE_URL, SUPABASE_ANON_KEY, FILES_MAP } from './config.js';

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const params = url.searchParams;
    const uid = params.get('uid');
    const fileKey = params.get('file');

    if (!uid || !fileKey) {
      return new Response(JSON.stringify({ error: 'Missing uid or file parameter' }), { status: 400 });
    }

    const downloadUrl = FILES_MAP[fileKey];
    if (!downloadUrl) {
      return new Response(JSON.stringify({ error: 'Invalid file requested' }), { status: 404 });
    }

    // Fire and forget the file_download event
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
          event_type: 'file_download',
          event_value: fileKey,
          created_at: new Date().toISOString()
        })
      })
    );

    // Update Lead Score (+20)
    context.waitUntil(
      (async () => {
        const profRes = await fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles?uid=eq.${uid}&select=lead_score,total_conversions`, {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
          }
        });
        const profData = await profRes.json();
        if (profData.length > 0) {
          const newScore = profData[0].lead_score + 20;
          const newConversions = profData[0].total_conversions + 1;
          const newStatus = newScore >= 70 ? 'hot' : (newScore >= 30 ? 'warm' : 'cold');
          
          await fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles?uid=eq.${uid}`, {
            method: 'PATCH',
            headers: {
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              lead_score: newScore,
              total_conversions: newConversions,
              lead_status: newStatus
            })
          });
        }
      })()
    );

    return new Response(JSON.stringify({ success: true, download_url: downloadUrl }), { status: 200 });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}