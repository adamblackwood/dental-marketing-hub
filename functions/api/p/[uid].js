// functions/api/p/[uid].js
// تحويل العميل البارد للرئيسية مع الحفاظ على الـ UID في الرابط (?identified=uid)

// التصحيح: استخدام ../ بدلاً من ../../ (رغم أننا لا نستوردها هنا، لكن إذا أضفنا استيراداً مستقبلاً)
// لا يوجد استيراد حالياً في هذا الملف، لكن احفظ القاعدة
export async function onRequestGet(context) {
  const uid = context.params.uid;
  const targetUrl = new URL(context.request.url).origin + `/?identified=${uid}`;
  return Response.redirect(targetUrl, 302);
}