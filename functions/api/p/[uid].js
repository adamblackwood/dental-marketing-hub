// functions/api/p/[uid].js
// GET /api/p/UID  — Cold email link click → mark entered_site, redirect to home.

import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../config.js";

const SB_HEADERS = {
    "apikey":         SUPABASE_ANON_KEY,
    "Authorization":  `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type":   "application/json"
};

async function markEnteredSite(uid) {
    try {
        await fetch(
            `${SUPABASE_URL}/rest/v1/email_activities?uid=eq.${encodeURIComponent(uid)}`,
            {
                method:  "PATCH",
                headers: {...SB_HEADERS, "Prefer": "return=minimal" },
                body:    JSON.stringify({ entered_site: true })
            }
        );
    } catch (_) { /* swallow */ }
}

export async function onRequestGet(context) {
    const uid = context.params.uid;
    const url = new URL(context.request.url);

    context.waitUntil(markEnteredSite(uid));

    const origin = `${url.protocol}//${url.host}`;
    const target = `${origin}/?identified=${encodeURIComponent(uid)}`;
    return Response.redirect(target, 302);
}
