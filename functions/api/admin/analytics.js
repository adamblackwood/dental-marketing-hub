// functions/api/admin/analytics.js
import { SUPABASE_URL, SUPABASE_ANON_KEY, ADMIN_PASSWORD } from '../config.js';

const checkAuth = (request) => {
  const cookie = request.headers.get('Cookie') || '';
  return cookie.includes(`admin_session=${ADMIN_PASSWORD}`);
};

export async function onRequestGet(context) {
  if (!checkAuth(context.request)) return new Response('Unauthorized', { status: 401 });

  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
  };

  try {
    // Using Prefer: count=exact and Range: 0-0 to efficiently get counts without downloading all rows
    const fetchCount = async (path) => {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        headers: { ...headers, 'Prefer': 'count=exact', 'Range': '0-0' }
      });
      const range = res.headers.get('content-range');
      return range ? parseInt(range.split('/')[1], 10) : 0;
    };

    const [totalVisitors, hotLeads, totalVisits, totalConversions] = await Promise.all([
      fetchCount('visitor_profiles'),
      fetchCount('visitor_profiles?lead_status=eq.hot'),
      fetchCount('visits'),
      fetchCount('events?event_type=in.(file_download,form_submit,affiliate_click)')
    ]);

    return new Response(JSON.stringify({
      total_visitors: totalVisitors,
      hot_leads: hotLeads,
      total_visits: totalVisits,
      total_conversions: totalConversions
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}