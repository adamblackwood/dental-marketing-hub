// functions/api/track.js
// نقطة النهاية المركزية لاستقبال جميع أحداث التتبع من العميل
// يعالج: session_start, heartbeat, scroll, exit, form_submit, file_download, affiliate_redirect, email_open
// قاعدة صارمة: لا يُسمح بـ INSERT في جدول events عند heartbeat أو scroll

import { SUPABASE_URL, SUPABASE_SERVICE_KEY } from './config.js';

// أدوات مساعدة
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

async function sbFetch(method, table, queryParams = '', body = null) {
  const url = `${SUPABASE_URL}/rest/v1/${table}${queryParams}`;
  const headers = { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' };
  const options = { method, headers };
  if (body !== null) options.body = JSON.stringify(body);
  const res = await fetch(url, options);
  if (!res.ok) { console.error(`SB ${method} ${table} failed:`, await res.text()); return null; }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function safeIncrement(table, matchQuery, fieldName, incrementBy = 1) {
  const rows = await sbFetch('GET', table, `?${matchQuery}&select=${fieldName}`);
  if (rows && rows.length > 0) {
    const currentVal = Number(rows[0][fieldName]) || 0;
    await sbFetch('PATCH', table, `?${matchQuery}`, { [fieldName]: currentVal + incrementBy });
  }
}

async function updateMaxValue(table, matchQuery, fieldName, newValue) {
  const rows = await sbFetch('GET', table, `?${matchQuery}&select=${fieldName}`);
  if (rows && rows.length > 0) {
    const currentVal = Number(rows[0][fieldName]) || 0;
    if (newValue > currentVal) await sbFetch('PATCH', table, `?${matchQuery}`, { [fieldName]: newValue });
  }
}

// المُوجّه الرئيسي
export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const { event_type, uid, session_id, ...data } = body;
    if (!uid || !event_type) return jsonResponse({ error: 'Missing uid or event_type' }, 400);

    switch (event_type) {
      case 'session_start': return await handleSessionStart(uid, session_id, data);
      case 'heartbeat': return await handleHeartbeat(uid, session_id, data);
      case 'scroll': return await handleScroll(uid, session_id, data);
      case 'exit': return await handleExit(uid, session_id, data);
      case 'form_submit': 
      case 'file_download': 
      case 'affiliate_redirect': return await handleConversion(uid, session_id, event_type, data);
      case 'email_open': return await handleEmailOpen(uid, data);
      default: return jsonResponse({ error: 'Unknown event_type' }, 400);
    }
  } catch (err) {
    console.error('Track error:', err);
    return jsonResponse({ error: 'Internal Server Error' }, 500);
  }
}

// 1) SESSION_START
async function handleSessionStart(uid, session_id, data) {
  const now = new Date().toISOString();
  const finalSessionId = session_id || crypto.randomUUID();
  const profile = await sbFetch('GET', 'visitor_profiles', `?uid=eq.${uid}&select=total_visits,fingerprint_id`);

  if (profile && profile.length > 0) {
    const currentVisits = Number(profile[0].total_visits) || 0;
    await sbFetch('PATCH', 'visitor_profiles', `?uid=eq.${uid}`, { total_visits: currentVisits + 1, last_seen_at: now });
  } else {
    await sbFetch('POST', 'visitor_profiles', '', { uid, fingerprint_id: data.fingerprint_id || null, is_identified: false, lead_status: 'cold', lead_score: 0, total_visits: 1, total_campaigns: 0, total_email_opens: 0, total_conversions: 0, total_time_on_site_sec: 0, max_scroll_ever_pct: 0, first_seen_at: now, last_seen_at: now });
  }

  let acquisition_id = null;
  if (data.utm_campaign) {
    const acq = await sbFetch('GET', 'acquisitions', `?uid=eq.${uid}&utm_campaign=eq.${encodeURIComponent(data.utm_campaign)}&select=acquisition_id`);
    if (acq && acq.length > 0) { acquisition_id = acq[0].acquisition_id; } 
    else {
      const newAcq = await sbFetch('POST', 'acquisitions', '', { uid, source: data.source || 'direct', source_type: data.source_type || 'organic', utm_source: data.utm_source || null, utm_campaign: data.utm_campaign, landing_page: data.landing_page || '/', country: data.country || null, city: data.city || null, first_visit_at: now });
      if (newAcq && newAcq.length > 0) { acquisition_id = newAcq[0].acquisition_id; await safeIncrement('visitor_profiles', `uid=eq.${uid}`, 'total_campaigns', 1); }
    }
  }

  const visit_id = crypto.randomUUID();
  await sbFetch('POST', 'visits', '', { visit_id, uid, acquisition_id, entry_page: data.landing_page || '/', exit_page: data.landing_page || '/', duration_sec: 0, max_scroll_pct: 0, is_bounce: true, visit_date: now.split('T')[0] });
  await sbFetch('POST', 'sessions', '', { session_id: finalSessionId, visit_id, started_at: now, last_activity_at: now, ended_at: null, duration_sec: 0, max_scroll_pct: 0, is_bounce: true, device_type: data.device_type || null, browser: data.browser || null, operating_system: data.operating_system || null, country: data.country || null, city: data.city || null });

  return jsonResponse({ success: true, visit_id, session_id: finalSessionId });
}

// 2) HEARTBEAT
async function handleHeartbeat(uid, session_id, data) {
  if (!session_id) return jsonResponse({ error: 'Missing session_id' }, 400);
  await sbFetch('PATCH', 'sessions', `?session_id=eq.${session_id}&ended_at=is.null`, { last_activity_at: new Date().toISOString() });
  return jsonResponse({ success: true });
}

// 3) SCROLL
async function handleScroll(uid, session_id, data) {
  const scrollPct = Number(data.scroll_pct) || 0;
  if (!session_id) return jsonResponse({ error: 'Missing session_id' }, 400);
  await updateMaxValue('sessions', `session_id=eq.${session_id}`, 'max_scroll_pct', scrollPct);
  const sesRows = await sbFetch('GET', 'sessions', `?session_id=eq.${session_id}&select=visit_id`);
  if (sesRows && sesRows.length > 0 && sesRows[0].visit_id) await updateMaxValue('visits', `visit_id=eq.${sesRows[0].visit_id}`, 'max_scroll_pct', scrollPct);
  await updateMaxValue('visitor_profiles', `uid=eq.${uid}`, 'max_scroll_ever_pct', scrollPct);
  return jsonResponse({ success: true });
}

// 4) EXIT
async function handleExit(uid, session_id, data) {
  if (!session_id) return jsonResponse({ error: 'Missing session_id' }, 400);
  const now = new Date().toISOString();
  const durationSec = Number(data.duration_sec) || 0;
  const scrollPct = Number(data.scroll_pct) || 0;
  const isBounce = durationSec < 10;

  const sesRows = await sbFetch('GET', 'sessions', `?session_id=eq.${session_id}&select=ended_at,visit_id`);
  if (!sesRows || sesRows.length === 0 || sesRows[0].ended_at) return jsonResponse({ success: true, note: 'already_ended' });

  await sbFetch('PATCH', 'sessions', `?session_id=eq.${session_id}`, { ended_at: now, duration_sec: durationSec, max_scroll_pct: scrollPct, is_bounce: isBounce });
  
  const visit_id = sesRows[0].visit_id;
  if (visit_id) {
    const visitUpdates = { duration_sec: durationSec, max_scroll_pct: scrollPct, is_bounce: isBounce };
    if (data.exit_page) visitUpdates.exit_page = data.exit_page;
    await sbFetch('PATCH', 'visits', `?visit_id=eq.${visit_id}`, visitUpdates);
  }

  const profileRows = await sbFetch('GET', 'visitor_profiles', `?uid=eq.${uid}&select=total_time_on_site_sec,max_scroll_ever_pct`);
  if (profileRows && profileRows.length > 0) {
    const currentTotalTime = Number(profileRows[0].total_time_on_site_sec) || 0;
    const currentMaxScroll = Number(profileRows[0].max_scroll_ever_pct) || 0;
    const profileUpdates = { total_time_on_site_sec: currentTotalTime + durationSec, last_seen_at: now };
    if (scrollPct > currentMaxScroll) profileUpdates.max_scroll_ever_pct = scrollPct;
    await sbFetch('PATCH', 'visitor_profiles', `?uid=eq.${uid}`, profileUpdates);
  }
  return jsonResponse({ success: true });
}

// 5) CONVERSIONS
async function handleConversion(uid, session_id, event_type, data) {
  const now = new Date().toISOString();
  await sbFetch('POST', 'events', '', { uid, session_id: session_id || null, event_type, event_value: data.event_value || null, created_at: now });
  await safeIncrement('visitor_profiles', `uid=eq.${uid}`, 'total_conversions', 1);

  const scoreMap = { 'form_submit': 30, 'file_download': 20, 'affiliate_redirect': 50 };
  const scoreAdd = scoreMap[event_type] || 10;
  const profile = await sbFetch('GET', 'visitor_profiles', `?uid=eq.${uid}&select=lead_score,lead_status`);
  if (profile && profile.length > 0) {
    const currentScore = Number(profile[0].lead_score) || 0;
    const newScore = currentScore + scoreAdd;
    let newStatus = profile[0].lead_status;
    if (newScore >= 70) newStatus = 'hot'; else if (newScore >= 30) newStatus = 'warm';
    await sbFetch('PATCH', 'visitor_profiles', `?uid=eq.${uid}`, { lead_score: newScore, lead_status: newStatus, last_seen_at: now });
  }
  if (session_id) await sbFetch('PATCH', 'sessions', `?session_id=eq.${session_id}`, { is_bounce: false });
  return jsonResponse({ success: true });
}

// 6) EMAIL_OPEN
async function handleEmailOpen(uid, data) {
  const now = new Date().toISOString();
  const campaignName = data.campaign_name || null;
  if (campaignName) {
    const existing = await sbFetch('GET', 'email_activities', `?uid=eq.${uid}&campaign_name=eq.${encodeURIComponent(campaignName)}&select=open_count`);
    if (existing && existing.length > 0) {
      const currentOpens = Number(existing[0].open_count) || 0;
      await sbFetch('PATCH', 'email_activities', `?uid=eq.${uid}&campaign_name=eq.${encodeURIComponent(campaignName)}`, { open_count: currentOpens + 1, last_open_at: now, entered_site: true });
    } else {
      await sbFetch('POST', 'email_activities', '', { uid, campaign_name: campaignName, email_address: data.email_address || null, first_open_at: now, last_open_at: now, open_count: 1, entered_site: true, country: data.country || null, city: data.city || null, device_type: data.device_type || null, operating_system: data.operating_system || null });
      await safeIncrement('visitor_profiles', `uid=eq.${uid}`, 'total_campaigns', 1);
    }
  }
  await safeIncrement('visitor_profiles', `uid=eq.${uid}`, 'total_email_opens', 1);
  await sbFetch('POST', 'events', '', { uid, session_id: null, event_type: 'email_open', event_value: campaignName, created_at: now });
  return jsonResponse({ success: true });
}