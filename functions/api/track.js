// functions/api/track.js
// POST /api/track  — Universal ingestion endpoint.
// Strict Zero-Bloat: navigation events PATCH, only commercial events INSERT into `events`.

import {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    SCORE_WEIGHTS,
    LEAD_STATUS_THRESHOLDS,
    VISIT_INACTIVITY_MS
} from "./config.js";

// ---------- Supabase REST helpers ----------
const SB_HEADERS = {
    "apikey":         SUPABASE_ANON_KEY,
    "Authorization":  `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type":   "application/json"
};

async function sbGet(path) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        method:  "GET",
        headers: SB_HEADERS
    });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) ? data : null;
}

async function sbInsert(table, body, prefer = "return=representation") {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
        method:  "POST",
        headers: { ...SB_HEADERS, "Prefer": prefer },
        body:    JSON.stringify(body)
    });
    if (!res.ok) return null;
    const txt = await res.text();
    try { return txt ? JSON.parse(txt) : null; } catch { return null; }
}

async function sbUpsert(table, body, onConflict) {
    const res = await fetch(
        `${SUPABASE_URL}/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`,
        {
            method:  "POST",
            headers: {
                ...SB_HEADERS,
                "Prefer": "resolution=merge-duplicates,return=representation"
            },
            body: JSON.stringify(body)
        }
    );
    if (!res.ok) return null;
    const txt = await res.text();
    try { return txt ? JSON.parse(txt) : null; } catch { return null; }
}

async function sbPatch(table, filter, body) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
        method:  "PATCH",
        headers: { ...SB_HEADERS, "Prefer": "return=representation" },
        body:    JSON.stringify(body)
    });
    if (!res.ok) return null;
    const txt = await res.text();
    try { return txt ? JSON.parse(txt) : null; } catch { return null; }
}

// ---------- Lead-status helper ----------
function computeLeadStatus(score) {
    if (score >= LEAD_STATUS_THRESHOLDS.hot)  return "hot";
    if (score >= LEAD_STATUS_THRESHOLDS.warm) return "warm";
    return "cold";
}

// ---------- Device detection ----------
function detectDevice(ua) {
    if (!ua) return "unknown";
    const s = ua.toLowerCase();
    if (/tablet|ipad/.test(s))                                  return "tablet";
    if (/mobile|iphone|android.*mobile|phone/.test(s))          return "mobile";
    return "desktop";
}

// ---------- Acquisition resolver (multi-touch) ----------
async function resolveAcquisition(uid, data) {
    const utmSource   = data.utm_source   || null;
    const utmCampaign = data.utm_campaign || null;
    const source      = data.source       || data.referrer || "direct";

    // Lookup existing row.
    const filterUtmSource   = utmSource   ? `utm_source=eq.${encodeURIComponent(utmSource)}`     : "utm_source=is.null";
    const filterUtmCampaign = utmCampaign ? `utm_campaign=eq.${encodeURIComponent(utmCampaign)}` : "utm_campaign=is.null";
    const existing = await sbGet(
        `acquisitions?uid=eq.${encodeURIComponent(uid)}&${filterUtmSource}&${filterUtmCampaign}&select=acquisition_id,touch_order&limit=1`
    );
    if (existing && existing.length > 0) return existing[0].acquisition_id;

    // Determine touch_order = max(existing) + 1.
    const all = await sbGet(
        `acquisitions?uid=eq.${encodeURIComponent(uid)}&select=touch_order&order=touch_order.desc&limit=1`
    );
    const nextOrder = (all && all.length > 0 ? Number(all[0].touch_order) : 0) + 1;

    const inserted = await sbInsert("acquisitions", {
        uid,
        source,
        utm_source:     utmSource,
        utm_campaign:   utmCampaign,
        touch_order:    nextOrder,
        first_visit_at: new Date().toISOString()
    });
    if (inserted && inserted[0]) return inserted[0].acquisition_id;
    return null;
}

// ---------- Active-visit finder (30-minute rule) ----------
async function findActiveVisit(uid) {
    const sessions = await sbGet(
        `sessions?uid=eq.${encodeURIComponent(uid)}&select=session_id,visit_id,last_activity_at&order=last_activity_at.desc&limit=1`
    );
    if (!sessions || sessions.length === 0) return null;
    const last = sessions[0];
    const lastMs = new Date(last.last_activity_at).getTime();
    if (Date.now() - lastMs > VISIT_INACTIVITY_MS) return null;
    return last.visit_id;
}

// ---------- Event-type handlers ----------

async function handleSessionStart(uid, sessionId, data, request) {
    const nowIso     = new Date().toISOString();
    const landing    = data.landing_page || "/";
    const userAgent  = request.headers.get("User-Agent") || "";
    const deviceType = data.device_type || detectDevice(userAgent);

    // 1) Upsert visitor_profiles.
    const existingProfile = await sbGet(
        `visitor_profiles?uid=eq.${encodeURIComponent(uid)}&select=uid,total_visits,lead_score,lead_status`
    );
    if (!existingProfile || existingProfile.length === 0) {
        await sbInsert("visitor_profiles", {
            uid,
            fingerprint_id: data.fingerprint_id || null,
            is_identified:  false,
            lead_score:     0,
            lead_status:    "cold",
            total_visits:   0,
            first_seen_at:  nowIso,
            last_seen_at:   nowIso
        });
    } else {
        await sbPatch("visitor_profiles", `uid=eq.${encodeURIComponent(uid)}`, { last_seen_at: nowIso });
    }

    // 2) Resolve acquisition.
    const acquisitionId = await resolveAcquisition(uid, data);

    // 3) 30-Minute rule.
    const activeVisitId = await findActiveVisit(uid);
    let visitId;

    if (!activeVisitId) {
        // New visit.
        const newVisit = await sbInsert("visits", {
            uid,
            acquisition_id: acquisitionId,
            entry_page:     landing,
            exit_page:      landing,
            pages_viewed:   1,
            duration_sec:   0,
            is_bounce:      true,
            started_at:     nowIso
        });
        visitId = newVisit && newVisit[0] ? newVisit[0].visit_id : null;

        if (visitId) {
            await sbInsert("visit_journeys", {
                visit_id: visitId,
                uid,
                journey:  [landing]
            });
        }

        // Increment total_visits.
        const cur = (existingProfile && existingProfile[0]) ? Number(existingProfile[0].total_visits) : 0;
        await sbPatch("visitor_profiles", `uid=eq.${encodeURIComponent(uid)}`, { total_visits: cur + 1 });
    } else {
        // Continue existing visit — append to journey.
        visitId = activeVisitId;

        const jrows = await sbGet(`visit_journeys?visit_id=eq.${visitId}&select=journey`);
        const journey = (jrows && jrows[0] && Array.isArray(jrows[0].journey)) ? jrows[0].journey : [];
        journey.push(landing);
        await sbPatch("visit_journeys", `visit_id=eq.${visitId}`, { journey });

        const vrows = await sbGet(`visits?visit_id=eq.${visitId}&select=pages_viewed`);
        const pv = (vrows && vrows[0]) ? Number(vrows[0].pages_viewed) : 1;
        await sbPatch("visits", `visit_id=eq.${visitId}`, {
            exit_page:    landing,
            pages_viewed: pv + 1
        });
    }

    // 4) Insert sessions row.
    if (visitId) {
        await sbInsert("sessions", {
            session_id:       sessionId,
            visit_id:         visitId,
            uid,
            device_type:      deviceType,
            started_at:       nowIso,
            last_activity_at: nowIso,
            duration_sec:     0,
            max_scroll_pct:   0
        });
    }

    return { ok: true, visit_id: visitId, acquisition_id: acquisitionId };
}

async function handlePageChange(uid, sessionId, data) {
    const nowIso = new Date().toISOString();
    const page   = data.page || "/";

    // Look up the session → visit.
    const srows = await sbGet(`sessions?session_id=eq.${sessionId}&select=visit_id`);
    if (!srows || srows.length === 0) return { ok: false, reason: "session_not_found" };
    const visitId = srows[0].visit_id;

    // 1) Update session activity.
    await sbPatch("sessions", `session_id=eq.${sessionId}`, { last_activity_at: nowIso });

    // 2) Append to journey.
    const jrows   = await sbGet(`visit_journeys?visit_id=eq.${visitId}&select=journey`);
    const journey = (jrows && jrows[0] && Array.isArray(jrows[0].journey)) ? jrows[0].journey : [];
    journey.push(page);
    await sbPatch("visit_journeys", `visit_id=eq.${visitId}`, { journey });

    // 3) Update visit counters.
    const vrows = await sbGet(`visits?visit_id=eq.${visitId}&select=pages_viewed`);
    const pv    = (vrows && vrows[0]) ? Number(vrows[0].pages_viewed) : 1;
    await sbPatch("visits", `visit_id=eq.${visitId}`, {
        exit_page:    page,
        pages_viewed: pv + 1,
        is_bounce:    false
    });

    return { ok: true };
}

async function handleExit(uid, sessionId, data) {
    const nowIso       = new Date().toISOString();
    const durationSec  = Math.max(0, Number(data.duration_sec) || 0);
    const maxScrollPct = Math.max(0, Math.min(100, Number(data.max_scroll_pct) || 0));
    const exitPage     = data.exit_page || data.page || null;

    const srows = await sbGet(`sessions?session_id=eq.${sessionId}&select=visit_id`);
    if (!srows || srows.length === 0) return { ok: false, reason: "session_not_found" };
    const visitId = srows[0].visit_id;

    // 1) Update session.
    await sbPatch("sessions", `session_id=eq.${sessionId}`, {
        ended_at:         nowIso,
        last_activity_at: nowIso,
        duration_sec:     durationSec,
        max_scroll_pct:   maxScrollPct
    });

    // 2) Update visit.
    const visitPatch = {
        ended_at:     nowIso,
        duration_sec: durationSec,
        is_bounce:    false
    };
    if (exitPage) visitPatch.exit_page = exitPage;
    await sbPatch("visits", `visit_id=eq.${visitId}`, visitPatch);

    return { ok: true };
}

async function handleHeartbeat(sessionId) {
    await sbPatch("sessions", `session_id=eq.${sessionId}`, {
        last_activity_at: new Date().toISOString()
    });
    return { ok: true };
}

async function handleScroll(sessionId, data) {
    const incoming = Math.max(0, Math.min(100, Number(data.scroll_pct) || 0));
    const srows    = await sbGet(`sessions?session_id=eq.${sessionId}&select=max_scroll_pct`);
    if (!srows || srows.length === 0) return { ok: false, reason: "session_not_found" };
    const current = Number(srows[0].max_scroll_pct) || 0;
    if (incoming > current) {
        await sbPatch("sessions", `session_id=eq.${sessionId}`, {
            max_scroll_pct:   incoming,
            last_activity_at: new Date().toISOString()
        });
    }
    return { ok: true };
}

async function handleCommercialEvent(eventType, uid, sessionId, data) {
    const nowIso = new Date().toISOString();

    // Look up visit_id + acquisition_id for direct attribution.
    let visitId = null;
    let acquisitionId = null;
    if (sessionId) {
        const srows = await sbGet(`sessions?session_id=eq.${sessionId}&select=visit_id`);
        if (srows && srows[0]) visitId = srows[0].visit_id;
    }
    if (visitId) {
        const vrows = await sbGet(`visits?visit_id=eq.${visitId}&select=acquisition_id`);
        if (vrows && vrows[0]) acquisitionId = vrows[0].acquisition_id;
    }

    // 1) Insert event row.
    await sbInsert("events", {
        event_uuid:     crypto.randomUUID(),
        uid,
        visit_id:       visitId,
        session_id:     sessionId || null,
        acquisition_id: acquisitionId,
        event_type:     eventType,
        event_value:    data.event_value || data.value || null,
        created_at:     nowIso
    });

    // 2) Update lead score + conversions + status.
    const prows = await sbGet(
        `visitor_profiles?uid=eq.${encodeURIComponent(uid)}&select=lead_score,total_conversions`
    );
    const curScore       = (prows && prows[0]) ? Number(prows[0].lead_score)        : 0;
    const curConversions = (prows && prows[0]) ? Number(prows[0].total_conversions) : 0;
    const delta          = SCORE_WEIGHTS[eventType] || 0;
    const newScore       = curScore + delta;

    await sbPatch("visitor_profiles", `uid=eq.${encodeURIComponent(uid)}`, {
        lead_score:        newScore,
        total_conversions: curConversions + 1,
        lead_status:       computeLeadStatus(newScore),
        last_seen_at:      nowIso
    });

    return { ok: true, lead_score: newScore };
}

// ---------- Main handler ----------
export async function onRequestPost(context) {
    try {
        const body       = await context.request.json();
        const eventType  = body.event_type;
        const uid        = body.uid;
        const sessionId  = body.session_id || null;
        const data       = body.data || body;

        if (!eventType || !uid) {
            return new Response(JSON.stringify({ ok: false, error: "missing event_type or uid" }), {
                status:  400,
                headers: { "Content-Type": "application/json" }
            });
        }

        let result;
        switch (eventType) {
            case "session_start":
                result = await handleSessionStart(uid, sessionId, data, context.request); break;
            case "page_change":
                result = await handlePageChange(uid, sessionId, data); break;
            case "exit":
                result = await handleExit(uid, sessionId, data); break;
            case "heartbeat":
                result = await handleHeartbeat(sessionId); break;
            case "scroll":
                result = await handleScroll(sessionId, data); break;
            case "file_download":
            case "form_submit":
            case "affiliate_click":
                result = await handleCommercialEvent(eventType, uid, sessionId, data); break;
            default:
                return new Response(JSON.stringify({ ok: false, error: "unknown event_type" }), {
                    status:  400,
                    headers: { "Content-Type": "application/json" }
                });
        }

        return new Response(JSON.stringify(result), {
            status:  200,
            headers: { "Content-Type": "application/json", "Access-Control-Al
