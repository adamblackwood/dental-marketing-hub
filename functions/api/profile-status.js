// functions/api/profile-status.js

const SUPABASE_URL = 'https://euzfegkchpndqiixeeiy.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_nM8-NC5o-7byMLDtrB4wVA_c8rmClEM';

const supabaseHeaders = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json'
};

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const fingerprint_id = url.searchParams.get('fp');

    if (!fingerprint_id) {
      return new Response(JSON.stringify({ error: 'Missing fingerprint' }), { status: 400 });
    }

    // جلب بيانات الزائر من Supabase
    const res = await fetch(`${SUPABASE_URL}/rest/v1/visitors?fingerprint_id=eq.${fingerprint_id}&select=*`, {
      headers: supabaseHeaders
    });
    
    const visitors = await res.json();
    
    if (visitors.length === 0) {
      // زائر جديد تماماً، يحتاج كل البيانات الأساسية (الإيميل)
      return new Response(JSON.stringify({ 
        is_known: false, 
        missing_fields: ['identified_email', 'identified_name'] 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const visitor = visitors[0];
    const missing = [];

    // إذا كان لا يملك إيميل، فهو ليس معروفاً بعد
    if (!visitor.identified_email) {
      return new Response(JSON.stringify({ 
        is_known: false, 
        missing_fields: ['identified_email', 'identified_name'] 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // إذا وصلنا هنا، الزائر معروف (Known Visitor). ما هي البيانات المتقدمة المفقودة؟
    if (!visitor.clinic_size) missing.push('clinic_size');
    if (!visitor.biggest_challenge) missing.push('biggest_challenge');
    if (!visitor.phone_number) missing.push('phone_number');

    return new Response(JSON.stringify({ 
      is_known: true, 
      name: visitor.identified_name,
      missing_fields: missing 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Profile Status Error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
}