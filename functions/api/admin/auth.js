// functions/api/admin/auth.js
// GET    /api/admin/auth   → verify session
// POST   /api/admin/auth   → login (set cookie)
// DELETE /api/admin/auth   → logout (clear cookie)

import { ADMIN_PASSWORD } from "../config.js";

const COOKIE_NAME    = "admin_session";
const COOKIE_MAX_AGE = 60 * 60 * 24; // 24 hours

function parseCookies(cookieHeader) {
    const out = {};
    if (!cookieHeader) return out;
    cookieHeader.split(";").forEach(pair => {
        const idx = pair.indexOf("=");
        if (idx === -1) return;
        const k = pair.slice(0, idx).trim();
        const v = pair.slice(idx + 1).trim();
        if (k) out[k] = decodeURIComponent(v);
    });
    return out;
}

export function isAuthenticated(request) {
    const cookies = parseCookies(request.headers.get("Cookie") || "");
    return cookies[COOKIE_NAME] && cookies[COOKIE_NAME] === ADMIN_PASSWORD;
}

export function unauthorizedResponse() {
    return new Response(JSON.stringify({ authenticated: false, error: "unauthorized" }), {
        status:  401,
        headers: { "Content-Type": "application/json" }
    });
}

function buildSetCookie(value, maxAge) {
    const parts = [
        `${COOKIE_NAME}=${encodeURIComponent(value)}`,
        "Path=/",
        "HttpOnly",
        "Secure",
        "SameSite=Strict",
        `Max-Age=${maxAge}`
    ];
    return parts.join("; ");
}

export async function onRequestGet(context) {
    if (!isAuthenticated(context.request)) return unauthorizedResponse();
    return new Response(JSON.stringify({ authenticated: true }), {
        status:  200,
        headers: { "Content-Type": "application/json" }
    });
}

export async function onRequestPost(context) {
    try {
        const body = await context.request.json();
        if (!body.password || body.password !== ADMIN_PASSWORD) {
            return new Response(JSON.stringify({ success: false, error: "invalid_password" }), {
                status:  401,
                headers: { "Content-Type": "application/json" }
            });
        }
        return new Response(JSON.stringify({ success: true }), {
            status:  200,
            headers: {
                "Content-Type": "application/json",
                "Set-Cookie":   buildSetCookie(ADMIN_PASSWORD, COOKIE_MAX_AGE)
            }
        });
    } catch (err) {
        return new Response(JSON.stringify({ success: false, error: String(err && err.message || err) }), {
            status:  400,
            headers: { "Content-Type": "application/json" }
        });
    }
}

export async function onRequestDelete() {
    return new Response(JSON.stringify({ success: true }), {
        status:  200,
        headers: {
            "Content-Type": "application/json",
            "Set-Cookie":   buildSetCookie("", 0)
        }
    });
}
