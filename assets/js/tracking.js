// assets/js/tracking.js
// Zero-Bloat tracking engine — UID, session, scroll, heartbeat, exit, page changes.

(function () {
    "use strict";

    const API_TRACK = "/api/track";

    // ---------- UID & Session ID ----------
    function uuid() {
        if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
            const r = (Math.random() * 16) | 0;
            const v = c === "x" ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    }

    function getOrCreateUID() {
        // ABM merge: ?identified=UID overrides local UID.
        const params = new URLSearchParams(window.location.search);
        const identified = params.get("identified");
        if (identified) {
            try { localStorage.setItem("dmrh_uid", identified); } catch (_) {}
            // Strip the param from the URL for cleanliness.
            params.delete("identified");
            const newSearch = params.toString();
            const newUrl    = window.location.pathname + (newSearch ? "?" + newSearch : "") + window.location.hash;
            try { history.replaceState({}, "", newUrl); } catch (_) {}
            return identified;
        }
        let uid;
        try { uid = localStorage.getItem("dmrh_uid"); } catch (_) {}
        if (!uid) {
            uid = uuid();
            try { localStorage.setItem("dmrh_uid", uid); } catch (_) {}
        }
        return uid;
    }

    function getOrCreateSessionID() {
        let sid;
        try { sid = sessionStorage.getItem("dmrh_sid"); } catch (_) {}
        if (!sid) {
            sid = uuid();
            try { sessionStorage.setItem("dmrh_sid", sid); } catch (_) {}
        }
        return sid;
    }

    const UID = getOrCreateUID();
    const SID = getOrCreateSessionID();
    const STARTED_AT = Date.now();

    // Expose for main.js + admin scripts.
    window.DMRH = window.DMRH || {};
    window.DMRH.uid = UID;
    window.DMRH.sid = SID;

    // ---------- Helpers ----------
    function getUTMs() {
        const p = new URLSearchParams(window.location.search);
        return {
            utm_source:   p.get("utm_source")   || null,
            utm_campaign: p.get("utm_campaign") || null,
            utm_medium:   p.get("utm_medium")   || null,
            utm_content:  p.get("utm_content")  || null,
            utm_term:     p.get("utm_term")     || null
        };
    }

    function getReferrer() {
        try { return document.referrer || null; } catch (_) { return null; }
    }

    function inferSource() {
        const utm = getUTMs();
        if (utm.utm_source) return utm.utm_source;
        const ref = getReferrer();
        if (!ref) return "direct";
        try {
            const host = new URL(ref).hostname;
            if (host.includes("facebook")) return "facebook";
            if (host.includes("google"))   return "google";
            if (host.includes("twitter") || host.includes("x.com")) return "twitter";
            if (host.includes("linkedin")) return "linkedin";
            return host;
        } catch (_) { return "referral"; }
    }

    function sendTrack(eventType, extraData, useBeacon) {
        const payload = {
            event_type: eventType,
            uid:        UID,
            session_id: SID,
            data:       extraData || {}
        };
        const body = JSON.stringify(payload);
        try {
            if (useBeacon && navigator.sendBeacon) {
                const blob = new Blob([body], { type: "application/json" });
                navigator.sendBeacon(API_TRACK, blob);
                return;
            }
            fetch(API_TRACK, {
                method:      "POST",
                headers:     { "Content-Type": "application/json" },
                body,
                keepalive:   true,
                credentials: "same-origin"
            }).catch(() => {});
        } catch (_) { /* swallow */ }
    }

    // ---------- session_start ----------
    function sendSessionStart() {
        const utm = getUTMs();
        sendTrack("session_start", {
            landing_page:   window.location.pathname,
            referrer:       getReferrer(),
            source:         inferSource(),
            utm_source:     utm.utm_source,
            utm_campaign:   utm.utm_campaign,
            utm_medium:     utm.utm_medium,
            utm_content:    utm.utm_content,
            utm_term:       utm.utm_term,
            fingerprint_id: null,
            device_type:    null,  // server infers from UA
            user_agent:     navigator.userAgent || "",
            screen_w:       window.screen ? window.screen.width  : null,
            screen_h:       window.screen ? window.screen.height : null,
            timezone:       Intl && Intl.DateTimeFormat ? Intl.DateTimeFormat().resolvedOptions().timeZone : null
        });
    }

    // ---------- Heartbeat ----------
    let hbInterval = null;
    function startHeartbeat() {
        if (hbInterval) clearInterval(hbInterval);
        hbInterval = setInterval(() => {
            if (document.visibilityState === "visible") {
                sendTrack("heartbeat", {});
            }
        }, 5000);
    }

    // ---------- Scroll ----------
    let maxScrollPct = 0;
    const SCROLL_BUCKETS = [25, 50, 75, 100];
    const firedBuckets   = new Set();

    function computeScrollPct() {
        const doc       = document.documentElement;
        const body      = document.body;
        const scrollTop = window.pageYOffset || doc.scrollTop || body.scrollTop || 0;
        const winH      = window.innerHeight || doc.clientHeight;
        const fullH     = Math.max(body.scrollHeight, doc.scrollHeight, body.offsetHeight, doc.offsetHeight, body.clientHeight, doc.clientHeight);
        if (fullH <= winH) return 100;
        const pct = ((scrollTop + winH) / fullH) * 100;
        return Math.max(0, Math.min(100, Math.round(pct)));
    }

    function onScroll() {
        const pct = computeScrollPct();
        if (pct > maxScrollPct) maxScrollPct = pct;
        for (const b of SCROLL_BUCKETS) {
            if (maxScrollPct >= b && !firedBuckets.has(b)) {
                firedBuckets.add(b);
                sendTrack("scroll", { scroll_pct: b });
            }
        }
    }

    // ---------- Page change (SPA / programmatic) ----------
    function sendPageChange(newPath) {
        sendTrack("page_change", { page: newPath || window.location.pathname });
    }

    function patchHistory() {
        const _push    = history.pushState;
        const _replace = history.replaceState;
        history.pushState = function () {
            const ret = _push.apply(this, arguments);
            try { sendPageChange(window.location.pathname); } catch (_) {}
            return ret;
        };
        history.replaceState = function () {
            const ret = _replace.apply(this, arguments);
            try { sendPageChange(window.location.pathname); } catch (_) {}
            return ret;
        };
        window.addEventListener("popstate", () => sendPageChange(window.location.pathname));
    }

    // ---------- Exit ----------
    let exitSent = false;
    function sendExit() {
        if (exitSent) return;
        exitSent = true;
        const durationSec = Math.max(0, Math.round((Date.now() - STARTED_AT) / 1000));
        sendTrack("exit", {
            duration_sec:   durationSec,
            max_scroll_pct: maxScrollPct,
            exit_page:      window.location.pathname
        }, true);
    }

    function bindExitListeners() {
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "hidden") sendExit();
        });
        window.addEventListener("pagehide",      sendExit);
        window.addEventListener("beforeunload",  sendExit);
    }

    // ---------- Bootstrap ----------
    function boot() {
        sendSessionStart();
        startHeartbeat();
        window.addEventListener("scroll",  onScroll, { passive: true });
        window.addEventListener("resize",  onScroll, { passive: true });
        patchHistory();
        bindExitListeners();
        // Initial scroll snapshot in case page loads scrolled.
        setTimeout(onScroll, 250);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    } else {
        boot();
    }
})();
