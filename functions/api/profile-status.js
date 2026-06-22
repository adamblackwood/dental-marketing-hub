// functions/api/profile-status.js
// يفحص البيانات المفقودة للزائر لعرض النماذج الذكية (مثلاً: إذا لم يقدم الإيميل، يظهر نموذج الإيميل)

import { SUPABASE_URL, SUPABASE_SERVICE_KEY } from './config.js';

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const uid = url.searchParams.get('uid');

  if (!uid) return new Response(JSON.stringify({ error: 'Missing uid' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles?uid=eq.${uid}&select=is_identified,identified_email,identified_name,phone_number,biggest_challenge`, {
      headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
    });
    const data = await res.json();
    
    if (data.length === 0) return new Response(JSON.stringify({ exists: false }), { headers: { 'Content-Type': 'application/json' } });

    const profile = data[0];
    return new Response(JSON.stringify({ 
      exists: true, 
      missing_fields: {
        email: !profile.identified_email,
        name: !profile.identified_name,
        phone: !profile.phone_number,
        challenge: !profile.biggest_challenge
      }
    }), { headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to fetch profile' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}