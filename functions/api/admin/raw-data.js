// functions/api/admin/raw-data.js
// واجهة جلب البيانات الخام للصفحة الجديدة مع Pagination و PATCH و DELETE

import { SUPABASE_URL, SUPABASE_SERVICE_KEY, ADMIN_PASSWORD } from '../config.js';

const TABLE_CONFIG = {
  visitor_profiles: { pk: 'uid' },
  acquisitions: { pk: 'acquisition_id' },
  visits: { pk: 'visit_id' },
  sessions: { pk: 'session_id' },
  email_activities: { pk: 'email_activity_id' },
  events: { pk: 'event_id' }
};

function checkAuth(request) {
  const cookieHeader = request.headers.get('cookie') || '';
  return cookieHeader.includes(`admin_session=${ADMIN_PASSWORD}`);
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export async function onRequestGet(context) {
  if (!checkAuth(context.request)) return jsonResponse({ error: 'Unauthorized' }, 401);
  const url = new URL(context.request.url);
  const table = url.searchParams.get('table');
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const limit = 20;
  const offset = (page - 1) * limit;

  if (!TABLE_CONFIG[table]) return jsonResponse({ error: 'Invalid table' }, 400);
  const pk = TABLE_CONFIG[table].pk;

  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*&order=${pk}.desc.nullslast&offset=${offset}&limit=${limit}`, {
    headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Range-Unit': 'items', 'Range': `${offset}-${offset + limit - 1}`, 'Prefer': 'count=exact' }
  });
  const data = await res.json();
  const contentRange = res.headers.get('content-range');
  let totalItems = 0;
  if (contentRange) { totalItems = parseInt(contentRange.split('/')[1], 10) || 0; }

  return jsonResponse({ data, pagination: { totalItems, currentPage: page, totalPages: Math.ceil(totalItems / limit) } });
}

export async function onRequestPatch(context) {
  if (!checkAuth(context.request)) return jsonResponse({ error: 'Unauthorized' }, 401);
  const url = new URL(context.request.url);
  const table = url.searchParams.get('table');
  const id = url.searchParams.get('id');
  if (!TABLE_CONFIG[table] || !id) return jsonResponse({ error: 'Invalid params' }, 400);

  const pk = TABLE_CONFIG[table].pk;
  const body = await context.request.json();
  delete body[pk]; // منع تعديل الـ PK

  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${pk}=eq.${id}`, {
    method: 'PATCH',
    headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
    body: JSON.stringify(body)
  });
  const updatedData = await res.json();
  return jsonResponse({ success: true, data: updatedData });
}

export async function onRequestDelete(context) {
  if (!checkAuth(context.request)) return jsonResponse({ error: 'Unauthorized' }, 401);
  const url = new URL(context.request.url);
  const table = url.searchParams.get('table');
  const id = url.searchParams.get('id');
  if (!TABLE_CONFIG[table] || !id) return jsonResponse({ error: 'Invalid params' }, 400);

  const pk = TABLE_CONFIG[table].pk;
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?${pk}=eq.${id}`, {
    method: 'DELETE',
    headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
  });
  return jsonResponse({ success: true });
}