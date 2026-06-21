// functions/api/track.js
// نقطة النهاية المركزية لاستقبال جميع أحداث التتبع من العميل
// يعالج: session_start, heartbeat, scroll, exit, form_submit, file_download, affiliate_redirect, email_open
// قاعدة منع التضخم: لا يُسمح بـ INSERT في جدول events عند heartbeat أو scroll، فقط PATCH

import { SUPABASE_URL, SUPABASE_SERVICE_KEY } from './config.js';

// =============================================
// أدوات مساعدة (Utility Functions)
// =============================================

/** بناء رد JSON موحد */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

/** طلب Supabase REST API موحد */
async function sbFetch(method, table, queryParams = '', body = null) {
  const url = `${SUPABASE_URL}/rest/v1/${table}${queryParams}`;
  const headers = {
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };
  const options = { method, headers };
  if (body !== null) options.body = JSON.stringify(body);

  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      const errText = await res.text();
      console.error(`SB ${method} ${table} failed [${res.status}]:`, errText);
      return null;
    }
    const text = await res.text();
    if (!text) return null;
    return JSON.parse(text);
  } catch (err) {
    console.error(`SB ${method} ${table} exception:`, err.message);
    return null;
  }
}

/** زيادة عداد بأمان: جلب القيمة الحالية -> جمع -> تحديث */
async function safeIncrement(table, matchQuery, fieldName, incrementBy = 1) {
  const rows = await sbFetch('GET', table, `?${matchQuery}&select=${fieldName}`);
  if (rows && rows.length > 0) {
    const currentVal = Number(rows[0][fieldName]) || 0;
    await sbFetch('PATCH', table, `?${matchQuery}`, {
      [fieldName]: currentVal + incrementBy
    });
    return currentVal + incrementBy;
  }
  return null;
}

/** تحديث القيمة الأعلى: تحديث فقط إذا كانت القيمة الجديدة أكبر من الحالية */
async function updateMaxValue(table, matchQuery, fieldName, newValue) {
  const rows = await sbFetch('GET', table, `?${matchQuery}&select=${fieldName}`);
  if (rows && rows.length > 0) {
    const currentVal = Number(rows[0][fieldName]) || 0;
    if (newValue > currentVal) {
      await sbFetch('PATCH', table, `?${matchQuery}`, {
        [fieldName]: newValue
      });
      return true;
    }
  }
  return false;
}

// =============================================
// المُوجّه الرئيسي (Main Router)
// =============================================

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const { event_type, uid, session_id, ...data } = body;

    if (!uid || !event_type) {
      return jsonResponse({ error: 'Missing required: uid or event_type' }, 400);
    }

    switch (event_type) {
      case 'session_start':
        return await handleSessionStart(uid, session_id, data);
      case 'heartbeat':
        return await handleHeartbeat(uid, session_id, data);
      case 'scroll':
        return await handleScroll(uid, session_id, data);
      case 'exit':
        return await handleExit(uid, session_id, data);
      case 'form_submit':
      case 'file_download':
      case 'affiliate_redirect':
        return await handleConversion(uid, session_id, event_type, data);
      case 'email_open':
        return await handleEmailOpen(uid, data);
      default:
        return jsonResponse({ error: `Unknown event_type: ${event_type}` }, 400);
    }
  } catch (err) {
    console.error('Track critical error:', err.message);
    return jsonResponse({ error: 'Internal tracking error' }, 500);
  }
}

// =============================================
// 1) SESSION_START - إنشاء جلسة وزيارة جديدة
// =============================================
async function handleSessionStart(uid, session_id, data) {
  const now = new Date().toISOString();
  const finalSessionId = session_id || crypto.randomUUID();

  // ─── الخطوة 1: إنشاء أو تحديث ملف الزائر ───
  const existingProfile = await sbFetch(
    'GET', 'visitor_profiles',
    `?uid=eq.${uid}&select=total_visits,fingerprint_id,lead_score,lead_status`
  );

  if (existingProfile && existingProfile.length > 0) {
    // زائر عائد - زيادة total_visits بمقدار 1
    const currentVisits = Number(existingProfile[0].total_visits) || 0;
    await sbFetch('PATCH', 'visitor_profiles', `?uid=eq.${uid}`, {
      total_visits: currentVisits + 1,
      last_seen_at: now,
      fingerprint_id: data.fingerprint_id || existingProfile[0].fingerprint_id
    });
  } else {
    // زائر جديد - إنشاء ملف كامل
    await sbFetch('POST', 'visitor_profiles', '', {
      uid: uid,
      fingerprint_id: data.fingerprint_id || null,
      is_identified: false,
      lead_status: 'cold',
      lead_score: 0,
      total_visits: 1,
      total_campaigns: 0,
      total_email_opens: 0,
      total_conversions: 0,
      total_time_on_site_sec: 0,
      max_scroll_ever_pct: 0,
      first_seen_at: now,
      last_seen_at: now
    });
  }

  // ─── الخطوة 2: معالجة مصدر الزيارة (Acquisition) ───
  let acquisition_id = null;
  const utmCampaign = data.utm_campaign || null;

  if (utmCampaign) {
    const encodedCampaign = encodeURIComponent(utmCampaign);
    const existingAcq = await sbFetch(
      'GET', 'acquisitions',
      `?uid=eq.${uid}&utm_campaign=eq.${encodedCampaign}&select=acquisition_id`
    );

    if (existingAcq && existingAcq.length > 0) {
      acquisition_id = existingAcq[0].acquisition_id;
    } else {
      const newAcq = await sbFetch('POST', 'acquisitions', '', {
        uid: uid,
        source: data.source || 'direct',
        source_type: data.source_type || 'organic',
        utm_source: data.utm_source || null,
        utm_campaign: utmCampaign,
        landing_page: data.landing_page || '/',
        country: data.country || null,
        city: data.city || null,
        first_visit_at: now
      });
      if (newAcq && newAcq.length > 0) {
        acquisition_id = newAcq[0].acquisition_id;
        // زيادة عدد الحملات الفريدة
        await safeIncrement('visitor_profiles', `uid=eq.${uid}`, 'total_campaigns', 1);
      }
    }
  }

  // ─── الخطوة 3: إنشاء سجل الزيارة (Visit) ───
  const visit_id = crypto.randomUUID();
  await sbFetch('POST', 'visits', '', {
    visit_id: visit_id,
    uid: uid,
    acquisition_id: acquisition_id,
    entry_page: data.landing_page || '/',
    exit_page: data.landing_page || '/',
    duration_sec: 0,
    max_scroll_pct: 0,
    is_bounce: true,
    visit_date: now.split('T')[0]
  });

  // ─── الخطوة 4: إنشاء سجل الجلسة (Session) ───
  await sbFetch('POST', 'sessions', '', {
    session_id: finalSessionId,
    visit_id: visit_id,
    started_at: now,
    last_activity_at: now,
    ended_at: null,
    duration_sec: 0,
    max_scroll_pct: 0,
    is_bounce: true,
    device_type: data.device_type || null,
    browser: data.browser || null,
    operating_system: data.operating_system || null,
    country: data.country || null,
    city: data.city || null
  });

  return jsonResponse({ success: true, visit_id, session_id: finalSessionId });
}

// =============================================
// 2) HEARTBEAT - تحديث النشاط فقط (PATCH فقط)
// =============================================
async function handleHeartbeat(uid, session_id, data) {
  if (!session_id) return jsonResponse({ error: 'Missing session_id' }, 400);

  const now = new Date().toISOString();

  // تحديث آخر نشاط في الجلسة فقط - بدون أي INSERT
  await sbFetch('PATCH', 'sessions', `?session_id=eq.${session_id}&ended_at=is.null`, {
    last_activity_at: now
  });

  return jsonResponse({ success: true });
}

// =============================================
// 3) SCROLL - تحديث أقصى تمرير فقط (PATCH فقط - بدون INSERT)
// =============================================
async function handleScroll(uid, session_id, data) {
  const scrollPct = Number(data.scroll_pct) || 0;
  if (!session_id) return jsonResponse({ error: 'Missing session_id' }, 400);

  // تحديث max_scroll_pct في sessions
  await updateMaxValue('sessions', `session_id=eq.${session_id}`, 'max_scroll_pct', scrollPct);

  // جلب visit_id من الجلسة لتحديث الزيارة
  const sessionRows = await sbFetch(
    'GET', 'sessions',
    `?session_id=eq.${session_id}&select=visit_id`
  );
  if (sessionRows && sessionRows.length > 0 && sessionRows[0].visit_id) {
    await updateMaxValue('visits', `visit_id=eq.${sessionRows[0].visit_id}`, 'max_scroll_pct', scrollPct);
  }

  // تحديث max_scroll_ever_pct في ملف الزائر
  await updateMaxValue('visitor_profiles', `uid=eq.${uid}`, 'max_scroll_ever_pct', scrollPct);

  return jsonResponse({ success: true });
}

// =============================================
// 4) EXIT - إنهاء الجلسة وتحديث الحقول التراكمية
// =============================================
async function handleExit(uid, session_id, data) {
  if (!session_id) return jsonResponse({ error: 'Missing session_id' }, 400);

  const now = new Date().toISOString();
  const durationSec = Number(data.duration_sec) || 0;
  const scrollPct = Number(data.scroll_pct) || 0;
  const exitPage = data.exit_page || null;
  const isBounce = durationSec < 10;

  // ─── حماية من المعالجة المزدوجة ───
  const sessionRows = await sbFetch(
    'GET', 'sessions',
    `?session_id=eq.${session_id}&select=ended_at,visit_id`
  );

  if (!sessionRows || sessionRows.length === 0) {
    return jsonResponse({ error: 'Session not found' }, 404);
  }

  if (sessionRows[0].ended_at) {
    // سبق معالجة هذا الـ exit - تجاهل لتجنب العد المزدوج
    return jsonResponse({ success: true, note: 'already_ended' });
  }

  const visit_id = sessionRows[0].visit_id;

  // ─── الخطوة 1: إنهاء الجلسة ───
  await sbFetch('PATCH', 'sessions', `?session_id=eq.${session_id}`, {
    ended_at: now,
    last_activity_at: now,
    duration_sec: durationSec,
    max_scroll_pct: scrollPct,
    is_bounce: isBounce
  });

  // ─── الخطوة 2: تحديث الزيارة ───
  if (visit_id) {
    const visitUpdates = {
      duration_sec: durationSec,
      max_scroll_pct: scrollPct,
      is_bounce: isBounce
    };
    if (exitPage) visitUpdates.exit_page = exitPage;
    await sbFetch('PATCH', 'visits', `?visit_id=eq.${visit_id}`, visitUpdates);
  }

  // ─── الخطوة 3: تحديث الحقول التراكمية في ملف الزائر ───
  const profileRows = await sbFetch(
    'GET', 'visitor_profiles',
    `?uid=eq.${uid}&select=total_time_on_site_sec,max_scroll_ever_pct`
  );

  if (profileRows && profileRows.length > 0) {
    const currentTotalTime = Number(profileRows[0].total_time_on_site_sec) || 0;
    const currentMaxScroll = Number(profileRows[0].max_scroll_ever_pct) || 0;

    const profileUpdates = {
      total_time_on_site_sec: currentTotalTime + durationSec,
      last_seen_at: now
    };

    if (scrollPct > currentMaxScroll) {
      profileUpdates.max_scroll_ever_pct = scrollPct;
    }

    await sbFetch('PATCH', 'visitor_profiles', `?uid=eq.${uid}`, profileUpdates);
  }

  return jsonResponse({ success: true });
}

// =============================================
// 5) CONVERSION - أحداث التحويل الحرجة
//    (form_submit, file_download, affiliate_redirect)
// =============================================
async function handleConversion(uid, session_id, event_type, data) {
  const now = new Date().toISOString();

  // ─── إدراج الحدث في جدول events ───
  await sbFetch('POST', 'events', '', {
    uid: uid,
    session_id: session_id || null,
    event_type: event_type,
    event_value: data.event_value || null,
    created_at: now
  });

  // ─── زيادة total_conversions بمقدار 1 ───
  await safeIncrement('visitor_profiles', `uid=eq.${uid}`, 'total_conversions', 1);

  // ─── تحديث lead_score و lead_status بناءً على نوع الحدث ───
  const scoreMap = {
    'form_submit': 30,
    'file_download': 20,
    'affiliate_redirect': 50
  };
  const scoreAdd = scoreMap[event_type] || 10;

  const profileRows = await sbFetch(
    'GET', 'visitor_profiles',
    `?uid=eq.${uid}&select=lead_score,lead_status`
  );

  if (profileRows && profileRows.length > 0) {
    const currentScore = Number(profileRows[0].lead_score) || 0;
    const newScore = currentScore + scoreAdd;

    let newStatus = profileRows[0].lead_status;
    if (newScore >= 70) newStatus = 'hot';
    else if (newScore >= 30) newStatus = 'warm';

    await sbFetch('PATCH', 'visitor_profiles', `?uid=eq.${uid}`, {
      lead_score: newScore,
      lead_status: newStatus,
      last_seen_at: now
    });
  }

  // ─── إلغاء تصنيف الجلسة كـ bounce ───
  if (session_id) {
    await sbFetch('PATCH', 'sessions', `?session_id=eq.${session_id}`, {
      is_bounce: false
    });
  }

  return jsonResponse({ success: true });
}

// =============================================
// 6) EMAIL_OPEN - تتبع فتح الإيميل البارد
// =============================================
async function handleEmailOpen(uid, data) {
  const now = new Date().toISOString();
  const campaignName = data.campaign_name || null;

  if (campaignName) {
    const encodedCampaign = encodeURIComponent(campaignName);
    const existing = await sbFetch(
      'GET', 'email_activities',
      `?uid=eq.${uid}&campaign_name=eq.${encodedCampaign}&select=open_count,last_open_at`
    );

    if (existing && existing.length > 0) {
      // تحديث عدد الفتحات
      const currentOpens = Number(existing[0].open_count) || 0;
      await sbFetch('PATCH', 'email_activities',
        `?uid=eq.${uid}&campaign_name=eq.${encodedCampaign}`, {
          open_count: currentOpens + 1,
          last_open_at: now,
          clicked_link: data.clicked_link || null,
          entered_site: data.entered_site !== undefined ? data.entered_site : true
        }
      );
    } else {
      // فتح جديد لحملة جديدة
      await sbFetch('POST', 'email_activities', '', {
        uid: uid,
        campaign_name: campaignName,
        email_address: data.email_address || null,
        first_open_at: now,
        last_open_at: now,
        open_count: 1,
        clicked_link: data.clicked_link || null,
        entered_site: data.entered_site !== undefined ? data.entered_site : true,
        country: data.country || null,
        city: data.city || null,
        device_type: data.device_type || null,
        operating_system: data.operating_system || null
      });
      // زيادة عدد الحملات
      await safeIncrement('visitor_profiles', `uid=eq.${uid}`, 'total_campaigns', 1);
    }
  }

  // زيادة عدد فتحات الإيميل الإجمالي
  await safeIncrement('visitor_profiles', `uid=eq.${uid}`, 'total_email_opens', 1);

  // إدراج حدث email_open في جدول events
  await sbFetch('POST', 'events', '', {
    uid: uid,
    session_id: null,
    event_type: 'email_open',
    event_value: campaignName,
    created_at: now
  });

  return jsonResponse({ success: true });
}