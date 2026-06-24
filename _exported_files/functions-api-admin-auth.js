// functions/api/admin/auth.js
import { ADMIN_PASSWORD } from '../config.js';

const SESSION_COOKIE = 'admin_session';

export async function onRequestGet(context) {
  const cookie = context.request.headers.get('Cookie') || '';
  if (cookie.includes(`${SESSION_COOKIE}=${ADMIN_PASSWORD}`)) {
    return new Response(JSON.stringify({ authenticated: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  return new Response(JSON.stringify({ authenticated: false }), { status: 401 });
}

export async function onRequestPost(context) {
  try {
    const { password } = await context.request.json();
    if (password === ADMIN_PASSWORD) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': `${SESSION_COOKIE}=${ADMIN_PASSWORD}; HttpOnly; Secure; Path=/; Max-Age=86400; SameSite=Strict`
        }
      });
    }
    return new Response(JSON.stringify({ success: false, message: 'Invalid password' }), { status: 401 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

export async function onRequestDelete(context) {
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `${SESSION_COOKIE}=; HttpOnly; Secure; Path=/; Max-Age=0; SameSite=Strict`
    }
  });
}