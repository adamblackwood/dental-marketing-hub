// functions/api/admin/visitors/[id].js

import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../../config.js';

const supabaseHeaders = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal'
};

export async function onRequestPatch(context) {
  try {
    const cookie = context.request.headers.get('Cookie') || '';
    if (!cookie.includes('admin_session=true')) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

    const uid = context.params.id;
    const body = await context.request.json();

    const updateData = {};
    if (body.identified_name !== undefined) updateData.identified_name = body.identified_name;
    if (body.identified_email !== undefined) updateData.identified_email = body.identified_email;
    if (body.is_hot_lead !== undefined) updateData.lead_status = body.is_hot_lead ? 'hot' : 'cold';

    const res = await fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles?uid=eq.${uid}`, {
      method: 'PATCH',
      headers: supabaseHeaders,
      body: JSON.stringify(updateData)
    });

    if (!res.ok) throw new Error('Failed to update visitor');
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

export async function onRequestDelete(context) {
  try {
    const cookie = context.request.headers.get('Cookie') || '';
    if (!cookie.includes('admin_session=true')) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

    const uid = context.params.id;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles?uid=eq.${uid}`, {
      method: 'DELETE',
      headers: supabaseHeaders
    });

    if (!res.ok) throw new Error('Failed to delete visitor');
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}