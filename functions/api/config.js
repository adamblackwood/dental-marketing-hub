// functions/api/config.js
// الإعدادات المركزية للمشروع

export const SUPABASE_URL = 'https://vrqpshvlwtxvnbdwwfss.supabase.co';
export const SUPABASE_SERVICE_KEY = 'sb_publishable_KsDqW-jirTZVJQPv-y-jeA_doTRI0Ci';

export const TELEGRAM_BOT_TOKEN = '8424656659:AAEbo9X2Kuw1QZDRPyu_Uy-SNg6T36vQoRg';
export const TELEGRAM_CHAT_ID = '7203463194';

export const GOOGLE_SHEETS_WEBHOOK = 'https://script.google.com/macros/s/AKfycbwCSBtTxJVafochcb5tKHjPXTUdUjHaKlP0HOgO75iqojNcR9BwnCKCMot7GgCasXkSBQ/exec';

export const ADMIN_PASSWORD = 'SuperSecretAdminPassword123!';

export const GHL_AFFILIATE_LINK = 'https://www.gohighlevel.com/?fp_ref=robert-blackwood';

// =============================================
// قاموس روابط التحميل (Downloadable Files Mapping)
// المفتاح (Key): اسم منطقي يُستخدم في الكود وقاعدة البيانات (بدون مسافات).
// القيمة (Value): رابط التحميل المباشر من Google Drive.
// لإضافة ملف جديد: فقط أضف فاصلة، ثم 'اسم-الملف': 'الرابط-المباشر'
// =============================================
export const DOWNLOADABLE_FILES = {
  'ultimate-dental-guide': 'https://drive.google.com/uc?export=download&id=1A2B3C4D5E6F7G8H9I0J', // استبدل بالـ ID الخاص بدليل الأسنان
  'ghl-setup-guide': 'https://drive.google.com/uc?export=download&id=1X2Y3Z4W5V6U7T8S9R0Q',     // استبدل بالـ ID الخاص بإعداد GHL
  'automation-scripts': 'https://drive.google.com/uc?export=download&id=9Z8Y7X6W5V4U3T2S1R0Q',  // استبدل بالـ ID الخاص بالسكربتات
  'sms-templates-pack': 'https://drive.google.com/uc?export=download&id=0P1O2I3U4Y5T6R7E8W9Q'   // مثال لملف مستقبلي
};