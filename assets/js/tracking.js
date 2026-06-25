// assets/js/tracking.js
(function() {
    const TRACK_API = '/api/track';
    const urlParams = new URLSearchParams(window.location.search);

    // 1. UID & ABM Merge Logic
    let uid = localStorage.getItem('uid');
    const identifiedUid = urlParams.get('identified');
    if (identifiedUid) {
        uid = identifiedUid; // ABM Merge: overwrite local UID with identified one
        localStorage.setItem('uid', uid);
        // Clean URL
        urlParams.delete('identified');
        window.history.replaceState({}, document.title, window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : ''));
    }
    if (!uid) {
        uid = crypto.randomUUID();
        localStorage.setItem('uid', uid);
    }

    // 2. Session ID — جلسة UUID واحدة ثابتة لكل صفحة
    // نخزّن UUID لكل صفحة في localStorage بمفتاح يحمل مسار الصفحة،
    // فلا تتكرر الجلسة عند العودة لنفس الصفحة، والقيمة UUID صالحة لقاعدة البيانات.
    function getOrCreatePageSessionId(path) {
        const storageKey = `session_id_${path}`;
        let sid = localStorage.getItem(storageKey);
        if (!sid) {
            sid = crypto.randomUUID();
            localStorage.setItem(storageKey, sid);
        }
        return sid;
    }
    let sessionId = getOrCreatePageSessionId(window.location.pathname);

    // State
    let maxScroll = 0;
    let scrollThresholds = [25, 50, 75, 100];
    let triggeredThresholds = new Set();
    const startTime = Date.now();

    // Send Data Helpers
    function sendData(payload, useBeacon = false) {
        payload.uid = uid;
        payload.session_id = sessionId;
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });

        if (useBeacon && navigator.sendBeacon) {
            return navigator.sendBeacon(TRACK_API, blob);
        } else {
            return fetch(TRACK_API, {
                method: 'POST',
                body: blob,
                headers: { 'Content-Type': 'application/json' },
                keepalive: true
            });
        }
    }

    // 3. Session Start
    sendData({
        event_type: 'session_start',
        landing_page: window.location.pathname,
        device_type: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
    });

    // 4. Heartbeat (every 5 seconds)
    setInterval(() => {
        sendData({ event_type: 'heartbeat' });
    }, 5000);

    // 5. Scroll Tracking
    window.addEventListener('scroll', () => {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const scrollPct = (scrollTop / scrollHeight) * 100;

        if (scrollPct > maxScroll) {
            maxScroll = Math.round(scrollPct);
        }

        scrollThresholds.forEach(thresh => {
            if (scrollPct >= thresh && !triggeredThresholds.has(thresh)) {
                triggeredThresholds.add(thresh);
                sendData({ event_type: 'scroll', scroll: thresh });
            }
        });
    });

    // 6. Exit Tracking
    function handleExit() {
        const duration = Math.round((Date.now() - startTime) / 1000);
        sendData({
            event_type: 'exit',
            duration_sec: duration,
            max_scroll_pct: maxScroll,
            page: window.location.pathname
        }, true); // Force sendBeacon for exit
    }

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            handleExit();
        }
    });
    window.addEventListener('beforeunload', handleExit);

    // 7. Page Change (SPA pushState interception)
    const pushState = history.pushState;
    history.pushState = function() {
        pushState.apply(history, arguments);
        // عند تنقّل SPA: حدّث معرّف الجلسة ليطابق الصفحة الجديدة
        sessionId = getOrCreatePageSessionId(window.location.pathname);
        sendData({ event_type: 'session_start', landing_page: window.location.pathname,
            device_type: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop' });
        // Reset scroll tracking for new page
        maxScroll = 0;
        triggeredThresholds.clear();
    };
    window.addEventListener('popstate', () => {
        // العودة/التقدّم: حدّث معرّف الجلسة ليطابق الصفحة الحالية
        sessionId = getOrCreatePageSessionId(window.location.pathname);
        sendData({ event_type: 'session_start', landing_page: window.location.pathname,
            device_type: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop' });
        maxScroll = 0;
        triggeredThresholds.clear();
    });

    // Expose globally for main.js
    window.TrackingState = { uid, sessionId };
})();
