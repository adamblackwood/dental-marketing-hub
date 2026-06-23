// functions/api/config.js
// Centralized Configuration for Cloudflare Pages Functions

export const SUPABASE_URL = 'https://YOUR_PROJECT_REF.supabase.co';
export const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
export const TELEGRAM_BOT_TOKEN = 'YOUR_TELEGRAM_BOT_TOKEN';
export const TELEGRAM_CHAT_ID = 'YOUR_TELEGRAM_CHAT_ID';
export const GOOGLE_SHEETS_WEBHOOK = 'https://script.google.com/macros/s/YOUR_SHEET_WEBHOOK/exec';
export const GHL_AFFILIATE_LINK = 'https://www.gohighlevel.com/main-page?aff_id=YOUR_AFF_ID';
export const ADMIN_PASSWORD = 'YOUR_SECURE_ADMIN_PASSWORD';

// Map of allowed download files
export const FILES_MAP = {
  'dental-marketing-pdf': 'https://your-supabase-storage-url.com/dental-marketing-guide.pdf',
  'checklist-pdf': 'https://your-supabase-storage-url.com/checklist.pdf'
};