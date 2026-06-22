// assets/js/main.js
// النماذج الذكية، Exit Intent، تتبع نقر الأفلييت، وتتبع التحميلات المنطقية
// تم تحديثه ليتوافق مع نظام أسماء الملفات المنطقية (data-file) بدلاً من الروابط المباشرة

document.addEventListener('DOMContentLoaded', () => {
    const tracking = window.DentalTracking;

    // =============================================
    // 1) النماذج الذكية (Smart Forms)
    // =============================================
    const smartForm = document.getElementById('smartForm');
    const exitForm = document.getElementById('exitForm');
    const nameGroup = document.getElementById('nameGroup');
    const challengeGroup = document.getElementById('challengeGroup');
    const emailGroup = document.getElementById('emailGroup');
    const smartFormContainer = document.getElementById('smartFormContainer');
    const thankYouMessage = document.getElementById('thankYouMessage');

    // فحص بيانات الزائر لعرض الحقول المفقودة فقط
    async function checkProfileAndAdaptForm() {
        try {
            const res = await fetch(`/api/profile-status?uid=${tracking.uid}`);
            if (res.ok) {
                const data = await res.json();
                if (data.exists && data.missing_fields) {
                    // عرض الحقل فقط إذا كانت البيانات مفقودة
                    if (data.missing_fields.name) nameGroup.style.display = 'block';
                    if (data.missing_fields.challenge) challengeGroup.style.display = 'block';
                    
                    // إذا كان الإيميل موجوداً بالفعل، نخفي الحقل
                    if (!data.missing_fields.email) {
                        emailGroup.style.display = 'none';
                    }
                } else {
                    // زائر جديد تماماً، نعرض الاسم والإيميل كحل وسط
                    nameGroup.style.display = 'block';
                }
            }
        } catch (e) { 
            console.error('Profile check failed', e); 
        }
    }
    checkProfileAndAdaptForm();

    // إرسال النموذج الرئيسي (Smart Form)
    if (smartForm) {
        smartForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(smartForm);
            const payload = Object.fromEntries(formData.entries());
            payload.uid = tracking.uid;
            payload.form_type = 'smart_form';

            try {
                const res = await fetch('/api/subscribe', { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify(payload) 
                });

                if (res.ok) {
                    // 1. تسجيل حدث إرسال النموذج في Supabase عبر track.js
                    tracking.sendTrackRequest('form_submit', { event_value: 'smart_form' });

                    // 2. إخفاء النموذج وإظهار رسالة الشكر
                    if (smartFormContainer) smartFormContainer.style.display = 'none';
                    if (thankYouMessage) thankYouMessage.style.display = 'block';

                    // 3. تحميل تلقائي للملف الرئيسي (الدليل الشامل) باستخدام الاسم المنطقي
                    // هذا الاسم ('ultimate-dental-guide') يجب أن يتطابق مع المفتاح في ملف config.js
                    setTimeout(() => {
                        window.location.href = `/api/download?uid=${tracking.uid}&file=ultimate-dental-guide`;
                    }, 1000); // تأخير ثانية واحدة ليقرأ المستخدم رسالة النجاح
                }
            } catch (err) { 
                console.error('Form submit error', err); 
            }
        });
    }

    // إرسال نموذج Exit Intent
    if (exitForm) {
        exitForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('exitEmail').value;
            
            try {
                const res = await fetch('/api/subscribe', { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify({ 
                        uid: tracking.uid, 
                        identified_email: email, 
                        form_type: 'exit_intent' 
                    }) 
                });

                if (res.ok) {
                    tracking.sendTrackRequest('form_submit', { event_value: 'exit_intent' });
                    const exitModal = document.getElementById('exitModal');
                    if (exitModal) exitModal.classList.remove('active');
                    alert('Check your inbox! Your guide is on the way.');
                }
            } catch (err) { 
                console.error('Exit form error', err); 
            }
        });
    }

    // =============================================
    // 2) Exit Intent Popup
    // =============================================
    const exitModal = document.getElementById('exitModal');
    let exitShown = false;

    document.addEventListener('mouseout', (e) => {
        // إظهار النافذة فقط إذا وصل الماوس لأعلى المتصفح (للخروج) ولم تُعرض من قبل
        if (!exitShown && e.clientY < 5) {
            if (exitModal) exitModal.classList.add('active');
            exitShown = true;
        }
    });

    const closeExitModal = document.getElementById('closeExitModal');
    if (closeExitModal) {
        closeExitModal.addEventListener('click', () => {
            if (exitModal) exitModal.classList.remove('active');
        });
    }

    // =============================================
    // 3) تتبع نقر الأفلييت (GoHighLevel Button)
    // =============================================
    const ghlBtn = document.getElementById('ghlAffiliateBtn');
    if (ghlBtn) {
        ghlBtn.addEventListener('click', (e) => {
            e.preventDefault();
            // التوجيه يتم لـ /api/go الذي بدوره يسجل الحدث في Supabase ثم يحول للرابط الأصلي
            window.location.href = `/api/go?uid=${tracking.uid}&sid=${tracking.sessionId}`;
        });
    }

    // =============================================
    // 4) تتبع روابط التحميل العادية (Resource Links)
    // =============================================
    // نلتقط جميع العناصر التي تحتوي على كلاس download-link
    const downloadLinks = document.querySelectorAll('.download-link');
    
    downloadLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            // نقرأ الاسم المنطقي من خاصية data-file (مثال: ghl-setup-guide)
            const fileKey = link.dataset.file;
            
            if (fileKey) {
                // التوجيه لـ /api/download الذي سيسجل الحدث ويحول للرابط المباشر من Google Drive
                window.location.href = `/api/download?uid=${tracking.uid}&file=${fileKey}`;
            } else {
                console.error('Missing data-file attribute on download link');
            }
        });
    });

});