// functions/api/admin/events/index.js
// GET /api/admin/events — List all events, newest first.

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
            `${SUPABASE_URL}/rest/v1/events?select=*&order=created_at.desc`,
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
