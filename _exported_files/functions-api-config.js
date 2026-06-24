// functions/api/config.js
// Centralized Configuration for Cloudflare Pages Functions

export const SUPABASE_URL = 'https://vrqpshvlwtxvnbdwwfss.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_KsDqW-jirTZVJQPv-y-jeA_doTRI0Ci';
export const SUPABASE_SERVICE_KEY = 'sb_publishable_KsDqW-jirTZVJQPv-y-jeA_doTRI0Ci'; // Note: Replace with sb_secret_... key if admin scripts need to bypass RLS

export const TELEGRAM_BOT_TOKEN = '8424656659:AAEbo9X2Kuw1QZDRPyu_Uy-SNg6T36vQoRg';
export const TELEGRAM_CHAT_ID = '7203463194';

export const GOOGLE_SHEETS_WEBHOOK = 'https://script.google.com/macros/s/AKfycbwCSBtTxJVafochcb5tKHjPXTUdUjHaKlP0HOgO75iqojNcR9BwnCKCMot7GgCasXkSBQ/exec';

export const ADMIN_PASSWORD = 'SuperSecretAdminPassword123!';

export const GHL_AFFILIATE_LINK = 'https://www.gohighlevel.com/?fp_ref=robert-blackwood';

// Map of allowed download files (Update these URLs to your actual Supabase Storage URLs)
export const FILES_MAP = {
  'dental-marketing-pdf': 'https://vrqpshvlwtxvnbdwwfss.supabase.co/storage/v1/object/public/leads/dental-marketing-guide.pdf',
  'checklist-pdf': 'https://vrqpshvlwtxvnbdwwfss.supabase.co/storage/v1/object/public/leads/checklist.pdf'
};