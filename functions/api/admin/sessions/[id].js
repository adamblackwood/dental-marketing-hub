// functions/api/admin/sessions/[id].js
// DELETE /api/admin/sessions/:id — Delete session by session_id.

import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../../config.js";
import { isAuthenticated, unauthorizedResponse } from "../auth.js";

const SB_HEADERS = {
    "apikey":        SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type":  "application/json"
};

export async function onRequestDelete(context) {
    if (!isAuthenticated(context.request)) return unauthorizedResponse();

    const sessionId = context.params.id;
    if (!sessionId) {
        return new Response(JSON.stringify({ error: "session_id required" }), {
            status:  400,
            headers: { "Content-Type": "application/json" }
        });
    }

    try {
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/sessions?session_id=eq.${encodeURIComponent(sessionId)}`,
            {
                method:  "DELETE",
                headers: {...SB_HEADERS, "Prefer": "return=minimal" }
            }
        );
        if (!res.ok) {
            return new Response(JSON.stringify({ error: "supabase_error" }), {
                status:  500,
                headers: { "Content-Type": "application/json" }
            });
        }
        return new Response(JSON.stringify({ success: true }), {
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
