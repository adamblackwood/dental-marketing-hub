// functions/api/track.js
// محرك التتبع المركزي V4.0 - يدعم قاعدة الـ 30 دقيقة، الرحلات (Journeys)، ويمنع تكدس البيانات

import { SUPABASE_URL, SUPABASE_SERVICE_KEY } from './config.js';

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

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const { event_type, uid, session_id, ...data } = body;
    if (!uid || !event_type) return jsonResponse({ error: 'Missing uid or event_type' }, 400);

    switch (event_type) {
      case 'session_start': return await handleSessionStart(uid, session_id, data);
      case 'page_change': return await handlePageChange(uid, session_id, data);
      case 'exit': return await handleExit(uid, session_id, data);
      case 'heartbeat': return await handleHeartbeat(session_id);
      case 'scroll': return await handleScroll(session_id, data);
      case 'file_download': 
      case 'form_submit': 
      case 'affiliate_click': return await handleConversion(uid, session_id, event_type, data);
      default: return jsonResponse({ error: 'Unknown event_type' }, 400);
    }
  } catch (err) {
    console.error('Track error:', err);
    return jsonResponse({ error: 'Internal Server Error' }, 500);
  }
}

// =============================================
// 1) SESSION_START (يحترم قاعدة الـ 30 دقيقة)
// =============================================
async function handleSessionStart(uid, session_id, data) {
  const now = new Date();
  const nowIso = now.toISOString();
  const finalSessionId = session_id || crypto.randomUUID();

  // أ. التأكد من وجود ملف الزائر
  let profile = await sbFetch('GET', `visitor_profiles?uid=eq.${uid}&select=uid`);
  if (!profile || profile.length === 0) {
    await sbFetch('POST', 'visitor_profiles', '', { uid, fingerprint_id: data.fingerprint_id || null });
  }

  // ب. معالجة المصادر (Acquisitions)
  let acquisition_id = null;
  if (data.utm_campaign || data.source) {
    const encCampaign = encodeURIComponent(data.utm_campaign || '');
    const encSource = encodeURIComponent(data.utm_source || '');
    const existingAcq = await sbFetch('GET', `acquisitions?uid=eq.${uid}&utm_source=eq.${encSource}&utm_campaign=eq.${encCampaign}&select=acquisition_id,touch_order`);
    
    if (existingAcq && existingAcq.length > 0) {
      acquisition_id = existingAcq[0].acquisition_id;
    } else {
      // حساب ترتيب اللمس (touch_order)
      const allAcq = await sbFetch('GET', `acquisitions?uid=eq.${uid}&select=acquisition_id`);
      const touch_order = allAcq ? allAcq.length + 1 : 1;
      
      const newAcq = await sbFetch('POST', 'acquisitions', '', {
        uid, source: data.source || 'direct', utm_source: data.utm_source || null, utm_campaign: data.utm_campaign || null, touch_order
      });
      if (newAcq) acquisition_id = newAcq[0].acquisition_id;
    }
  }

  // ج. فحص قاعدة الـ 30 دقيقة لتحديد إن كنا نفتح زيارة جديدة (Visit) أم لا
  let visit_id = null;
  let isNewVisit = true;
  
  const latestVisits = await sbFetch('GET', `visits?uid=eq.${uid}&order=started_at.desc&limit=1&select=visit_id,started_at`);
  
  if (latestVisits && latestVisits.length > 0) {
    const latestSes = await sbFetch('GET', `sessions?visit_id=eq.${latestVisits[0].visit_id}&order=last_activity_at.desc&limit=1&select=last_activity_at`);
    if (latestSes && latestSes.length > 0 && latestSes[0].last_activity_at) {
      const diffMs = now.getTime() - new Date(latestSes[0].last_activity_at).getTime();
      const diffMins = diffMs / 60000;
      if (diffMins < 30) {
        isNewVisit = false;
        visit_id = latestVisits[0].visit_id;
      }
    }
  }

  // د. إنشاء زيارة جديدة ورحلة جديدة إذا لزم الأمر
  if (isNewVisit) {
    visit_id = crypto.randomUUID();
    await sbFetch('POST', 'visits', '', { 
      visit_id, uid, acquisition_id, entry_page: data.landing_page || '/', exit_page: data.landing_page || '/', started_at: nowIso 
    });
    
    // إنشاء صف الرحلة (Journey) المرتبط بالزيارة
    await sbFetch('POST', 'visit_journeys', '', { 
      visit_id, uid, journey: [data.landing_page || '/'] 
    });

    // زيادة عداد الزيارات الكلي
    await sbFetch('PATCH', `visitor_profiles?uid=eq.${uid}`, '', { last_seen_at: nowIso, total_visits: (await sbFetch('GET', `visitor_profiles?uid=eq.${uid}&select=total_visits`))[0].total_visits + 1 });
  } else {
    // إذا لم تكن زيارة جديدة، نضيف صفحة الدخول للرحلة الحالية
    const journeyData = await sbFetch('GET', `visit_journeys?visit_id=eq.${visit_id}&select=journey`);
    if (journeyData && journeyData.length > 0 && data.landing_page) {
      let currentJourney = journeyData[0].journey || [];
      if (!currentJourney.includes(data.landing_page)) {
        currentJourney.push(data.landing_page);
        await sbFetch('PATCH', `visit_journeys?visit_id=eq.${visit_id}`, '', { journey: currentJourney });
      }
    }
    // تحديث صفحة الخروج وعدد الصفحات في الزيارة الحالية
    const visitData = await sbFetch('GET', `visits?visit_id=eq.${visit_id}&select=pages_viewed`);
    if(visitData && visitData.length > 0) {
       await sbFetch('PATCH', `visits?visit_id=eq.${visit_id}`, '', { exit_page: data.landing_page, pages_viewed: (visitData[0].pages_viewed || 0) + 1 });
    }
  }

  // هـ. إنشاء جلسة (Session) جديدة دائماً
  await sbFetch('POST', 'sessions', '', { 
    session_id: finalSessionId, visit_id, uid, device_type: data.device_type || null, started_at: nowIso, last_activity_at: nowIso 
  });

  return jsonResponse({ success: true, visit_id, session_id: finalSessionId });
}

// =============================================
// 2) PAGE_CHANGE (تحديث الرحلة فقط - بدون إدراج)
// =============================================
async function handlePageChange(uid, session_id, data) {
  if (!session_id || !data.page) return jsonResponse({ error: 'Missing data' }, 400);
  
  // 1. تحديث وقت النشاط في الجلسة
  await sbFetch('PATCH', `sessions?session_id=eq.${session_id}`, '', { last_activity_at: new Date().toISOString() });
  
  // 2. جلب الـ visit_id من الجلسة
  const sesRows = await sbFetch('GET', `sessions?session_id=eq.${session_id}&select=visit_id`);
  if (!sesRows || sesRows.length === 0) return jsonResponse({ success: true });
  
  const visit_id = sesRows[0].visit_id;

  // 3. إضافة الصفحة إلى مصفوفة الرحلة (Journey)
  const journeyData = await sbFetch('GET', `visit_journeys?visit_id=eq.${visit_id}&select=journey`);
  if (journeyData && journeyData.length > 0) {
    let currentJourney = journeyData[0].journey || [];
    if (!currentJourney.includes(data.page)) {
      currentJourney.push(data.page);
      await sbFetch('PATCH', `visit_journeys?visit_id=eq.${visit_id}`, '', { journey: currentJourney });
    }
  }

  // 4. تحديث صفحة الخروج وعدد الصفحات في الزيارة
  const visitData = await sbFetch('GET', `visits?visit_id=eq.${visit_id}&select=pages_viewed`);
  if(visitData && visitData.length > 0) {
     await sbFetch('PATCH', `visits?visit_id=eq.${visit_id}`, '', { exit_page: data.page, pages_viewed: (visitData[0].pages_viewed || 0) + 1 });
  }

  return jsonResponse({ success: true });
}

// =============================================
// 3) EXIT (إغلاق الجلسة والزيارة)
// =============================================
async function handleExit(uid, session_id, data) {
  if (!session_id) return jsonResponse({ error: 'Missing session_id' }, 400);
  const now = new Date().toISOString();
  const durationSec = Number(data.duration_sec) || 0;

  // إغلاق الجلسة
  await sbFetch('PATCH', `sessions?session_id=eq.${session_id}`, '', { ended_at: now, duration_sec: durationSec });

  // إغلاق الزيارة
  const sesRows = await sbFetch('GET', `sessions?session_id=eq.${session_id}&select=visit_id`);
  if (sesRows && sesRows.length > 0 && sesRows[0].visit_id) {
    const visitUpdates = { ended_at: now, duration_sec: durationSec, is_bounce: false };
    if (data.exit_page) visitUpdates.exit_page = data.exit_page;
    await sbFetch('PATCH', `visits?visit_id=eq.${sesRows[0].visit_id}`, '', visitUpdates);
  }

  return jsonResponse({ success: true });
}

// =============================================
// 4) HEARTBEAT & SCROLL (تحديث محلي فقط)
// =============================================
async function handleHeartbeat(session_id) {
  if (!session_id) return jsonResponse({ success: true });
  await sbFetch('PATCH', `sessions?session_id=eq.${session_id}`, '', { last_activity_at: new Date().toISOString() });
  return jsonResponse({ success: true });
}

async function handleScroll(session_id, data) {
  const scrollPct = Number(data.scroll_pct) || 0;
  if (!session_id || scrollPct === 0) return jsonResponse({ success: true });
  const sesRows = await sbFetch('GET', `sessions?session_id=eq.${session_id}&select=max_scroll_pct`);
  if (sesRows && sesRows.length > 0) {
    const currentMax = Number(sesRows[0].max_scroll_pct) || 0;
    if (scrollPct > currentMax) {
      await sbFetch('PATCH', `sessions?session_id=eq.${session_id}`, '', { max_scroll_pct: scrollPct });
    }
  }
  return jsonResponse({ success: true });
}

// =============================================
// 5) CONVERSIONS (الأفعال التجارية فقط - INSERT إلى events)
// =============================================
async function handleConversion(uid, session_id, event_type, data) {
  const now = new Date().toISOString();
  let visit_id = null;
  let acquisition_id = null;

  // جلب visit_id و acquisition_id من الجلسة الحالية لربط الحدث بهما
  if (session_id) {
    const sesRows = await sbFetch('GET', `sessions?session_id=eq.${session_id}&select=visit_id`);
    if (sesRows && sesRows.length > 0) {
      visit_id = sesRows[0].visit_id;
      const visitRows = await sbFetch('GET', `visits?visit_id=eq.${visit_id}&select=acquisition_id`);
      if (visitRows && visitRows.length > 0) acquisition_id = visitRows[0].acquisition_id;
    }
  }

  // إدراج الحدث (دون تحديد event_uuid ليجعله Supabase تلقائياً لمنع التكرار)
  await sbFetch('POST', 'events', '', { 
    uid, visit_id, session_id, acquisition_id, event_type, event_value: data.event_value || null, created_at: now 
  });

  // تحديث النقاط والعدادات في ملف الزائر
  const scoreMap = { 'form_submit': 30, 'file_download': 20, 'affiliate_click': 50 };
  const scoreAdd = scoreMap[event_type] || 10;
  
  const profile = await sbFetch('GET', `visitor_profiles?uid=eq.${uid}&select=lead_score,lead_status,total_conversions`);
  if (profile && profile.length > 0) {
    const currentScore = Number(profile[0].lead_score) || 0;
    const currentConv = Number(profile[0].total_conversions) || 0;
    const newScore = currentScore + scoreAdd;
    let newStatus = profile[0].lead_status;
    if (newScore >= 70) newStatus = 'hot'; else if (newScore >= 30) newStatus = 'warm';
    
    // إذا كان النموذج، نحدث حالة التعرف
    const updates = { lead_score: newScore, lead_status: newStatus, total_conversions: currentConv + 1, last_seen_at: now };
    if (event_type === 'form_submit' && data.identified_email) {
      updates.is_identified = true;
      updates.identified_email = data.identified_email;
      if (data.identified_name) updates.identified_name = data.identified_name;
    }
    await sbFetch('PATCH', `visitor_profiles?uid=eq.${uid}`, '', updates);
  }

  return jsonResponse({ success: true });
}