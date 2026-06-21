// functions/api/debug.js

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const supabaseHeaders = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
};

export async function onRequestGet(context) {
  try {
    // دالة مساعدة لجلب آخر 10 سجلات من أي جدول
    const fetchTable = (table, orderCol) => 
      fetch(`${SUPABASE_URL}/rest/v1/${table}?order=${orderCol}.desc&limit=10`, { headers: supabaseHeaders })
        .then(res => res.json());

    // جلب البيانات من الجداول الستة بالتوازي
    const [visitors, acquisitions, visits, sessions, emails, events] = await Promise.all([
      fetchTable('visitor_profiles', 'last_seen_at'),
      fetchTable('acquisitions', 'first_visit_at'),
      fetchTable('visits', 'created_at'),
      fetchTable('sessions', 'started_at'),
      fetchTable('email_activities', 'last_open_at'),
      fetchTable('events', 'created_at')
    ]);

    return new Response(JSON.stringify({
      visitors, acquisitions, visits, sessions, emails, events
    }, null, 2), { // null, 2 لتنسيق الـ JSON ليكون مقروءاً
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}