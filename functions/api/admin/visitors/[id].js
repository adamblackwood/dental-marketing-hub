// functions/api/admin/visitors/[id].js
// PATCH  /api/admin/visitors/:id  — Update visitor_profile by uid
// DELETE /api/admin/visitors/:id  — Delete visitor_profile (cascades)

import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../../config.js";
import { isAuthenticated, unauthorizedResponse } from "../auth.js";

const SB_HEADERS = {
    "apikey":        SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type":  "application/json"
};

export async function onRequestPatch(context) {
    if (!isAuthenticated(context.request)) return unauthorizedResponse();

    const uid = context.params.id;
    if (!uid) {
        return new Response(JSON.stringify({ error: "uid required" }), {
            status:  400,
            headers: { "Content-Type": "application/json" }
        });
    }

    try {
        const body = await context.request.json();
        if (body && typeof body === "object") delete body.uid;

        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/visitor_profiles?uid=eq.${encodeURIComponent(uid)}`,
            {
                method:  "PATCH",
                headers: {...SB_HEADERS, "Prefer": "return=representation" },
                body:    JSON.stringify(body)
            }
        );
        if (!res.ok) {
            const txt = await res.text();
            return new Response(JSON.stringify({ error: txt || "supabase_error" }), {
                status:  500,
                headers: { "Content-Type": "application/json" }
            });
        }
        const data = await res.json();
        return new Response(JSON.stringify({ success: true, data }), {
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

export async function onRequestDelete(context) {
    if (!isAuthenticated(context.request)) return unauthorizedResponse();

    const uid = context.params.id;
    if (!uid) {
        return new Response(JSON.stringify({ error: "uid required" }), {
            status:  400,
            headers: { "Content-Type": "application/json" }
        });
    }

    try {
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/visitor_profiles?uid=eq.${encodeURIComponent(uid)}`,
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
