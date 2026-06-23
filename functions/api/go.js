// functions/api/go.js
// GET /api/go?uid=XXX&sid=YYY  — Affiliate redirect with non-blocking event logging.

import {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    GHL_AFFILIATE_LINK,
    SCORE_WEIGHTS,
    LEAD_STATUS_THRESHOLDS
} from "./config.js";

const SB_HEADERS = {
    "apikey":         SUPABASE_ANON_KEY,
    "Authorization":  `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type":   "application/json"
};

function computeLeadStatus(score) {
    if (score >= LEAD_STATUS_THRESHOLDS.hot)  return "hot";
    if (score >= LEAD_STATUS_THRESHOLDS.warm) return "warm";
    return "cold";
}

async function logAffiliateClick(uid, sessionId) {
    try {
        // Resolve visit + acquisition for attribution.
        let visitId = null;
        let acquisitionId = null;

        if (sessionId) {
            const sRes = await fetch(
                `${SUPABASE_URL}/rest/v1/sessions?session_id=eq.${sessionId}&select=visit_id`,
                { headers: SB_HEADERS }
            );
            if (sRes.ok) {
                const arr = await sRes.json();
                if (Array.isArray(arr) && arr[0]) visitId = arr[0].visit_id;
            }
        }
        if (visitId) {
            const vRes = await fetch(
                `${SUPABASE_URL}/rest/v1/visits?visit_id=eq.${visitId}&select=acquisition_id`,
                { headers: SB_HEADERS }
            );
            if (vRes.ok) {
                const arr = await vRes.json();
                if (Array.isArray(arr) && arr[0]) acquisitionId = arr[0].acquisition_id;
            }
        }

        // Insert affiliate_click event.
        await fetch(`${SUPABASE_URL}/rest/v1/events`, {
            method:  "POST",
            headers: {...SB_HEADERS, "Prefer": "return=minimal" },
            body:    JSON.stringify({
                event_uuid:     crypto.randomUUID(),
                uid,
                visit_id:       visitId,
                session_id:     sessionId,
                acquisition_id: acquisitionId,
                event_type:     "affiliate_click",
                event_value:    GHL_AFFILIATE_LINK,
                created_at:     new Date().toISOString()
            })
        });

        // Update visitor profile.
        const pRes = await fetch(
            `${SUPABASE_URL}/rest/v1/visitor_profiles?uid=eq.${encodeURIComponent(uid)}&select=lead_score,total_conversions`,
            { headers: SB_HEADERS }
        );
        if (pRes.ok) {
            const arr = await pRes.json();
            const cur = (arr && arr[0]) || { lead_score: 0, total_conversions: 0 };
            const newScore = Number(cur.lead_score) + SCORE_WEIGHTS.affiliate_click;
            await fetch(
                `${SUPABASE_URL}/rest/v1/visitor_profiles?uid=eq.${encodeURIComponent(uid)}`,
                {
                    method:  "PATCH",
                    headers: {...SB_HEADERS, "Prefer": "return=minimal" },
                    body:    JSON.stringify({
                        lead_score:        newScore,
                        total_conversions: Number(cur.total_conversions) + 1,
                        lead_status:       computeLeadStatus(newScore),
                        last_seen_at:      new Date().toISOString()
                    })
                }
            );
        }
    } catch (_) {
        // Swallow errors — never block the redirect.
    }
}

export async function onRequestGet(context) {
    const url       = new URL(context.request.url);
    const uid       = url.searchParams.get("uid") || "anonymous";
    const sessionId = url.searchParams.get("sid") || null;

    // Fire-and-forget logging.
    context.waitUntil(logAffiliateClick(uid, sessionId));

    // Build affiliate destination with sub_id.
    const sep    = GHL_AFFILIATE_LINK.includes("?") ? "&" : "?";
    const target = `${GHL_AFFILIATE_LINK}${sep}sub_id=${encodeURIComponent(uid)}`;

    return Response.redirect(target, 302);
}
