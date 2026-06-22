// functions/api/go.js
// تتبع نقرة الأفلييت + تسجيل الحدث في events + تحديث total_conversions + إعادة توجيه 302 لرابط الإحالة

import { SUPABASE_URL, SUPABASE_SERVICE_KEY, GHL_AFFILIATE_LINK } from './config.js';

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const uid = url.searchParams.get('uid');
    const session_id = url.searchParams.get('sid');

    if (uid) {
      // تسجيل الحدث في الخلفية بشكل غير متزامن (لا نعطل الـ Redirect للمستخدم)
      context.waitUntil((async () => {
        const headers = { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' };
        
        // 1. إدراج في events
        await fetch(`${SUPABASE_URL}/rest/v1/events`, { 
          method: 'POST', 
          headers, 
          body: JSON.stringify({ uid, session_id, event_type: 'affiliate_redirect', event_value: 'ghl_click', created_at: new Date().toISOString() }) 
        });

        // 2. زيادة total_conversions وتحديث Lead Score
        const pRes = await fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles?uid=eq.${uid}&select=total_conversions,lead_score,lead_status`, { headers });
        const profiles = await pRes.json();
        if (profiles && profiles.length > 0) {
          const currentConv = Number(profiles[0].total_conversions) || 0;
          const currentScore = Number(profiles[0].lead_score) || 0;
          const newScore = currentScore + 50;
          let newStatus = profiles[0].lead_status;
          if (newScore >= 70) newStatus = 'hot'; else if (newScore >= 30) newStatus = 'warm';
          
          await fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles?uid=eq.${uid}`, { 
            method: 'PATCH', 
            headers, 
            body: JSON.stringify({ total_conversions: currentConv + 1, lead_score: newScore, lead_status: newStatus }) 
          });
        }
      })());
    }

    // إعادة التوجيه الفورية لرابط الإحالة
    // ميزة إضافية: إرفاق الـ uid كـ sub_id في الرابط لتتبع التحويلات من داخل لوحة تحكم GHL
    const finalRedirectUrl = uid ? `${GHL_AFFILIATE_LINK}&sub_id=${uid}` : GHL_AFFILIATE_LINK;
    return Response.redirect(finalRedirectUrl, 302);

  } catch (err) {
    // في حال حدوث أي خطأ في التتبع، نوجه الزائر فوراً لرابط الإحالة حتى لا نفقد العميل
    return Response.redirect(GHL_AFFILIATE_LINK, 302);
  }
}