// functions/api/track.js
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const sbFetch = (path, method, body, prefer) => {
  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json'
  };
  if (prefer) headers['Prefer'] = prefer;
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
};

// Helper: Micro-Scoring System
const updateLeadScore = async (uid, scoreToAdd) => {
  const profRes = await sbFetch(`visitor_profiles?uid=eq.${uid}&select=lead_score,lead_status`, 'GET');
  const profData = await profRes.json();
  if (profData.length > 0) {
    const newScore = profData[0].lead_score + scoreToAdd;
    const newStatus = newScore >= 70 ? 'hot' : (newScore >= 30 ? 'warm' : 'cold');
    await sbFetch(`visitor_profiles?uid=eq.${uid}`, 'PATCH', {
      lead_score: newScore,
      lead_status: newStatus,
      last_seen_at: new Date().toISOString()
    });
  }
};

const getVisitIdFromSession = async (session_id) => {
  const res = await sbFetch(`sessions?session_id=eq.${session_id}&select=visit_id`, 'GET');
  const data = await res.json();
  return data.length > 0 ? data[0].visit_id : null;
};

export async function onRequestPost(context) {
  try {
    const data = await context.request.json();
    const { event_type, uid, session_id } = data;
    const now = new Date().toISOString();
    
    if (!uid || !session_id || !event_type) {
      return new Response(JSON.stringify({ error: 'Missing core parameters' }), { status: 400 });
    }

    // ------------------------------------------------------------------
    // 1. SESSION_START
    // ------------------------------------------------------------------
    if (event_type === 'session_start') {
      const checkSessRes = await sbFetch(`sessions?session_id=eq.${session_id}&select=visit_id`, 'GET');
      const checkSessData = await checkSessRes.json();
      
      if (checkSessData.length > 0) {
        // Session exists (User navigated to a new HTML page or refreshed)
        const visitId = checkSessData[0].visit_id;
        await sbFetch(`sessions?session_id=eq.${session_id}`, 'PATCH', { last_activity_at: now });
        
        // Check if URL is different from the last one in journey to avoid bloat on refresh
        const journeyRes = await sbFetch(`visit_journeys?visit_id=eq.${visitId}&select=journey`, 'GET');
        const journeyData = await journeyRes.json();
        const currentJourney = journeyData[0].journey;
        
        if (currentJourney[currentJourney.length - 1] !== data.landing_page) {
          // It's a genuine page navigation, not a refresh
          currentJourney.push(data.landing_page);
          await sbFetch(`visit_journeys?visit_id=eq.${visitId}`, 'PATCH', { journey: currentJourney });
          
          // Micro-Scoring for page view (+2)
          await updateLeadScore(uid, 2);

          const visitRes = await sbFetch(`visits?visit_id=eq.${visitId}&select=pages_viewed`, 'GET');
          const visitData = await visitRes.json();
          const pagesViewed = visitData[0].pages_viewed + 1;
          await sbFetch(`visits?visit_id=eq.${visitId}`, 'PATCH', {
            exit_page: data.landing_page,
            pages_viewed: pagesViewed
          });
        }
        return new Response(JSON.stringify({ success: true, visit_id: visitId }), { status: 200 });
      }

      // It's a completely new session. Upsert visitor_profiles
      await sbFetch('visitor_profiles', 'POST', {
        uid,
        last_seen_at: now
      }, 'resolution=merge-duplicates');

      const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const sessRes = await sbFetch(`sessions?uid=eq.${uid}&order=last_activity_at.desc&limit=1&select=last_activity_at,visit_id`, 'GET');
      const sessData = await sessRes.json();
      
      let visitId;
      let isNewVisit = true;

      if (sessData.length > 0) {
        const lastActivity = new Date(sessData[0].last_activity_at);
        if (lastActivity > new Date(thirtyMinsAgo)) {
          isNewVisit = false;
          visitId = sessData[0].visit_id;
        }
      }

      if (isNewVisit) {
        const visitRes = await sbFetch('visits', 'POST', {
          uid,
          entry_page: data.landing_page,
          exit_page: data.landing_page,
          started_at: now,
          is_bounce: true
        }, 'return=representation');
        const visitData = await visitRes.json();
        visitId = visitData[0].visit_id;

        await sbFetch('visit_journeys', 'POST', {
          visit_id: visitId,
          uid,
          journey: [data.landing_page]
        });

        const profRes = await sbFetch(`visitor_profiles?uid=eq.${uid}&select=total_visits`, 'GET');
        const profData = await profRes.json();
        const totalVisits = profData.length > 0 ? profData[0].total_visits + 1 : 1;
        await sbFetch(`visitor_profiles?uid=eq.${uid}`, 'PATCH', { total_visits: totalVisits });

      } else {
        // Active visit exists within 30 mins - Append to journey if new URL
        const journeyRes = await sbFetch(`visit_journeys?visit_id=eq.${visitId}&select=journey`, 'GET');
        const journeyData = await journeyRes.json();
        const currentJourney = journeyData[0].journey;
        
        if (currentJourney[currentJourney.length - 1] !== data.landing_page) {
          currentJourney.push(data.landing_page);
          await sbFetch(`visit_journeys?visit_id=eq.${visitId}`, 'PATCH', { journey: currentJourney });
          await updateLeadScore(uid, 2); // +2 for new page

          const visitRes = await sbFetch(`visits?visit_id=eq.${visitId}&select=pages_viewed`, 'GET');
          const visitData = await visitRes.json();
          const pagesViewed = visitData[0].pages_viewed + 1;
          await sbFetch(`visits?visit_id=eq.${visitId}`, 'PATCH', {
            exit_page: data.landing_page,
            pages_viewed: pagesViewed
          });
        }
      }

      // Insert new session
      await sbFetch('sessions', 'POST', {
        session_id: session_id,
        visit_id: visitId,
        uid,
        device_type: data.device_type || 'unknown',
        started_at: now,
        last_activity_at: now
      });

      return new Response(JSON.stringify({ success: true, visit_id: visitId }), { status: 200 });
    }

    // ------------------------------------------------------------------
    // 2. PAGE_CHANGE (For SPA pushState navigations)
    // ------------------------------------------------------------------
    if (event_type === 'page_change') {
      const visitId = await getVisitIdFromSession(session_id);
      if (!visitId) return new Response(JSON.stringify({ error: 'Session not found' }), { status: 404 });

      await sbFetch(`sessions?session_id=eq.${session_id}`, 'PATCH', { last_activity_at: now });

      const journeyRes = await sbFetch(`visit_journeys?visit_id=eq.${visitId}&select=journey`, 'GET');
      const journeyData = await journeyRes.json();
      const currentJourney = journeyData[0].journey;
      
      if (currentJourney[currentJourney.length - 1] !== data.page) {
        currentJourney.push(data.page);
        await sbFetch(`visit_journeys?visit_id=eq.${visitId}`, 'PATCH', { journey: currentJourney });
        await updateLeadScore(uid, 2); // Micro-Scoring +2

        const visitRes = await sbFetch(`visits?visit_id=eq.${visitId}&select=pages_viewed`, 'GET');
        const visitData = await visitRes.json();
        const pagesViewed = visitData[0].pages_viewed + 1;
        await sbFetch(`visits?visit_id=eq.${visitId}`, 'PATCH', {
          exit_page: data.page,
          pages_viewed: pagesViewed
        });
      }

      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }

    // ------------------------------------------------------------------
    // 3. EXIT
    // ------------------------------------------------------------------
    if (event_type === 'exit') {
      const visitId = await getVisitIdFromSession(session_id);
      if (!visitId) return new Response(JSON.stringify({ error: 'Session not found' }), { status: 404 });

      // FIX: Removed max_scroll_pct from here to prevent overwriting the session's highest scroll
      await sbFetch(`sessions?session_id=eq.${session_id}`, 'PATCH', {
        ended_at: now,
        duration_sec: data.duration_sec
      });

      await sbFetch(`visits?visit_id=eq.${visitId}`, 'PATCH', {
        ended_at: now,
        duration_sec: data.duration_sec,
        is_bounce: false,
        exit_page: data.page
      });

      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }

    // ------------------------------------------------------------------
    // 4. HEARTBEAT
    // ------------------------------------------------------------------
    if (event_type === 'heartbeat') {
      await sbFetch(`sessions?session_id=eq.${session_id}`, 'PATCH', { last_activity_at: now });
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }

    // ------------------------------------------------------------------
    // 5. SCROLL (Micro-Scoring at 50% and 100%)
    // ------------------------------------------------------------------
    if (event_type === 'scroll') {
      const sessRes = await sbFetch(`sessions?session_id=eq.${session_id}&select=max_scroll_pct`, 'GET');
      const sessData = await sessRes.json();
      
      if (sessData.length > 0 && data.scroll > sessData[0].max_scroll_pct) {
        await sbFetch(`sessions?session_id=eq.${session_id}`, 'PATCH', { max_scroll_pct: data.scroll });
        
        // Award points only the first time they hit 50% and 100%
        if (data.scroll === 50 || data.scroll === 100) {
          await updateLeadScore(uid, 2); // Micro-Scoring +2
        }
      }
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }

    // ------------------------------------------------------------------
    // 6. COMMERCIAL EVENTS
    // ------------------------------------------------------------------
    const commercialEvents = ['file_download', 'form_submit', 'affiliate_click'];
    if (commercialEvents.includes(event_type)) {
      const visitId = await getVisitIdFromSession(session_id);
      const scoreMap = { file_download: 20, form_submit: 30, affiliate_click: 50 };
      const scoreToAdd = scoreMap[event_type];

      await sbFetch('events', 'POST', {
        event_uuid: crypto.randomUUID(),
        uid,
        visit_id: visitId,
        session_id: session_id,
        event_type: event_type,
        event_value: data.value || null,
        created_at: now
      });

      const profRes = await sbFetch(`visitor_profiles?uid=eq.${uid}&select=lead_score,total_conversions`, 'GET');
      const profData = await profRes.json();
      if (profData.length > 0) {
        const newScore = profData[0].lead_score + scoreToAdd;
        const newConversions = profData[0].total_conversions + 1;
        const newStatus = newScore >= 70 ? 'hot' : (newScore >= 30 ? 'warm' : 'cold');
        
        await sbFetch(`visitor_profiles?uid=eq.${uid}`, 'PATCH', {
          lead_score: newScore,
          total_conversions: newConversions,
          lead_status: newStatus,
          last_seen_at: now
        });
      }

      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }

    return new Response(JSON.stringify({ error: 'Invalid event_type' }), { status: 400 });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}