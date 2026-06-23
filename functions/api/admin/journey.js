// functions/api/admin/journey.js
// GET /api/admin/journey?uid=XXX — 360° unified visitor view.

import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../config.js";
import { isAuthenticated, unauthorizedResponse } from "./auth.js";

const SB_HEADERS = {
    "apikey":        SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type":  "application/json"
};

async function sbGet(path) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: SB_HEADERS });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
}

export async function onRequestGet(context) {
    if (!isAuthenticated(context.request)) return unauthorizedResponse();

    const url = new URL(context.request.url);
    const uid = url.searchParams.get("uid");
    if (!uid) {
        return new Response(JSON.stringify({ error: "uid required" }), {
            status:  400,
            headers: { "Content-Type": "application/json" }
        });
    }

    const u = encodeURIComponent(uid);
    try {
        const [profileArr, acquisitions, visits, journeys, events, emailActivities] = await Promise.all([
            sbGet(`visitor_profiles?uid=eq.${u}&select=*`),
            sbGet(`acquisitions?uid=eq.${u}&select=*&order=touch_order.asc`),
            sbGet(`visits?uid=eq.${u}&select=*&order=started_at.desc`),
            sbGet(`visit_journeys?uid=eq.${u}&select=*`),
            sbGet(`events?uid=eq.${u}&select=*&order=created_at.desc`),
            sbGet(`email_activities?uid=eq.${u}&select=*&order=created_at.desc`)
        ]);

        return new Response(JSON.stringify({
            visitor_profile:  profileArr[0] || null,
            acquisitions,
            visits,
            visit_journeys:   journeys,
            events,
            email_activities: emailActivities
        }), {
            status:  200,
            headers: { "Content-Type": "application/json" }
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: String(err && err.message || err) }), {
            status:  500,
            headers: { "Content-Type": "application/json" }
        });
    }
}
