// functions/api/admin/auth.js

import { ADMIN_SECRET } from '../config.js';

export async function onRequestPost(context) {
  try {
    const { password } = await context.request.json();

    if (password === ADMIN_SECRET) {
      // كلمة المرور صحيحة: ننشئ Cookie آمنة
      const cookieValue = 'admin_session=true; HttpOnly; Secure; Path=/; SameSite=Strict; Max-Age=86400'; // صالحة لمدة 24 ساعة
      
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          'Set-Cookie': cookieValue,
          'Content-Type': 'application/json'
        }
      });
    } else {
      // كلمة المرور خاطئة
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Bad Request' }), { status: 400 });
  }
}

// لتسجيل الخروج (حذف الـ Cookie)
export async function onRequestDelete(context) {
  const cookieValue = 'admin_session=; HttpOnly; Secure; Path=/; SameSite=Strict; Max-Age=0'; // Max-Age=0 يحذفها فوراً
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      'Set-Cookie': cookieValue,
      'Content-Type': 'application/json'
    }
  });
}