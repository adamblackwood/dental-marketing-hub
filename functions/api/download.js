// functions/api/download.js
// يسجل تحميل الملف في events + يرجع رابط التحميل المباشر من Google Drive

import { SUPABASE_URL, SUPABASE_SERVICE_KEY, DOWNLOADABLE_FILES } from './config.js';

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const uid = url.searchParams.get('uid');
    const fileKey = url.searchParams.get('file'); // نستلم الاسم المنطقي (مثل: ghl-setup-guide)

    if (!uid || !fileKey) return new Response('Missing parameters', { status: 400 });

    // البحث عن الرابط الحقيقي في قاموس الإعدادات
    const realDownloadUrl = DOWNLOADABLE_FILES[fileKey];
    if (!realDownloadUrl) {
      return new Response('File not found', { status: 404 });
    }

    // تسجيل حدث التحميل بشكل غير متزامن في Supabase
    context.waitUntil((async () => {
      const headers = { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' };
      const now = new Date().toISOString();
      
      // 1. إدراج الحدث (نخزن الاسم المنطقي fileKey وليس الرابط لمنع تضخم البيانات)
      await fetch(`${SUPABASE_URL}/rest/v1/events`, { method: 'POST', headers, body: JSON.stringify({ uid, event_type: 'file_download', event_value: fileKey, created_at: now }) });
      
      // 2. تحديث العدادات والنقاط في ملف الزائر
      const pRes = await fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles?uid=eq.${uid}&select=total_conversions,lead_score,lead_status`, { headers });
      const profiles = await pRes.json();
      if (profiles.length > 0) {
        const currentConv = Number(profiles[0].total_conversions) || 0;
        const currentScore = Number(profiles[0].lead_score) || 0;
        const newScore = currentScore + 20; // 20 نقطة لكل تحميل
        let newStatus = profiles[0].lead_status;
        if (newScore >= 70) newStatus = 'hot'; else if (newScore >= 30) newStatus = 'warm';
        await fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles?uid=eq.${uid}`, { method: 'PATCH', headers, body: JSON.stringify({ total_conversions: currentConv + 1, lead_score: newScore, lead_status: newStatus }) });
      }
    })());

    // إعادة التوجيه الفوري للرابط الحقيقي المباشر على Google Drive
    return Response.redirect(realDownloadUrl, 302);

  } catch (err) {
    console.error('Download error:', err);
    return new Response('Server Error', { status: 500 });
  }
}