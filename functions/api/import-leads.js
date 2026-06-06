// functions/api/import-leads.js

const SUPABASE_URL = 'https://euzfegkchpndqiixeeiy.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_nM8-NC5o-7byMLDtrB4wVA_c8rmClEM';
const ADMIN_SECRET = 'AdminSecretPass123';

const supabaseHeaders = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal'
};

export async function onRequestPost(context) {
  try {
    const url = new URL(context.request.url);
    const secret = url.searchParams.get('secret');

    // 1. حماية البوابة بكلمة المرور
    if (secret !== ADMIN_SECRET) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const leads = await context.request.json();

    // التحقق من أن البيانات مصفوفة
    if (!Array.isArray(leads) || leads.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid payload. Expected an array of leads.' }), { status: 400 });
    }

    const supabasePayload = [];
    const responseLinks = [];

    // 2. معالجة كل عميل بارد وتوليد UID وبصمة مؤقتة
    for (const lead of leads) {
      if (!lead.email) continue; // تخطي إذا لم يكن هناك إيميل

      // توليد UID قصير وفريد (مثال: uid_a1b2c3)
      const uid = `uid_${crypto.randomUUID().split('-')[0]}`;
      
      // بصمة مؤقتة للـ Primary Key (سيتم استبدالها بالبصمة الحقيقية عند الزيارة)
      const tempFingerprint = `cold_${uid}`;

      supabasePayload.push({
        fingerprint_id: tempFingerprint,
        uid: uid,
        identified_email: lead.email,
        identified_name: lead.name || null,
        is_identified: true,
        is_hot_lead: false, // عميل بارد لم يقم بأي فعل بعد
        first_source: 'cold_email', // تحديد المصدر كإيميل بارد
        last_seen_at: new Date().toISOString()
      });

      responseLinks.push({
        name: lead.name || 'N/A',
        email: lead.email,
        uid: uid,
        tracking_link: `/p/${uid}` // الرابط الجاهز للنسخ
      });
    }

    // 3. إدراج الدفعة دفعة واحدة في Supabase (Bulk Insert)
    if (supabasePayload.length > 0) {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/visitors`, {
        method: 'POST',
        headers: supabaseHeaders,
        body: JSON.stringify(supabasePayload)
      });

      if (!res.ok && res.status !== 204) {
        const errText = await res.text();
        console.error('Supabase Bulk Insert Error:', errText);
        return new Response(JSON.stringify({ error: 'Failed to insert leads', details: errText }), { status: 500 });
      }
    }

    // 4. إرجاع الروابط المخصصة للواجهة
    return new Response(JSON.stringify({ 
      success: true, 
      imported_count: supabasePayload.length,
      links: responseLinks 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Import Leads Error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
}