// functions/api/subscribe.js
// POST /api/subscribe — Form submission + identification + notifications.

import {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID,
    GOOGLE_SHEETS_WEBHOOK,
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

async function notifyTelegram(payload) {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
    const text =
        `🦷 *New Hot Lead!*\n\n` +
        `👤 *Name:* ${payload.identified_name || "—"}\n` +
        `📧 *Email:* ${payload.identified_email || "—"}\n` +
        `📱 *Phone:* ${payload.phone_number || "—"}\n` +
        `💬 *Challenge:* ${payload.biggest_challenge || "—"}\n` +
        `🆔 *UID:* \`${payload.uid}\``;
    try {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({
                chat_id:    TELEGRAM_CHAT_ID,
                text,
                parse_mode: "Markdown"
            })
        });
    } catch (_) { /* swallow */ }
}

async function notifyGoogleSheets(payload) {
    if (!GOOGLE_SHEETS_WEBHOOK) return;
    try {
        await fetch(GOOGLE_SHEETS_WEBHOOK, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({
                timestamp:         new Date().toISOString(),
                uid:               payload.uid,
                identified_name:   payload.identified_name || "",
                identified_email:  payload.identified_email || "",
                phone_number:      payload.phone_number || "",
                biggest_challenge: payload.biggest_challenge || ""
            })
        });
    } catch (_) { /* swallow */ }
}

export async function onRequestPost(context) {
    try {
        const contentType = context.request.headers.get("Content-Type") || "";
        let body;
        if (contentType.includes("application/json")) {
            body = await context.request.json();
        } else {
            const fd = await context.request.formData();
            body = Object.fromEntries(fd.entries());
        }

        const uid               = body.uid;
        const identifiedName    = body.identified_name    || null;
        const identifiedEmail   = body.identified_email   || null;
        const phoneNumber       = body.phone_number       || null;
        const biggestChallenge  = body.biggest_challenge  || null;

        if (!uid || !identifiedEmail) {
            return new Response(JSON.stringify({ success: false, error: "uid and identified_email required" }), {
                status:  400,
                headers: { "Content-Type": "application/json" }
            });
        }

        const nowIso = new Date().toISOString();

        // Resolve visit/acquisition for attribution.
        let visitId = null;
        let acquisitionId = null;
        let sessionId = body.session_id || null;
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

        // 1) Insert form_submit event.
        await fetch(`${SUPABASE_URL}/rest/v1/events`, {
            method:  "POST",
            headers: {...SB_HEADERS, "Prefer": "return=minimal" },
            body:    JSON.stringify({
                event_uuid:     crypto.randomUUID(),
                uid,
                visit_id:       visitId,
                session_id:     sessionId,
                acquisition_id: acquisitionId,
                event_type:     "form_submit",
                event_value:    biggestChallenge,
                created_at:     nowIso
            })
        });

        // 2) Update visitor_profiles — identify + score.
        const pRes = await fetch(
            `${SUPABASE_URL}/rest/v1/visitor_profiles?uid=eq.${encodeURIComponent(uid)}&select=lead_score,total_conversions`,
            { headers: SB_HEADERS }
        );
        const curArr = pRes.ok ? await pRes.json() : ;
        const cur    = (curArr && curArr[0]) || { lead_score: 0, total_conversions: 0 };
        const newScore = Number(cur.lead_score) + SCORE_WEIGHTS.form_submit;

        await fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles?uid=eq.${encodeURIComponent(uid)}`, {
            method:  "PATCH",
            headers: {...SB_HEADERS, "Prefer": "return=minimal" },
            body:    JSON.stringify({
                identified_name:   identifiedName,
                identified_email:  identifiedEmail,
                is_identified:     true,
                lead_score:        newScore,
                lead_status:       computeLeadStatus(newScore),
                total_conversions: Number(cur.total_conversions) + 1,
                last_seen_at:      nowIso
            })
        });

        // 3) Fire-and-forget notifications.
        const payload = { uid, identified_name: identifiedName, identified_email: identifiedEmail, phone_number: phoneNumber, biggest_challenge: biggestChallenge };
        context.waitUntil(notifyTelegram(payload));
        context.waitUntil(notifyGoogleSheets(payload));

        return new Response(JSON.stringify({ success: true, redirect: "/thank-you.html" }), {
            status:  200,
            headers: { "Content-Type": "application/json" }
        });
    } catch (err) {
        return new Response(JSON.stringify({ success: false, error: String(err && err.message || err) }), {
            status:  500,
            headers: { "Content-Type": "application/json" }
        });
    }
}
