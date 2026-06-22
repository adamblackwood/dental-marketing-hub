// functions/api/import-leads.js
// بوابة إدخال العملاء الباردين Cold Leads (تستخدمها سكربتات الإيميل البارد)

import { SUPABASE_URL, SUPABASE_SERVICE_KEY } from './config.js';

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const { uid, email, campaign_name, source } = body;
    if (!uid || !email) return new Response(JSON.stringify({ error: 'Missing uid or email' }), { status: 400 });

    const headers = { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' };
    const now = new Date().toISOString();

    // إنشاء ملف زائر إذا لم يكن موجوداً
    await fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles`, { method: 'POST', headers, body: JSON.stringify({ uid, identified_email: email, is_identified: true, lead_status: 'cold', lead_score: 0, total_visits: 0, total_conversions: 0, first_seen_at: now, last_seen_at: now }) });

    // إضافة مصدر الحملة
    if (campaign_name) {
      await fetch(`${SUPABASE_URL}/rest/v1/acquisitions`, { method: 'POST', headers, body: JSON.stringify({ uid, source: source || 'cold_email', source_type: 'cold_email', utm_campaign: campaign_name, first_visit_at: now }) });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Server Error' }), { status: 500 });
  }
}