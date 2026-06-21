// functions/api/config.js

// 1. إعدادات Supabase (تم وضع بياناتك)
export const SUPABASE_URL = 'https://vrqpshvlwtxvnbdwwfss.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_KsDqW-jirTZVJQPv-y-jeA_doTRI0Ci';

// 2. إعدادات Telegram (تم وضع بياناتك)
export const TELEGRAM_TOKEN = '8424656659:AAEbo9X2Kuw1QZDRPyu_Uy-SNg6T36vQoRg';
export const TELEGRAM_CHAT_ID = '7203463194';

// 3. إعدادات Google Sheets (تم وضع رابطك)
export const GOOGLE_SHEETS_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbwCSBtTxJVafochcb5tKHjPXTUdUjHaKlP0HOgO75iqojNcR9BwnCKCMot7GgCasXkSBQ/exec';

// 4. إعدادات الأفلييت والتحميل (يجب عليك تعبئتها)
export const GHL_AFFILIATE_LINK = 'https://affiliate.gohighlevel.com?sref=tsio91u'; // ⚠️ ضع هنا رابط الأفلييت الخاص بك في GHL
export const FILES_MAP = {
  // ⚠️ ضع هنا رابط مباشر لملف الـ PDF الذي سيعطيه الزائر بعد التسجيل
  'ghl-setup-guide': 'https://your-storage.com/files/ghl-setup-guide.pdf' 
};

// 5. إعدادات الأمان والإدارة
export const ADMIN_SECRET = 'AdminSecretPass123'; // ⚠️ غيّر هذه الكلمة لحماية لوحة التحكم الخاصة بك