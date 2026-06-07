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
    const { fingerprint_id, session_id, file_id } = payload;

    if (!fingerprint_id || !file_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
    }

    // التحقق من وجود الملف في الخريطة القادمة من config.js
    const fileUrl = FILES_MAP[file_id];
    if (!fileUrl) {
      return new Response(JSON.stringify({ error: 'File not found' }), { status: 404 });
    }

    // 1. تسجيل حدث التحميل في Supabase
    const eventData = {
      session_id: session_id || null,
      fingerprint_id: fingerprint_id,
      event_type: 'file_download',
      event_value: file_id,
      created_at: new Date().toISOString()
    };

    // إرسال الحدث في الخلفية
    context.waitUntil(
      fetch(`${SUPABASE_URL}/rest/v1/events`, {
        method: 'POST',
        headers: supabaseHeaders,
        body: JSON.stringify(eventData)
      })
    );

    // 2. إرجاع الرابط المباشر للعميل
    return new Response(JSON.stringify({ 
      success: true, 
      download_url: fileUrl 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Download Error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
}