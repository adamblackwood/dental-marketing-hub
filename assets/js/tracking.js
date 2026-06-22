// assets/js/tracking.js
// مستشعر المتصفح: توليد UID، استخراج UTMs، إرسال session_start، 
// إرسال heartbeat محدود، تتبع scroll ذكي (Debounced)، وإرسال exit عبر sendBeacon.

(function() {
    const API_TRACK = '/api/track';
    const SESSION_KEY = 'dental_hub_session';
    const UID_KEY = 'dental_hub_uid';

    let uid = localStorage.getItem(UID_KEY);
    if (!uid) {
        uid = crypto.randomUUID();
        localStorage.setItem(UID_KEY, uid);
    }

    let sessionId = sessionStorage.getItem(SESSION_KEY);
    let isNewSession = false;

    if (!sessionId) {
        sessionId = crypto.randomUUID();
        sessionStorage.setItem(SESSION_KEY, sessionId);
        isNewSession = true;
    }

    // استخراج UTMs من الرابط
    const urlParams = new URLSearchParams(window.location.search);
    const getParam = (key) => urlParams.get(key) || null;

    // إذا كان الزائر قادماً من حملة إيميل بارد (رابط /api/p/[uid])
    if (getParam('identified')) {
        uid = getParam('identified');
        localStorage.setItem(UID_KEY, uid);
    }

    const trackingData = {
        uid: uid,
        session_id: sessionId,
        source: getParam('source') || document.referrer || 'direct',
        source_type: getParam('source_type') || 'organic',
        utm_source: getParam('utm_source'),
        utm_campaign: getParam('utm_campaign'),
        landing_page: window.location.pathname,
        fingerprint_id: navigator.userAgent, // مبسط لتجنب مكتبات خارجية
        device_type: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : (/Tablet|iPad/i.test(navigator.userAgent) ? 'tablet' : 'desktop'),
        browser: detectBrowser(),
        operating_system: detectOS()
    };

    function detectBrowser() {
        if (navigator.userAgent.includes("Firefox")) return "Firefox";
        if (navigator.userAgent.includes("Edg")) return "Edge";
        if (navigator.userAgent.includes("Chrome")) return "Chrome";
        if (navigator.userAgent.includes("Safari")) return "Safari";
        return "Unknown";
    }

    function detectOS() {
        if (navigator.userAgent.includes("Windows")) return "Windows";
        if (navigator.userAgent.includes("Mac OS")) return "MacOS";
        if (navigator.userAgent.includes("Linux")) return "Linux";
        if (navigator.userAgent.includes("Android")) return "Android";
        if (navigator.userAgent.includes("iOS") || navigator.userAgent.includes("iPhone")) return "iOS";
        return "Unknown";
    }

    function sendTrackRequest(eventType, payload = {}) {
        const body = { ...trackingData, ...payload, event_type: eventType };
        fetch(API_TRACK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            keepalive: true // يضمن الإرسال حتى عند إغلاق الصفحة
        }).catch(err => console.error('Tracking error:', err));
    }

    // 1) إرسال session_start
    if (isNewSession) {
        sendTrackRequest('session_start');
    }

    // 2) نبضات القلب (Heartbeat) - كل 30 ثانية
    setInterval(() => {
        sendTrackRequest('heartbeat');
    }, 30000);

    // 3) تتبع التمرير (Scroll) ذكي - لا نرسل كل بكسل، فقط عند النسب المحددة
    const scrollMilestones = [25, 50, 75, 100];
    let reachedMilestones = new Set();

    function checkScrollDepth() {
        const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
        if (scrollHeight <= 0) return;
        const currentScroll = Math.round((window.scrollY / scrollHeight) * 100);

        scrollMilestones.forEach(milestone => {
            if (currentScroll >= milestone && !reachedMilestones.has(milestone)) {
                reachedMilestones.add(milestone);
                sendTrackRequest('scroll', { scroll_pct: milestone });
            }
        });
    }

    let scrollTimeout;
    window.addEventListener('scroll', () => {
        if (scrollTimeout) clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(checkScrollDepth, 200); // Debounce 200ms
    }, { passive: true });

    // 4) حدث الخروج (Exit) - عند إغلاق التبويب أو الانتقال لصفحة أخرى
    let startTime = Date.now();

    window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            const durationSec = Math.round((Date.now() - startTime) / 1000);
            const maxScroll = reachedMilestones.size > 0 ? Math.max(...reachedMilestones) : 0;
            
            // استخدام sendBeacon لضمان الإرسال قبل موت الصفحة
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
                // Fallback if sendBeacon is not supported
                sendTrackRequest('exit', { duration_sec: durationSec, scroll_pct: maxScroll, exit_page: window.location.pathname });
            }
        }
    });

    // تصدير المتغيرات لملف main.js
    window.DentalTracking = { uid, sessionId, sendTrackRequest };

})();