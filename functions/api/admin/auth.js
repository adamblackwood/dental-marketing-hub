// functions/api/admin/auth.js
// تسجيل الدخول والخروج - HTTP-only Cookie + فحص المصادقة

import { ADMIN_PASSWORD } from '../config.js';

// فحص المصادقة (يقرأ السيرفر الـ HttpOnly Cookie ويرد بالنتيجة)
export async function onRequestGet(context) {
  const cookieHeader = context.request.headers.get('cookie') || '';
  if (cookieHeader.includes(`admin_session=${ADMIN_PASSWORD}`)) {
    return new Response(JSON.stringify({ authenticated: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  return new Response(JSON.stringify({ authenticated: false }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' }
  });
}

// تسجيل الدخول (إنشاء الكوكي)
export async function onRequestPost(context) {
  const body = await context.request.json();
  if (body.password === ADMIN_PASSWORD) {
    return new Response(JSON.stringify({ success: true }), {
      headers: {
        'Set-Cookie': `admin_session=${ADMIN_PASSWORD}; HttpOnly; Secure; Path=/; Max-Age=86400`,
        'Content-Type': 'application/json'
      }
    });
  }
  return new Response(JSON.stringify({ error: 'Invalid password' }), { status: 401 });
}

// تسجيل الخروج (حذف الكوكي)
export async function onRequestDelete(context) {
  return new Response(JSON.stringify({ success: true }), {
    headers: {
      'Set-Cookie': `admin_session=; HttpOnly; Secure; Path=/; Max-Age=0`,
      'Content-Type': 'application/json'
    }
  });
}