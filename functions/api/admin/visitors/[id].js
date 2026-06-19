// functions/api/admin/visitors/[id].js

import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../../../config.js';

const supabaseHeaders = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal'
};

// 🚀 تعديل بيانات الزائر
export async function onRequestPatch(context) {
  try {
    // التحقق من الأمان
    const cookie = context.request.headers.get('Cookie') || '';
    if (!cookie.includes('admin_session=true')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    // التقاط الـ ID من الرابط تلقائياً
    const fingerprint_id = context.params.id; 
    const body = await context.request.json();

    // تجهيز البيانات التي سيتم تحديثها
    const updateData = {};
    if (body.identified_name !== undefined) updateData.identified_name = body.identified_name;
    if (body.identified_email !== undefined) updateData.identified_email = body.identified_email;
    if (body.clinic_size !== undefined) updateData.clinic_size = body.clinic_size;
    if (body.is_hot_lead !== undefined) updateData.is_hot_lead = body.is_hot_lead;

    // إرسال طلب التحديث لـ Supabase
    const res = await fetch(`${SUPABASE_URL}/rest/v1/visitors?fingerprint_id=eq.${fingerprint_id}`, {
      method: 'PATCH',
      headers: supabaseHeaders,
      body: JSON.stringify(updateData)
    });

    if (!res.ok) throw new Error('Failed to update visitor');

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

// 🚀 حذف الزائر
export async function onRequestDelete(context) {
  try {
    // التحقق من الأمان
    const cookie = context.request.headers.get('Cookie') || '';
    if (!cookie.includes('admin_session=true')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const fingerprint_id = context.params.id;

    // إرسال طلب الحذف لـ Supabase
    const res = await fetch(`${SUPABASE_URL}/rest/v1/visitors?fingerprint_id=eq.${fingerprint_id}`, {
      method: 'DELETE',
      headers: supabaseHeaders
    });

    if (!res.ok) throw new Error('Failed to delete visitor');

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}