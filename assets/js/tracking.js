// assets/js/tracking.js
// مستشعر التتبع V4.0: يدعم الرحلات (Journeys)، يمنع تكدس البيانات، يحترم قاعدة الـ 30 دقيقة

(function() {
    const API_TRACK = '/api/track';
    const UID_KEY = 'dental_hub_uid';
    const SID_KEY = 'dental_hub_sid';

    let uid = localStorage.getItem(UID_KEY);
    if (!uid) {
        uid = crypto.randomUUID();
        localStorage.setItem(UID_KEY, uid);
    }

    let sessionId = sessionStorage.getItem(SID_KEY);
    let isNewSession = !sessionId;
    if (isNewSession) {
        sessionId = crypto.randomUUID();
        sessionStorage.setItem(SID_KEY, sessionId);
    }

    const urlParams = new URLSearchParams(window.location.search);
    const getParam = (key) => urlParams.get(key) || null;

    const trackingData = {
        uid: uid,
        session_id: sessionId,
        source: getParam('source') || document.referrer || 'direct',
        utm_source: getParam('utm_source'),
        utm_campaign: getParam('utm_campaign'),
        landing_page: window.location.pathname,
        fingerprint_id: navigator.userAgent,
        device_type: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
    };

    // متغيرات محلية فقط (لا تُرسل للسيرفر إلا عند الخروج)
    let startTime = Date.now();
    let maxScroll = 0;

    function sendTrackRequest(eventType, payload = {}) {
        const body = { ...trackingData, ...payload, event_type: eventType };
        fetch(API_TRACK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            keepalive: true
        }).catch(err => console.error('Tracking error:', err));
    }

    // 1) إرسال session_start (عند فتح الموقع لأول مرة في التبويب)
    if (isNewSession) {
        sendTrackRequest('session_start');
    } else {
        // إذا كانت نفس الجلسة لكن المستخدم عمل Refresh أو عاد للتبويب، نسجلها كتنقل
        sendTrackRequest('page_change', { page: window.location.pathname });
    }

    // 2) تتبع التمرير محلياً فقط (لا نرسل.scroll للسيرفر)
    window.addEventListener('scroll', () => {
        const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
        if (scrollHeight <= 0) return;
        const currentScroll = Math.round((window.scrollY / scrollHeight) * 100);
        if (currentScroll > maxScroll) maxScroll = currentScroll;
    }, { passive: true });

    // 3) إرسال بيانات الخروج (exit) مع مدة الصفحة وأقصى تمرير
    window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            const durationSec = Math.round((Date.now() - startTime) / 1000);
            // استخدام sendBeacon لضمان الإرسال قبل إغلاق الصفحة
            const body = new Blob([JSON.stringify({
                ...trackingData,
                event_type: 'exit',
                duration_sec: durationSec,
                scroll_pct: maxScroll,
                exit_page: window.location.pathname
            })], { type: 'application/json' });

            if (navigator.sendBeacon) {
                navigator.sendBeacon(API_TRACK, body);
            } else {
                sendTrackRequest('exit', { duration_sec: durationSec, scroll_pct: maxScroll, exit_page: window.location.pathname });
            }
        }
    });

    // تصدير الدوال لملف main.js
    window.DentalTracking = { uid, sessionId, sendTrackRequest };

})();