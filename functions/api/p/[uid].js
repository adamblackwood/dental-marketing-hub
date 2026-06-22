// functions/api/p/[uid].js
// تحويل العميل البارد للرئيسية مع تحديث حالة الدخول في email_activities

import { SUPABASE_URL, SUPABASE_SERVICE_KEY } from '../../config.js';

export async function onRequestGet(context) {
  const uid = context.params.uid;
  
  if (uid) {
    // تحديث البيانات في الخلفية دون تأخير إعادة التوجيه
    context.waitUntil((async () => {
      try {
        const headers = { 
          'apikey': SUPABASE_SERVICE_KEY, 
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 
          'Content-Type': 'application/json' 
        };
        
        // تحديث جميع سجلات الإيميل لهذا العميل إلى entered_site = true
        await fetch(`${SUPABASE_URL}/rest/v1/email_activities?uid=eq.${uid}&entered_site=is.false`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ entered_site: true })
        });
      } catch (e) {
        console.error('Failed to update entered_site:', e);
      }
    })());
  }

  // إعادة التوجيه الفوري للرئيسية مع إرفاق الـ UID
  const targetUrl = new URL(context.request.url).origin + `/?identified=${uid}`;
  return Response.redirect(targetUrl, 302);
}