// assets/js/main.js
// منطق النماذج، Exit Intent، وتتبع الأفعال التجارية - متوافق مع V4.0

import { initLayout } from './layout.js';

document.addEventListener('DOMContentLoaded', () => {
    // تهيئة الهيكل (Navbar/Footer)
    initLayout();

    const tracking = window.DentalTracking;
    if (!tracking) return;

    // =============================================
    // 1) النماذج الذكية (Smart Forms)
    // =============================================
    const smartForm = document.getElementById('smartForm');
    const exitForm = document.getElementById('exitForm');

    if (smartForm) {
        smartForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(smartForm);
            const payload = Object.fromEntries(formData.entries());
            payload.uid = tracking.uid;
            payload.form_type = 'smart_form';

            try {
                const res = await fetch('/api/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                if (res.ok) {
                    tracking.sendTrackRequest('form_submit', { event_value: 'smart_form', identified_email: payload.identified_email });
                    const container = document.getElementById('smartFormContainer');
                    const thankYou = document.getElementById('thankYouMessage');
                    if (container) container.style.display = 'none';
                    if (thankYou) thankYou.style.display = 'block';
                    setTimeout(() => { window.location.href = `/api/download?uid=${tracking.uid}&file=ultimate-dental-guide`; }, 1000);
                }
            } catch (err) { console.error('Form error', err); }
        });
    }

    if (exitForm) {
        exitForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('exitEmail').value;
            try {
                const res = await fetch('/api/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uid: tracking.uid, identified_email: email, form_type: 'exit_intent' }) });
                if (res.ok) {
                    tracking.sendTrackRequest('form_submit', { event_value: 'exit_intent', identified_email: email });
                    const exitModal = document.getElementById('exitModal');
                    if (exitModal) exitModal.classList.remove('active');
                    alert('Check your inbox!');
                }
            } catch (err) { console.error('Exit form error', err); }
        });
    }

    // =============================================
    // 2) Exit Intent Popup
    // =============================================
    let exitShown = false;
    document.addEventListener('mouseout', (e) => {
        if (!exitShown && e.clientY < 5) {
            const exitModal = document.getElementById('exitModal');
            if (exitModal) exitModal.classList.add('active');
            exitShown = true;
        }
    });
    const closeExitModal = document.getElementById('closeExitModal');
    if (closeExitModal) closeExitModal.addEventListener('click', () => document.getElementById('exitModal')?.classList.remove('active'));

    // =============================================
    // 3) تتبع الأفعال التجارية (Affiliate & Downloads)
    // =============================================
    const ghlBtn = document.getElementById('ghlAffiliateBtn');
    if (ghlBtn) {
        ghlBtn.addEventListener('click', (e) => {
            e.preventDefault();
            // إرسال حدث النقر التجاري (سيقوم السيرفر بتسجيله في events table)
            tracking.sendTrackRequest('affiliate_click', { event_value: 'ghl_click' });
            setTimeout(() => { window.location.href = `/api/go?uid=${tracking.uid}&sid=${tracking.sessionId}`; }, 100);
        });
    }

    document.querySelectorAll('.download-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const file = link.dataset.file;
            // إرسال حدث التحميل التجاري
            tracking.sendTrackRequest('file_download', { event_value: file });
            setTimeout(() => { window.location.href = `/api/download?uid=${tracking.uid}&file=${file}`; }, 100);
        });
    });

});