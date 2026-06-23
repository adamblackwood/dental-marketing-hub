// functions/api/open/[uid].js
// GET /api/open/UID?c=CAMPAIGN  — 1x1 pixel for cold-email open tracking.

import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../config.js";

const SB_HEADERS = {
    "apikey":         SUPABASE_ANON_KEY,
    "Authorization":  `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type":   "application/json"
};

// 1x1 transparent GIF.
const GIF_BASE64 = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

function base64ToBytes(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
}

async function logEmailOpen(uid, campaign) {
    try {
        const nowIso = new Date().toISOString();

        // Ensure visitor_profile exists (email opens may precede first visit).
        const pRes = await fetch(
            `${SUPABASE_URL}/rest/v1/visitor_profiles?uid=eq.${encodeURIComponent(uid)}&select=uid`,
            { headers: SB_HEADERS }
        );
        const exists = pRes.ok ? (await pRes.json()).length > 0 : false;
        if (!exists) {
            await fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles`, {
                method:  "POST",
                headers: {...SB_HEADERS, "Prefer": "return=minimal" },
                body:    JSON.stringify({
                    uid,
                    is_identified: false,
                    lead_score:    0,
                    lead_status:   "cold",
                    total_visits:  0,
                    first_seen_at: nowIso,
                    last_seen_at:  nowIso
                })
            });
        }

        // Insert email_open event.
        await fetch(`${SUPABASE_URL}/rest/v1/events`, {
            method:  "POST",
            headers: {...SB_HEADERS, "Prefer": "return=minimal" },
            body:    JSON.stringify({
                event_uuid:  crypto.randomUUID(),
                uid,
                event_type:  "email_open",
                event_value: campaign,
                created_at:  nowIso
            })
        });

        // Upsert email_activities — increment open_count.
        const eRes = await fetch(
            `${SUPABASE_URL}/rest/v1/email_activities?uid=eq.${encodeURIComponent(uid)}&campaign_name=eq.${encodeURIComponent(campaign)}&select=email_activity_id,open_count`,
            { headers: SB_HEADERS }
        );
        const earr = eRes.ok ? await eRes.json() : ;
        if (earr && earr[0]) {
            await fetch(
                `${SUPABASE_URL}/rest/v1/email_activities?email_activity_id=eq.${earr[0].email_activity_id}`,
                {
                    method:  "PATCH",
                    headers: {...SB_HEADERS, "Prefer": "return=minimal" },
                    body:    JSON.stringify({ open_count: Number(earr[0].open_count) + 1 })
                }
            );
        } else {
            await fetch(`${SUPABASE_URL}/rest/v1/email_activities`, {
                method:  "POST",
                headers: {...SB_HEADERS, "Prefer": "return=minimal" },
                body:    JSON.stringify({
                    uid,
                    campaign_name: campaign,
                    open_count:    1,
                    entered_site:  false,
                    created_at:    nowIso
                })
            });
        }
    } catch (_) { /* swallow */ }
}

export async function onRequestGet(context) {
    const uid      = context.params.uid;
    const url      = new URL(context.request.url);
    const campaign = url.searchParams.get("c") || "default";

    context.waitUntil(logEmailOpen(uid, campaign));

    return new Response(base64ToBytes(GIF_BASE64), {
        status:  200,
        headers: {
            "Content-Type":  "image/gif",
            "Cache-Control": "no-store, no-cache, must-revalidate, private",
            "Pragma":        "no-cache",
            "Expires":       "0"
        }
    });
}
