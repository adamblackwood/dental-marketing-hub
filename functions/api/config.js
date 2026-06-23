// functions/api/config.js
// Central configuration — replace placeholder strings before deployment.

export const SUPABASE_URL          = "https://vrqpshvlwtxvnbdwwfss.supabase.co";
export const SUPABASE_ANON_KEY     = "sb_publishable_KsDqW-jirTZVJQPv-y-jeA_doTRI0Ci";
export const SUPABASE_SERVICE_KEY  = "sb_secret_F4Fh6A-75GfFBc9WmDtq1A__7rYFYdj";

export const TELEGRAM_BOT_TOKEN    = "8424656659:AAEbo9X2Kuw1QZDRPyu_Uy-SNg6T36vQoRg";
export const TELEGRAM_CHAT_ID      = "7203463194"

export const GOOGLE_SHEETS_WEBHOOK = "https://script.google.com/macros/s/AKfycbwCSBtTxJVafochcb5tKHjPXTUdUjHaKlP0HOgO75iqojNcR9BwnCKCMot7GgCasXkSBQ/exec";

export const GHL_AFFILIATE_LINK    = "https://www.gohighlevel.com/?fp_ref=robert-blackwood";

export const ADMIN_PASSWORD        = "ChangeMe_StrongAdminPassword_2026!";
export const ADMIN_SESSION_SECRET  = "ChangeMe_HMAC_Secret_For_Cookies_2026!";

// Lead Magnet whitelist — keys must match the `file` query parameter on /api/download.
export const FILES_MAP = {
    "dental_marketing_guide_2026":  "https://your-cdn-host.com/files/dental_marketing_guide_2026.pdf",
    "ghl_setup_checklist":          "https://your-cdn-host.com/files/ghl_setup_checklist.pdf",
    "patient_followup_templates":   "https://your-cdn-host.com/files/patient_followup_templates.pdf",
    "facebook_ads_swipe_file":      "https://your-cdn-host.com/files/facebook_ads_swipe_file.pdf"
};

// Lead scoring weights and thresholds.
export const SCORE_WEIGHTS = {
    file_download:   20,
    form_submit:     30,
    affiliate_click: 50,
    email_open:      5
};

export const LEAD_STATUS_THRESHOLDS = {
    warm: 30,
    hot:  70
};

// Visit/session inactivity boundary in milliseconds (30 minutes).
export const VISIT_INACTIVITY_MS = 30 * 60 * 1000;
