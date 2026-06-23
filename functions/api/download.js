// functions/api/download.js
// GET /api/download?uid=XXX&file=YYY  — Validate, log, return signed download URL.

import {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    FILES_MAP,
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

export async function onRequestGet(context) {
    try {
        const url       = new URL(context.request.url);
        const uid       = url.searchParams.get("uid");
        const fileKey   = url.searchParams.get("file");
        const sessionId = url.searchParams.get("sid") || null;

        if (!uid || !fileKey) {
            return new Response(JSON.stringify({ success: false, error: "uid and file required" }), {
                status:  400,
                headers: { "Content-Type": "application/json" }
            });
        }

        const downloadUrl = FILES_MAP[fileKey];
        if (!downloadUrl) {
            return new Response(JSON.stringify({ success: false, error: "invalid file key" }), {
                status:  404,
                headers: { "Content-Type": "application/json" }
            });
        }

        // Attribution lookup.
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

        const nowIso = new Date().toISOString();

        // 1) Insert file_download event.
        await fetch(`${SUPABASE_URL}/rest/v1/events`, {
            method:  "POST",
            headers: {...SB_HEADERS, "Prefer": "return=minimal" },
            body:    JSON.stringify({
                event_uuid:     crypto.randomUUID(),
                uid,
                visit_id:       visitId,
                session_id:     sessionId,
                acquisition_id: acquisitionId,
                event_type:     "file_download",
                event_value:    fileKey,
                created_at:     nowIso
            })
        });

        // 2) Update lead score.
        const pRes = await fetch(
            `${SUPABASE_URL}/rest/v1/visitor_profiles?uid=eq.${encodeURIComponent(uid)}&select=lead_score,total_conversions`,
            { headers: SB_HEADERS }
        );
        const arr = pRes.ok ? await pRes.json() : ;
        const cur = (arr && arr[0]) || { lead_score: 0, total_conversions: 0 };
        const newScore = Number(cur.lead_score) + SCORE_WEIGHTS.file_download;

        await fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles?uid=eq.${encodeURIComponent(uid)}`, {
            method:  "PATCH",
            headers: {...SB_HEADERS, "Prefer": "return=minimal" },
            body:    JSON.stringify({
                lead_score:        newScore,
                lead_status:       computeLeadStatus(newScore),
                total_conversions: Number(cur.total_conversions) + 1,
                last_seen_at:      nowIso
            })
        });

        return new Response(JSON.stringify({ success: true, download_url: downloadUrl }), {
            status:  200,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
    } catch (err) {
        return new Response(JSON.stringify({ success: false, error: String(err && err.message || err) }), {
            status:  500,
            headers: { "Content-Type": "application/json" }
        });
    }
}
