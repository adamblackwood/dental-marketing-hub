// functions/api/p/[uid].js

export async function onRequestGet(context) {
  try {
    // استخراج الـ UID من الـ URL الديناميكي
    const uid = context.params.uid;
    
    if (!uid) {
      return Response.redirect(new URL(context.request.url).origin, 302);
    }

    // بناء الرابط الجديد مع إضافة الـ identified
    const baseUrl = new URL(context.request.url);
    const redirectUrl = new URL('/', baseUrl.origin);
    redirectUrl.searchParams.set('identified', uid);

    // تحويل الزائر فوراً للرئيسية
    // الـ JS في المتصفح سيقرأ ?identified= ويرسل حدث session_start بالبصمة والـ UID
    return Response.redirect(redirectUrl.toString(), 302);

  } catch (error) {
    console.error('UID Redirect Error:', error);
    // في حالة الخطأ، نوجه للرئيسية لتجنب تعطل تجربة المستخدم
    return Response.redirect(new URL(context.request.url).origin, 302);
  }
}