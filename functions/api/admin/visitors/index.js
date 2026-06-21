// functions/api/admin/visitors/index.js

import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../../config.js';

const supabaseHeaders = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal'
};

// جلب الزوار (للرادار)
export async function onRequestGet(context) {
  try {
    const cookie = context.request.headers.get('Cookie') || '';
    if (!cookie.includes('admin_session=true')) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

    const url = new URL(context.request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = 25;
    const from = (page - 1) * limit;

    const res = await fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles?select=uid,identified_name,identified_email,lead_status,lead_score,total_visits,total_conversions,last_seen_at&order=last_seen_at.desc.nullslast&offset=${from}&limit=${limit}`, {
      headers: { ...supabaseHeaders, 'Prefer': 'count=exact' }
    });

    const contentRange = res.headers.get('content-range');
    const total = contentRange ? parseInt(contentRange.split('/')[1]) : 0;
    const data = await res.json();

    return new Response(JSON.stringify({ data, total, page, limit }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

// إضافة زائر يدوياً
export async function onRequestPost(context) {
  try {
    const cookie = context.request.headers.get('Cookie') || '';
    if (!cookie.includes('admin_session=true')) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

    const body = await context.request.json();
    const newVisitor = {
      uid: `uid_${crypto.randomUUID().split('-')[0]}`,
      identified_name: body.name || null,
      identified_email: body.email || null,
      is_identified: body.email ? true : false,
      lead_status: body.is_hot_lead ? 'hot' : 'cold',
      last_seen_at: new Date().toISOString()
    };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles`, {
      method: 'POST',
      headers: supabaseHeaders,
      body: JSON.stringify(newVisitor)
    });

    if (!res.ok) throw new Error('Failed to add visitor');
    return new Response(JSON.stringify({ success: true }), { status: 201, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}