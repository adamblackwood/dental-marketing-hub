// assets/js/tracking.js

const TrackingEngine = {
  API_ENDPOINT: '/api/track',
  HEARTBEAT_INTERVAL: 5000,
  
  fingerprint: null,
  sessionId: null,
  sessionStartTime: null,
  maxScroll: 0,
  uid: null,
  utms: {},
  scrollThresholds: [25, 50, 75, 100],
  reportedScrolls: new Set(),

  init() {
    // توليد أو استخراج البصمة
    this.fingerprint = localStorage.getItem('dmr_fp');
    if (!this.fingerprint) {
      this.fingerprint = 'usr_' + crypto.randomUUID().replace(/-/g, '');
      localStorage.setItem('dmr_fp', this.fingerprint);
    }

    // توليد معرف الجلسة وتخزينه مؤقتاً لاستخدامه في روابط الأفلييت
    this.sessionId = 'sess_' + crypto.randomUUID().replace(/-/g, '');
    sessionStorage.setItem('dmr_session', this.sessionId);

    // استخراج الـ UID (للحملات الباردة ABM)
    const urlParams = new URLSearchParams(window.location.search);
    const identifiedUid = urlParams.get('identified');
    if (identifiedUid) {
      this.uid = identifiedUid;
      localStorage.setItem('dmr_uid', identifiedUid);
      urlParams.delete('identified');
      const cleanUrl = urlParams.toString() 
        ? `${window.location.pathname}?${urlParams.toString()}` 
        : window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    } else {
      this.uid = localStorage.getItem('dmr_uid') || null;
    }

    // استخراج UTMs
    ['utm_source', 'utm_campaign', 'utm_medium', 'utm_term', 'utm_content'].forEach(param => {
      const val = urlParams.get(param);
      if (val) this.utms[param] = val;
    });

    // بدء التتبع
    this.sessionStartTime = Date.now();
    this.sendData('session_start', {
      entry_page: window.location.pathname,
      utm_source: this.utms.utm_source || null,
      utm_campaign: this.utms.utm_campaign || null,
      uid: this.uid
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
      fingerprint_id: this.fingerprint,
      session_id: this.sessionId,
      ...extraData
    };

    // استخدام sendBeacon عند الخروج لضمان عدم حظر الطلب من المتصفح
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
    // visibilitychange هو المعيار الحديث الأكثر موثوقية مقارنة بـ beforeunload
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