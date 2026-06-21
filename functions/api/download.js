// functions/api/download.js

import { SUPABASE_URL, SUPABASE_ANON_KEY, FILES_MAP } from './config.js';

const supabaseHeaders = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal'
};

export async function onRequestPost(context) {
  try {
    const payload = await context.request.json();
    const { uid, session_id, file_id } = payload;

    if (!uid || !file_id) return new Response(JSON.stringify({ error: 'Missing data' }), { status: 400 });

    const fileUrl = FILES_MAP[file_id];
    if (!fileUrl) return new Response(JSON.stringify({ error: 'File not found' }), { status: 404 });

    // 1. إدراج الحدث
    const eventData = { uid, session_id, event_type: 'file_download', event_value: file_id };
    context.waitUntil(fetch(`${SUPABASE_URL}/rest/v1/events`, {
      method: 'POST',
      headers: supabaseHeaders,
      body: JSON.stringify(eventData)
    }));

    // 2. زيادة التحويلات والنقاط في ملف الزائر
    const vRes = await fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles?uid=eq.${uid}&select=total_conversions,lead_score`, { headers: supabaseHeaders });
    const vData = await vRes.json();
    const currentConversions = vData[0]?.total_conversions || 0;
    const currentScore = vData[0]?.lead_score || 0;

    context.waitUntil(fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles?uid=eq.${uid}`, {
      method: 'PATCH',
      headers: supabaseHeaders,
      body: JSON.stringify({
        total_conversions: currentConversions + 1,
        lead_score: currentScore + 10
      })
    }));

    return new Response(JSON.stringify({ success: true, download_url: fileUrl }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: 'Server Error' }), { status: 500 });
  }
}