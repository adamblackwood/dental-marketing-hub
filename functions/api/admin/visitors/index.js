// functions/api/admin/visitors/index.js
// GET  /api/admin/visitors   — List all visitor_profiles
// POST /api/admin/visitors   — Create a visitor_profile manually

import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../../config.js";
import { isAuthenticated, unauthorizedResponse } from "../auth.js";

const SB_HEADERS = {
    "apikey":        SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type":  "application/json"
};

export async function onRequestGet(context) {
    if (!isAuthenticated(context.request)) return unauthorizedResponse();

    try {
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/visitor_profiles?select=*&order=last_seen_at.desc`,
            { headers: SB_HEADERS }
        );
        if (!res.ok) {
            return new Response(JSON.stringify({ error: "supabase_error" }), {
                status:  500,
                headers: { "Content-Type": "application/json" }
            });
        }
        const data = await res.json();
        return new Response(JSON.stringify({ data }), {
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

export async function onRequestPost(context) {
    if (!isAuthenticated(context.request)) return unauthorizedResponse();

    try {
        const body = await context.request.json();
        if (!body || !body.uid) {
            return new Response(JSON.stringify({ error: "uid required" }), {
                status:  400,
                headers: { "Content-Type": "application/json" }
            });
        }
        const nowIso = new Date().toISOString();
        const payload = {
            uid:               body.uid,
            fingerprint_id:    body.fingerprint_id    || null,
            identified_name:   body.identified_name   || null,
            identified_email:  body.identified_email  || null,
            is_identified:     !!body.is_identified,
            lead_score:        Number(body.lead_score) || 0,
            lead_status:       body.lead_status      || "cold",
            total_visits:      Number(body.total_visits)      || 0,
            total_conversions: Number(body.total_conversions) || 0,
            first_seen_at:     body.first_seen_at || nowIso,
            last_seen_at:      body.last_seen_at  || nowIso
        };

        const res = await fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles`, {
            method:  "POST",
            headers: {...SB_HEADERS, "Prefer": "return=representation" },
            body:    JSON.stringify(payload)
        });
        if (!res.ok) {
            const txt = await res.text();
            return new Response(JSON.stringify({ error: txt || "supabase_error" }), {
                status:  500,
                headers: { "Content-Type": "application/json" }
            });
        }
        const data = await res.json();
        return new Response(JSON.stringify({ success: true, data }), {
            status:  201,
            headers: { "Content-Type": "application/json" }
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: String(err && err.message || err) }), {
            status:  500,
            headers: { "Content-Type": "application/json" }
        });
    }
}
