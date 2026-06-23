// functions/api/admin/raw-data.js
// GET    /api/admin/raw-data?table=T&page=N        — Paginated list (limit 20)
// PATCH  /api/admin/raw-data?table=T&id=ROW_ID     — Update a row
// DELETE /api/admin/raw-data?table=T&id=ROW_ID     — Delete a row

import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../config.js";
import { isAuthenticated, unauthorizedResponse } from "./auth.js";

const SB_HEADERS = {
    "apikey":        SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type":  "application/json"
};

const PAGE_SIZE = 20;

// Whitelist of allowed tables and their primary keys.
const TABLES = {
    visitor_profiles: { pk: "uid",               orderBy: "last_seen_at.desc" },
    acquisitions:     { pk: "acquisition_id",    orderBy: "first_visit_at.desc" },
    visits:           { pk: "visit_id",          orderBy: "started_at.desc" },
    sessions:         { pk: "session_id",        orderBy: "started_at.desc" },
    visit_journeys:   { pk: "visit_id",          orderBy: null },
    events:           { pk: "event_id",          orderBy: "created_at.desc" },
    email_activities: { pk: "email_activity_id", orderBy: "created_at.desc" }
};

function badRequest(msg, status = 400) {
    return new Response(JSON.stringify({ error: msg }), {
        status,
        headers: { "Content-Type": "application/json" }
    });
}

function validateTable(table) {
    return TABLES[table] || null;
}

export async function onRequestGet(context) {
    if (!isAuthenticated(context.request)) return unauthorizedResponse();

    const url   = new URL(context.request.url);
    const table = url.searchParams.get("table");
    const page  = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const meta  = validateTable(table);
    if (!meta) return badRequest("invalid table");

    const from = (page - 1) * PAGE_SIZE;
    const to   = from + PAGE_SIZE - 1;

    const params = ["select=*"];
    if (meta.orderBy) params.push(`order=${meta.orderBy}`);
    const path = `${table}?${params.join("&")}`;

    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
            headers: {
              ...SB_HEADERS,
                "Prefer": "count=exact",
                "Range":        `${from}-${to}`,
                "Range-Unit":   "items"
            }
        });
        if (!res.ok) return badRequest("supabase_error", 500);
        const data  = await res.json();
        const range = res.headers.get("Content-Range") || res.headers.get("content-range") || "";
        const total = range.split("/")[1];
        const totalItems = total ? Number(total) : (Array.isArray(data) ? data.length : 0);
        const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));

        return new Response(JSON.stringify({
            data,
            pagination: { totalItems, currentPage: page, totalPages, pageSize: PAGE_SIZE }
        }), {
            status:  200,
            headers: { "Content-Type": "application/json" }
        });
    } catch (err) {
        return badRequest(String(err && err.message || err), 500);
    }
}

export async function onRequestPatch(context) {
    if (!isAuthenticated(context.request)) return unauthorizedResponse();

    const url   = new URL(context.request.url);
    const table = url.searchParams.get("table");
    const id    = url.searchParams.get("id");
    const meta  = validateTable(table);
    if (!meta) return badRequest("invalid table");
    if (!id)   return badRequest("id required");

    let body;
    try { body = await context.request.json(); }
    catch { return badRequest("invalid json body"); }

    // Strip PK from body.
    if (body && typeof body === "object") delete body[meta.pk];

    try {
        const filter = `${meta.pk}=eq.${encodeURIComponent(id)}`;
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
            method:  "PATCH",
            headers: {...SB_HEADERS, "Prefer": "return=representation" },
            body:    JSON.stringify(body)
        });
        if (!res.ok) return badRequest("supabase_error", 500);
        const data = await res.json();
        return new Response(JSON.stringify({ success: true, data }), {
            status:  200,
            headers: { "Content-Type": "application/json" }
        });
    } catch (err) {
        return badRequest(String(err && err.message || err), 500);
    }
}

export async function onRequestDelete(context) {
    if (!isAuthenticated(context.request)) return unauthorizedResponse();

    const url   = new URL(context.request.url);
    const table = url.searchParams.get("table");
    const id    = url.searchParams.get("id");
    const meta  = validateTable(table);
    if (!meta) return badRequest("invalid table");
    if (!id)   return badRequest("id required");

    try {
        const filter = `${meta.pk}=eq.${encodeURIComponent(id)}`;
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
            method:  "DELETE",
            headers: {...SB_HEADERS, "Prefer": "return=minimal" }
        });
        if (!res.ok) return badRequest("supabase_error", 500);
        return new Response(JSON.stringify({ success: true }), {
            status:  200,
            headers: { "Content-Type": "application/json" }
        });
    } catch (err) {
        return badRequest(String(err && err.message || err), 500);
    }
}
