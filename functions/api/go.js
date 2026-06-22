// functions/api/go.js
// تتبع نقرة الأفلييت + إدراج الحدث في events مع الربط بالـ visit و acquisition

import { SUPABASE_URL, SUPABASE_SERVICE_KEY, GHL_AFFILIATE_LINK } from './config.js';

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const uid = url.searchParams.get('uid');
    const session_id = url.searchParams.get('sid');

    if (uid) {
      context.waitUntil((async () => {
        const headers = { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' };
        
        // 1. جلب visit_id و acquisition_id من الجلسة
        let visit_id = null, acquisition_id = null;
        if (session_id) {
          const sRes = await fetch(`${SUPABASE_URL}/rest/v1/sessions?session_id=eq.${session_id}&select=visit_id`, { headers });
          const sData = await sRes.json();
          if (sData.length > 0) {
            visit_id = sData[0].visit_id;
            const vRes = await fetch(`${SUPABASE_URL}/rest/v1/visits?visit_id=eq.${visit_id}&select=acquisition_id`, { headers });
            const vData = await vRes.json();
            if (vData.length > 0) acquisition_id = vData[0].acquisition_id;
          }
        }

        // 2. إدراج الحدث التجاري
        await fetch(`${SUPABASE_URL}/rest/v1/events`, { 
          method: 'POST', headers, 
          body: JSON.stringify({ uid, visit_id, session_id, acquisition_id, event_type: 'affiliate_click', event_value: 'ghl_click' }) 
        });

        // 3. تحديث ملف الزائر
        const pRes = await fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles?uid=eq.${uid}&select=total_conversions,lead_score,lead_status`, { headers });
        const profiles = await pRes.json();
        if (profiles.length > 0) {
          const currentConv = Number(profiles[0].total_conversions) || 0;
          const currentScore = Number(profiles[0].lead_score) || 0;
          const newScore = currentScore + 50;
          let newStatus = profiles[0].lead_status;
          if (newScore >= 70) newStatus = 'hot'; else if (newScore >= 30) newStatus = 'warm';
          await fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles?uid=eq.${uid}`, { 
            method: 'PATCH', headers, 
            body: JSON.stringify({ total_conversions: currentConv + 1, lead_score: newScore, lead_status: newStatus }) 
          });
        }
      })());
    }

    const redirectUrl = uid ? `${GHL_AFFILIATE_LINK}&sub_id=${uid}` : GHL_AFFILIATE_LINK;
    return Response.redirect(redirectUrl, 302);

  } catch (err) {
    return Response.redirect(GHL_AFFILIATE_LINK, 302);
  }
}