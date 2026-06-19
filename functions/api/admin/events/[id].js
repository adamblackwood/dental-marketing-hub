// functions/api/admin/events/[id].js

import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../../../config.js';

const supabaseHeaders = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal'
};

// 🚀 حذف الحدث
export async function onRequestDelete(context) {
  try {
    // التحقق من الأمان
    const cookie = context.request.headers.get('Cookie') || '';
    if (!cookie.includes('admin_session=true')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }
    
    // التقاط الـ ID من الرابط (event_id في هذه الحالة)
    const event_id = context.params.id;
    
    // إرسال طلب الحذف لـ Supabase
    const res = await fetch(`${SUPABASE_URL}/rest/v1/events?event_id=eq.${event_id}`, {
      method: 'DELETE',
      headers: supabaseHeaders
    });
    
    if (!res.ok) throw new Error('Failed to delete event');
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}