// assets/js/main.js
// Site-wide commercial-action wiring: affiliate links, lead forms, download buttons.

(function () {
    "use strict";

    function getIds() {
        const uid = (window.DMRH && window.DMRH.uid) || localStorage.getItem("dmrh_uid") || "";
        const sid = (window.DMRH && window.DMRH.sid) || sessionStorage.getItem("dmrh_sid") || "";
        return { uid, sid };
    }

    function appendQuery(href, params) {
        try {
            const url = new URL(href, window.location.origin);
            Object.keys(params).forEach(k => {
                if (params[k]) url.searchParams.set(k, params[k]);
            });
            return url.toString();
        } catch (_) {
            const sep = href.includes("?") ? "&" : "?";
            const qs  = Object.keys(params).filter(k => params[k]).map(k => `${k}=${encodeURIComponent(params[k])}`).join("&");
            return `${href}${sep}${qs}`;
        }
    }

    // ---------- Affiliate links ----------
    function bindAffiliateLinks() {
        document.addEventListener("click", function (e) {
            const link = e.target.closest('a[href*="/api/go"]');
            if (!link) return;
            const { uid, sid } = getIds();
            const newHref = appendQuery(link.getAttribute("href"), { uid, sid });
            link.setAttribute("href", newHref);
            // Let the browser handle the actual navigation (no preventDefault).
        }, true);
    }

    // ---------- Lead form ----------
    function bindLeadForm() {
        const form = document.getElementById("smart-lead-form");
        if (!form) return;

        form.addEventListener("submit", async function (e) {
            e.preventDefault();
            const { uid, sid } = getIds();
            const fd = new FormData(form);
            const payload = {
                uid,
                session_id:         sid,
                identified_name:    (fd.get("identified_name")    || "").toString().trim(),
                identified_email:   (fd.get("identified_email")   || "").toString().trim(),
                phone_number:       (fd.get("phone_number")       || "").toString().trim(),
                biggest_challenge:  (fd.get("biggest_challenge")  || "").toString().trim()
            };

            const submitBtn = form.querySelector("[type=submit]");
            if (submitBtn) { submitBtn.disabled = true; submitBtn.dataset.origText = submitBtn.textContent; submitBtn.textContent = "Sending..."; }

            try {
                const res  = await fetch("/api/subscribe", {
                    method:  "POST",
                    headers: { "Content-Type": "application/json" },
                    body:    JSON.stringify(payload)
                });
                const data = await res.json().catch(() => ({}));
                if (res.ok && data.success) {
                    window.location.href = data.redirect || "/thank-you.html";
                    return;
                }
                alert("Submission failed. Please try again.");
            } catch (_) {
                alert("Network error. Please try again.");
            } finally {
                if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = submitBtn.dataset.origText || "Submit"; }
            }
        });
    }

    // ---------- Download buttons ----------
    function bindDownloadButtons() {
        document.addEventListener("click", async function (e) {
            const btn = e.target.closest(".download-btn");
            if (!btn) return;
            e.preventDefault();

            const fileKey = btn.getAttribute("data-file") || btn.dataset.file;
            if (!fileKey) return;

            const { uid, sid } = getIds();
            const origText = btn.textContent;
            btn.disabled = true;
            btn.textContent = "Preparing...";

            try {
                const url = `/api/download?uid=${encodeURIComponent(uid)}&sid=${encodeURIComponent(sid)}&file=${encodeURIComponent(fileKey)}`;
                const res = await fetch(url, { method: "GET" });
                const data = await res.json().catch(() => ({}));
                if (res.ok && data.success && data.download_url) {
                    window.open(data.download_url, "_blank", "noopener,noreferrer");
                } else {
                    alert("Download unavailable. Please try again.");
                }
            } catch (_) {
                alert("Network error. Please try again.");
            } finally {
                btn.disabled = false;
                btn.textContent = origText;
            }
        });
    }

    function boot() {
        bindAffiliateLinks();
        bindLeadForm();
        bindDownloadButtons();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    } else {
        boot();
    }
})();
