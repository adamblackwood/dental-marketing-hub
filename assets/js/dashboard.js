// assets/js/dashboard.js
// Admin dashboard logic — auth check, KPIs, tabbed data tables, 360° journey modal.

(function () {
    "use strict";

    // ---------- Auth gate ----------
    async function ensureAuth() {
        try {
            const res = await fetch("/api/admin/auth", { credentials: "same-origin" });
            if (res.status === 401) {
                window.location.href = "/admin/login.html";
                return false;
            }
            return true;
        } catch (_) {
            window.location.href = "/admin/login.html";
            return false;
        }
    }

    // ---------- Helpers ----------
    function el(id) { return document.getElementById(id); }
    function fmt(v) {
        if (v === null || v === undefined) return "—";
        if (typeof v === "boolean") return v ? "✓" : "✗";
        if (typeof v === "object") return JSON.stringify(v);
        return String(v);
    }
    function fmtDate(v) {
        if (!v) return "—";
        try {
            const d = new Date(v);
            if (isNaN(d.getTime())) return String(v);
            return d.toLocaleString();
        } catch (_) { return String(v); }
    }
    function escapeHtml(s) {
        if (s === null || s === undefined) return "";
        return String(s)
            .replace(/&/g,  "&amp;")
            .replace(/</g,  "&lt;")
            .replace(/>/g,  "&gt;")
            .replace(/"/g,  "&quot;")
            .replace(/'/g,  "&#39;");
    }
    function leadBadge(status) {
        const s = (status || "cold").toLowerCase();
        const cls = s === "hot" ? "badge-hot" : s === "warm" ? "badge-warm" : "badge-cold";
        return `<span class="badge ${cls}">${s}</span>`;
    }

    // ---------- KPI section ----------
    async function loadKPIs() {
        try {
            const res  = await fetch("/api/admin/analytics", { credentials: "same-origin" });
            if (!res.ok) return;
            const data = await res.json();
            el("kpi-visitors").textContent    = (data.total_visitors    || 0).toLocaleString();
            el("kpi-hot").textContent         = (data.hot_leads         || 0).toLocaleString();
            el("kpi-visits").textContent      = (data.total_visits      || 0).toLocaleString();
            el("kpi-conversions").textContent = (data.total_conversions || 0).toLocaleString();
        } catch (_) { /* swallow */ }
    }

    // ---------- Tab state ----------
    const STATE = { activeTab: "visitors", rows: [], filter: "" };

    // ---------- Renderers ----------
    function renderVisitorsTable(rows) {
        el("main-thead").innerHTML = `
            <tr>
                <th>UIDh><th>Name / Emailh><th>Statush><th>Scoreh>
                <th>Visitsh><th>Conv.h><th>Last Seenh><th>Actionsh>
            r>`;
        if (!rows || rows.length === 0) {
            el("main-tbody").innerHTML = `<tr><td colspan="8" class="empty-state">No visitors yet.d>r>`;
            return;
        }
        el("main-tbody").innerHTML = rows.map(r => `
            <tr>
                <td><code>${escapeHtml((r.uid || "").slice(0, 10))}…</code>d>
                <td>
                    ${r.identified_name  ? `<strong>${escapeHtml(r.identified_name)}</strong> ` : ""}
                    <span style="color:var(--text-secondary)">${escapeHtml(r.identified_email || "—")}</span>
                d>
                <td>${leadBadge(r.lead_status)}d>
                <td>${fmt(r.lead_score)}d>
                <td>${fmt(r.total_visits)}d>
               
