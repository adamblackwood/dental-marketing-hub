// functions/api/admin/journey.js
import { SUPABASE_URL, SUPABASE_ANON_KEY, ADMIN_PASSWORD } from '../config.js';

const checkAuth = (request) => {
  const cookie = request.headers.get('Cookie') || '';
  return cookie.includes(`admin_session=${ADMIN_PASSWORD}`);
};

export async function onRequestGet(context) {
  if (!checkAuth(context.request)) return new Response('Unauthorized', { status: 401 });

  const url = new URL(context.request.url);
  const uid = url.searchParams.get('uid');
  if (!uid) return new Response(JSON.stringify({ error: 'Missing uid' }), { status: 400 });

  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
  };

  try {
    const [profileRes, acqRes, visitsRes, journeysRes, eventsRes, emailRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles?uid=eq.${uid}&select=*`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/acquisitions?uid=eq.${uid}&select=*`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/visits?uid=eq.${uid}&select=*&order=started_at.desc`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/visit_journeys?uid=eq.${uid}&select=*`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/events?uid=eq.${uid}&select=*&order=created_at.desc`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/email_activities?uid=eq.${uid}&select=*`, { headers })
    ]);

    const profile = await profileRes.json();
    const acquisitions = await acqRes.json();
    const visits = await visitsRes.json();
    const journeys = await journeysRes.json();
    const events = await eventsRes.json();
    const email_activities = await emailRes.json();

    return new Response(JSON.stringify({
      profile: profile[0] || null,
      acquisitions,
      visits,
      journeys,
      events,
      email_activities
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}