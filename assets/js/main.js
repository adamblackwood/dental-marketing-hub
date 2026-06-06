// assets/js/main.js

const SiteController = {
  fingerprint: null,
  sessionId: null,

  init() {
    this.fingerprint = localStorage.getItem('dmr_fp');
    this.sessionId = sessionStorage.getItem('dmr_session');
    
    if (!this.fingerprint || !this.sessionId) {
      // إذا لم يتم تحميل التتبع بعد، ننتظر قليلاً
      setTimeout(() => this.init(), 500);
      return;
    }

    this.setupSmartForms();
    this.setupAffiliateLinks();
    this.setupExitIntent();
  },

  async setupSmartForms() {
    const form = document.getElementById('smart-lead-form');
    if (!form) return;

    try {
      const res = await fetch(`/api/profile-status?fp=${this.fingerprint}`);
      if (!res.ok) throw new Error('Failed to fetch profile status');
      const data = await res.json();

      const emailGroup = document.getElementById('group-email');
      const nameGroup = document.getElementById('group-name');
      const advGroup = document.getElementById('group-advanced');

      if (data.is_known) {
        // زائر معروف - إخفاء الإيميل والاسم
        if (emailGroup) emailGroup.style.display = 'none';
        if (nameGroup) nameGroup.style.display = 'none';
        
        const emailInput = document.getElementById('input-email');
        if (emailInput) emailInput.value = 'known_visitor'; // قيمة وهمية لتجاوز الـ Validation

        // عرض الحقول المتقدمة المفقودة فقط
        if (advGroup) advGroup.style.display = 'block';
        if (!data.missing_fields.includes('clinic_size')) {
          const g = document.getElementById('group-clinic-size');
          if(g) g.style.display = 'none';
        }
        if (!data.missing_fields.includes('biggest_challenge')) {
          const g = document.getElementById('group-challenge');
          if(g) g.style.display = 'none';
        }
      } else {
        // زائر جديد - عرض الإيميل والاسم وإخفاء المتقدم
        if (advGroup) advGroup.style.display = 'none';
      }

      form.addEventListener('submit', (e) => this.handleFormSubmit(e));
    } catch (error) {
      console.error('Profile Status Error:', error);
    }
  },

  async handleFormSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    
    const payload = {
      fingerprint_id: this.fingerprint,
      email: formData.get('email') !== 'known_visitor' ? formData.get('email') : null,
      name: formData.get('name') || null,
      clinic_size: formData.get('clinic_size') || null,
      biggest_challenge: formData.get('biggest_challenge') || null,
      phone_number: formData.get('phone_number') || null
    };

    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (result.success && result.redirect) {
        window.location.href = result.redirect;
      }
    } catch (error) {
      console.error('Form submission error:', error);
    }
  },

  setupAffiliateLinks() {
    // التقاط جميع روابط الأفلييت (التي تشير إلى /api/go)
    document.querySelectorAll('a[href*="/api/go"]').forEach(link => {
      link.addEventListener('click', (e) => {
        const originalHref = link.getAttribute('href');
        const url = new URL(originalHref, window.location.origin);
        
        // إلحاق معرفات التتبع الأساسية
        url.searchParams.set('fp', this.fingerprint);
        url.searchParams.set('sid', this.sessionId);
        
        // تحديث الرابط في اللحظة التي يضغط فيها الزائر
        link.setAttribute('href', url.toString());
      });
    });
  },

  setupExitIntent() {
    let exitShown = false;
    document.addEventListener('mouseout', (e) => {
      if (e.clientY < 5 && !exitShown) {
        const modal = document.getElementById('exit-intent-modal');
        if (modal) {
          modal.style.display = 'flex';
          exitShown = true;
        }
      }
    });
  }
};

document.addEventListener('DOMContentLoaded', () => SiteController.init());