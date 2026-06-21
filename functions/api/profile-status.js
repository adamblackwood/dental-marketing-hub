// functions/api/profile-status.js

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const supabaseHeaders = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json'
};

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const uid = url.searchParams.get('uid');

    if (!uid) return new Response(JSON.stringify({ error: 'Missing uid' }), { status: 400 });

    const res = await fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles?uid=eq.${uid}&select=*`, {
      headers: supabaseHeaders
    });
    
    const visitors = await res.json();
    
    if (visitors.length === 0 || !visitors[0].identified_email) {
      return new Response(JSON.stringify({ is_known: false, missing_fields: ['identified_email', 'identified_name'] }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      });
    }

    const visitor = visitors[0];
    const missing = [];
    if (!visitor.clinic_size) missing.push('clinic_size');
    if (!visitor.biggest_challenge) missing.push('biggest_challenge');
    if (!visitor.phone_number) missing.push('phone_number');

    return new Response(JSON.stringify({ is_known: true, name: visitor.identified_name, missing_fields: missing }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
}