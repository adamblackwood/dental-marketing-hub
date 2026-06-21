// functions/api/track.js

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const supabaseHeaders = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal'
};

function parseUserAgent(ua) {
  const device_type = /Mobi|Android|iPhone/i.test(ua) ? 'mobile' : (/iPad|Tablet/i.test(ua) ? 'tablet' : 'desktop');
  let browser = 'other';
  if (/Edg/i.test(ua)) browser = 'edge';
  else if (/Chrome/i.test(ua) && !/Chromium/i.test(ua)) browser = 'chrome';
  else if (/Firefox/i.test(ua)) browser = 'firefox';
  else if (/Safari/i.test(ua)) browser = 'safari';

  let operating_system = 'other';
  if (/Windows/i.test(ua)) operating_system = 'windows';
  else if (/Mac OS/i.test(ua)) operating_system = 'macos';
  else if (/Android/i.test(ua)) operating_system = 'android';
  else if (/iPhone|iPad|iPod/i.test(ua)) operating_system = 'ios';

  return { device_type, browser, operating_system };
}

export async function onRequestPost(context) {
  try {
    let payload;
    const contentType = context.request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      payload = await context.request.json();
    } else {
      const text = await context.request.text();
      try { payload = JSON.parse(text); } catch(e) { payload = {}; }
    }

    const { type, session_id, uid } = payload;

    if (!type || !session_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
    }

    const cf = context.request.cf || {};
    const country = cf.country || 'Unknown';
    const city = cf.city || 'Unknown';
    const userAgent = context.request.headers.get('User-Agent') || 'Unknown';
    const deviceInfo = parseUserAgent(userAgent);

    switch (type) {
      case 'session_start': {
        const finalUid = uid || `uid_${crypto.randomUUID().split('-')[0]}`;
        
        // 1. Upsert الزائر
        const visitorData = {
          uid: finalUid,
          last_seen_at: new Date().toISOString()
        };

        await fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles?on_conflict=uid`, {
          method: 'POST',
          headers: { ...supabaseHeaders, 'Prefer': 'resolution=merge-duplicates' },
          body: JSON.stringify(visitorData)
        });

        // 2. زيادة عداد الزيارات (Fetch -> Increment -> Patch)
        const vCountRes = await fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles?uid=eq.${finalUid}&select=total_visits`, { headers: supabaseHeaders });
        const vCountData = await vCountRes.json();
        const currentVisits = vCountData[0]?.total_visits || 0;

        context.waitUntil(fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles?uid=eq.${finalUid}`, {
          method: 'PATCH',
          headers: supabaseHeaders,
          body: JSON.stringify({ total_visits: currentVisits + 1 })
        }));

        // 3. معالجة المصدر (Acquisition)
        let acquisitionId = null;
        if (payload.utm_campaign || payload.utm_source) {
          const source = payload.utm_source || 'direct';
          const campaign = payload.utm_campaign || 'unknown';
          
          const acqData = {
            uid: finalUid,
            source: source,
            source_type: source === 'email' ? 'cold_email' : (source === 'facebook' || source === 'twitter' ? 'paid_ads' : 'direct'),
            utm_source: source,
            utm_campaign: campaign,
            landing_page: payload.entry_page || '/',
            country: country,
            city: city
          };

          const acqRes = await fetch(`${SUPABASE_URL}/rest/v1/acquisitions?on_conflict=uid,utm_campaign&select=acquisition_id`, {
            method: 'POST',
            headers: { ...supabaseHeaders, 'Prefer': 'resolution=merge-duplicates' },
            body: JSON.stringify(acqData)
          });
          
          const acqDataRes = await acqRes.json();
          if (acqDataRes && acqDataRes.length > 0) {
            acquisitionId = acqDataRes[0].acquisition_id;
          } else {
            const getAcq = await fetch(`${SUPABASE_URL}/rest/v1/acquisitions?uid=eq.${finalUid}&utm_campaign=eq.${campaign}&select=acquisition_id`, { headers: supabaseHeaders });
            const getAcqData = await getAcq.json();
            if (getAcqData.length > 0) acquisitionId = getAcqData[0].acquisition_id;
          }
        }

        // 4. إنشاء زيارة جديدة (Visit)
        const visitData = {
          uid: finalUid,
          acquisition_id: acquisitionId,
          entry_page: payload.entry_page || '/',
          visit_date: new Date().toISOString().split('T')[0],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        const visitRes = await fetch(`${SUPABASE_URL}/rest/v1/visits?select=visit_id`, {
          method: 'POST',
          headers: { ...supabaseHeaders, 'Prefer': 'return=representation' },
          body: JSON.stringify(visitData)
        });
        const visitDataRes = await visitRes.json();
        const visitId = visitDataRes[0].visit_id;

        // 5. إنشاء جلسة جديدة (Session)
        const sessionData = {
          session_id: session_id,
          visit_id: visitId,
          started_at: new Date().toISOString(),
          last_activity_at: new Date().toISOString(),
          device_type: deviceInfo.device_type,
          browser: deviceInfo.browser,
          operating_system: deviceInfo.operating_system,
          country: country,
          city: city
        };
        await fetch(`${SUPABASE_URL}/rest/v1/sessions`, {
          method: 'POST',
          headers: supabaseHeaders,
          body: JSON.stringify(sessionData)
        });

        break;
      }

      case 'heartbeat': {
        const heartbeatData = {
          duration_sec: payload.duration_sec,
          last_activity_at: new Date().toISOString(),
          is_bounce: false
        };
        
        context.waitUntil(fetch(`${SUPABASE_URL}/rest/v1/sessions?session_id=eq.${session_id}`, { 
            method: 'PATCH', 
            headers: supabaseHeaders, 
            body: JSON.stringify(heartbeatData) 
        }));
        break;
      }

      case 'scroll': {
        const scrollData = {
          max_scroll_pct: payload.max_scroll_pct,
          is_bounce: false
        };
        
        context.waitUntil(fetch(`${SUPABASE_URL}/rest/v1/sessions?session_id=eq.${session_id}`, { 
            method: 'PATCH', 
            headers: supabaseHeaders, 
            body: JSON.stringify(scrollData) 
        }));
        break;
      }

      case 'exit': {
        const exitData = {
          duration_sec: payload.duration_sec,
          max_scroll_pct: payload.max_scroll_pct,
          ended_at: new Date().toISOString(),
          is_bounce: payload.duration_sec < 10 && payload.max_scroll_pct < 25
        };
        
        const sessRes = await fetch(`${SUPABASE_URL}/rest/v1/sessions?session_id=eq.${session_id}&select=visit_id`, { headers: supabaseHeaders });
        const sessData = await sessRes.json();
        
        if (sessData.length > 0) {
          const visitId = sessData[0].visit_id;
          context.waitUntil(Promise.all([
            fetch(`${SUPABASE_URL}/rest/v1/sessions?session_id=eq.${session_id}`, { method: 'PATCH', headers: supabaseHeaders, body: JSON.stringify(exitData) }),
            fetch(`${SUPABASE_URL}/rest/v1/visits?visit_id=eq.${visitId}`, { method: 'PATCH', headers: supabaseHeaders, body: JSON.stringify({ ...exitData, exit_page: payload.exit_page, updated_at: new Date().toISOString() }) }),
            fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles?uid=eq.${payload.uid}`, { method: 'PATCH', headers: supabaseHeaders, body: JSON.stringify({ max_scroll_ever_pct: payload.max_scroll_pct }) })
          ]));
        }
        break;
      }

      default:
        return new Response(JSON.stringify({ error: 'Invalid tracking type' }), { status: 400 });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Tracking Error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
}