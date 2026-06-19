// functions/api/admin/sessions/[id].js

import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../../../config.js';

const supabaseHeaders = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal'
};

// 🚀 حذف الجلسة
export async function onRequestDelete(context) {
  try {
    // التحقق من الأمان
    const cookie = context.request.headers.get('Cookie') || '';
    if (!cookie.includes('admin_session=true')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }
    
    // التقاط الـ ID من الرابط
    const session_id = context.params.id;
    
    // إرسال طلب الحذف لـ Supabase
    const res = await fetch(`${SUPABASE_URL}/rest/v1/sessions?session_id=eq.${session_id}`, {
      method: 'DELETE',
      headers: supabaseHeaders
    });
    
    if (!res.ok) throw new Error('Failed to delete session');
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}