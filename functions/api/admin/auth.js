// functions/api/admin/auth.js
// تسجيل الدخول والخروج - HTTP-only Cookie

import { ADMIN_PASSWORD } from '../config.js';

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

export async function onRequestDelete(context) {
  return new Response(JSON.stringify({ success: true }), {
    headers: {
      'Set-Cookie': `admin_session=; HttpOnly; Secure; Path=/; Max-Age=0`,
      'Content-Type': 'application/json'
    }
  });
}