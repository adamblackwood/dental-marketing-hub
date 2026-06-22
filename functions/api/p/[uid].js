// functions/api/p/[uid].js
// تحويل العميل البارد للرئيسية مع الحفاظ على الـ UID في الرابط (?identified=uid)

export async function onRequestGet(context) {
  const uid = context.params.uid;
  const targetUrl = new URL(context.request.url).origin + `/?identified=${uid}`;
  return Response.redirect(targetUrl, 302);
}