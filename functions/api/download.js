// functions/api/download.js

import { SUPABASE_URL, SUPABASE_ANON_KEY, FILES_MAP } from './config.js';

const supabaseHeaders = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal'
};

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const uid = url.searchParams.get('uid');
    const file_id = url.searchParams.get('file');
    const session_id = url.searchParams.get('sid') || null;

    if (!uid || !file_id) {
      return new Response(JSON.stringify({ error: 'Missing uid or file parameter' }), { status: 400 });
    }

    // 1. التحقق من وجود الملف في الخريطة
    const fileUrl = FILES_MAP[file_id];
    if (!fileUrl) {
      return new Response(JSON.stringify({ error: 'File not found' }), { status: 404 });
    }

    // 2. إدراج حدث تحميل الملف في جدول events
    const eventData = {
      event_uuid: crypto.randomUUID(),
      uid: uid,
      session_id: session_id,
      event_type: 'file_download',
      event_value: file_id
    };

    context.waitUntil(fetch(`${SUPABASE_URL}/rest/v1/events`, {
      method: 'POST',
      headers: supabaseHeaders,
      body: JSON.stringify(eventData)
    }));

    // 3. زيادة التحويلات والنقاط في ملف الزائر (Fetch -> Increment -> Patch)
    const vRes = await fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles?uid=eq.${uid}&select=total_conversions,lead_score`, { headers: supabaseHeaders });
    
    // التصحيح هنا: توفير قيمة بديلة (مصفوفة فارغة) في حال فشل الاستجابة
    const vDataArr = vRes.ok ? await vRes.json() : [];
    
    if (vDataArr.length > 0) {
      const currentConversions = Number(vDataArr[0]?.total_conversions || 0);
      const currentScore = Number(vDataArr[0]?.lead_score || 0);

      context.waitUntil(fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles?uid=eq.${uid}`, {
        method: 'PATCH',
        headers: supabaseHeaders,
        body: JSON.stringify({
          total_conversions: currentConversions + 1,
          lead_score: currentScore + 20,
          lead_status: currentScore + 20 >= 70 ? 'hot' : 'warm'
        })
      }));
    }

    // 4. إرجاع رابط التحميل المباشر
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