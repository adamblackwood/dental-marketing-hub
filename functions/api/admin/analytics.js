// functions/api/admin/analytics.js
// GET /api/admin/analytics — Aggregated KPIs for the dashboard top row.

import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../config.js";
import { isAuthenticated, unauthorizedResponse } from "./auth.js";

const SB_HEADERS = {
    "apikey":        SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type":  "application/json"
};

async function countTable(path) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        method:  "HEAD",
        headers: { ...SB_HEADERS, "Prefer": "count=exact", "Range": "0-0" }
    });
    if (!res.ok) return 0;
    const range = res.headers.get("Content-Range") || res.headers.get("content-range") || "";
    const total = range.split("/")[1];
    return total ? Number(total) : 0;
}

export async function onRequestGet(context) {
    if (!isAuthenticated(context.request)) return unauthorizedResponse();

    try {
        const [totalVisitors, hotLeads, totalVisits, totalConversions] = await Promise.all([
            countTable("visitor_profiles?select=uid"),
            countTable("visitor_profiles?select=uid&lead_status=eq.hot"),
            countTable("visits?select=visit_id"),
            countTable("events?select=event_id&event_type=in.(file_download,form_submit,affiliate_click)")
        ]);

        return new Response(JSON.stringify({
            total_visitors:    totalVisitors,
            hot_leads:         hotLeads,
            total_visits:      totalVisits,
            total_conversions: totalConversions
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
