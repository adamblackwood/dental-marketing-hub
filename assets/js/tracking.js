// assets/js/tracking.js

const TrackingEngine = {
  API_ENDPOINT: '/api/track',
  HEARTBEAT_INTERVAL: 5000,
  
  uid: null,
  sessionId: null,
  sessionStartTime: null,
  maxScroll: 0,
  utms: {},
  scrollThresholds: [25, 50, 75, 100],
  reportedScrolls: new Set(),

  init() {
    // 1. توليد أو استخراج الـ UID (المعرف الأساسي للزائر)
    this.uid = localStorage.getItem('dmr_uid');
    if (!this.uid) {
      this.uid = 'uid_' + crypto.randomUUID().replace(/-/g, '').substring(0, 12);
      localStorage.setItem('dmr_uid', this.uid);
    }

    // 2. معالجة الـ UID القادم من حملات الإيميل البارد (ABM Merge)
    const urlParams = new URLSearchParams(window.location.search);
    const identifiedUid = urlParams.get('identified');
    if (identifiedUid) {
      this.uid = identifiedUid; // استبدال البصمة المؤقتة بالبصمة المعروفة
      localStorage.setItem('dmr_uid', identifiedUid);
      urlParams.delete('identified');
      const cleanUrl = urlParams.toString() ? `${window.location.pathname}?${urlParams.toString()}` : window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }

    // 3. توليد معرف الجلسة (Session ID)
    this.sessionId = 'sess_' + crypto.randomUUID().replace(/-/g, '');
    sessionStorage.setItem('dmr_session', this.sessionId);

    // 4. استخراج UTMs
    ['utm_source', 'utm_campaign', 'utm_medium', 'utm_term', 'utm_content'].forEach(param => {
      const val = urlParams.get(param);
      if (val) this.utms[param] = val;
    });

    // 5. بدء التتبع
    this.sessionStartTime = Date.now();
    this.sendData('session_start', {
      entry_page: window.location.pathname,
      utm_source: this.utms.utm_source || null,
      utm_campaign: this.utms.utm_campaign || null
    });

    this.setupHeartbeat();
    this.setupScrollTracking();
    this.setupExitTracking();
  },

  getDurationSec() {
    return Math.floor((Date.now() - this.sessionStartTime) / 1000);
  },

  sendData(type, extraData = {}) {
    const payload = {
      type: type,
      uid: this.uid, // إرسال الـ UID كمعرف أساسي
      session_id: this.sessionId,
      ...extraData
    };

    if (type === 'exit') {
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      navigator.sendBeacon(this.API_ENDPOINT, blob);
    } else {
      fetch(this.API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(err => console.error('Tracking Error:', err));
    }
  },

  setupHeartbeat() {
    setInterval(() => {
      this.sendData('heartbeat', { duration_sec: this.getDurationSec() });
    }, this.HEARTBEAT_INTERVAL);
  },

  setupScrollTracking() {
    window.addEventListener('scroll', () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollHeight <= 0) return;
      const currentScroll = Math.round((window.scrollY / scrollHeight) * 100);
      
      if (currentScroll > this.maxScroll) this.maxScroll = currentScroll;

      this.scrollThresholds.forEach(threshold => {
        if (this.maxScroll >= threshold && !this.reportedScrolls.has(threshold)) {
          this.reportedScrolls.add(threshold);
          this.sendData('scroll', { max_scroll_pct: this.maxScroll });
        }
      });
    }, { passive: true });
  },

  setupExitTracking() {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.sendData('exit', {
          duration_sec: this.getDurationSec(),
          max_scroll_pct: this.maxScroll,
          exit_page: window.location.pathname
        });
      }
    });
  }
};

document.addEventListener('DOMContentLoaded', () => TrackingEngine.init());