// functions/api/debug.js
// واجهة فحص البيانات الخام مؤقتة (ترجع آخر 5 زوار)

import { SUPABASE_URL, SUPABASE_SERVICE_KEY } from './config.js';

export async function onRequestGet(context) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles?select=uid,identified_email,lead_status,total_visits&order=last_seen_at.desc.nullslast&limit=5`, {
    headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
  });
  const data = await res.json();
  return new Response(JSON.stringify(data, null, 2), { headers: { 'Content-Type': 'application/json' } });
}