// assets/js/dashboard.js

const DashboardApp = {
  // عناصر الـ DOM
  elements: {
    viewToggle: document.getElementById('view-toggle'),
    analyticsView: document.getElementById('analytics-view'),
    dataView: document.getElementById('data-view'),
    labelData: document.getElementById('label-data'),
    labelAnalytics: document.getElementById('label-analytics'),
    logoutBtn: document.getElementById('logout-btn'),
    tabs: document.querySelectorAll('.tab-btn'),
    modalOverlay: document.getElementById('modal-overlay'),
    closeModalBtn: document.getElementById('close-modal-btn'),
    cancelModalBtn: document.getElementById('cancel-modal-btn'),
    modalForm: document.getElementById('modal-form')
  },

  init() {
    // 1. التحقق من تسجيل الدخول (إذا لم تكن هناك Cookie، يتم طرده لصفحة الدخول)
    // ملاحظة: الـ HttpOnly Cookie لا يمكن قراءتها بـ JS، لكننا نعتمد على أن السيرفر سيرفض طلبات الـ API لاحقاً إذا لم تكن موجودة.
    
    this.setupEventListeners();
  },

  setupEventListeners() {
    // تبديل الوضعية (Analytics / Data)
    this.elements.viewToggle.addEventListener('change', (e) => {
      const isAnalytics = e.target.checked;
      this.elements.analyticsView.classList.toggle('hidden', !isAnalytics);
      this.elements.dataView.classList.toggle('hidden', isAnalytics);
      this.elements.labelData.classList.toggle('active', !isAnalytics);
      this.elements.labelAnalytics.classList.toggle('active', isAnalytics);
      
      if (isAnalytics) {
        // سيتم استدعاء دالة جلب التحليلات هنا لاحقاً
        console.log("Switched to Analytics Mode");
      } else {
        // سيتم استدعاء دالة جلب البيانات هنا لاحقاً
        console.log("Switched to Data Management Mode");
      }
    });

    // التبديل بين التبويبات (Visitors, Sessions, Events)
    this.elements.tabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        this.elements.tabs.forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        const target = e.target.dataset.target;
        // سيتم استدعاء دالة جلب بيانات الجدول المحدد هنا لاحقاً
        console.log(`Switched to tab: ${target}`);
      });
    });

    // تسجيل الخروج
    this.elements.logoutBtn.addEventListener('click', async () => {
      await fetch('/api/admin/auth', { method: 'DELETE' });
      window.location.href = '/admin/login.html';
    });

    // إغلاق الـ Modal
    const closeActions = [this.elements.closeModalBtn, this.elements.cancelModalBtn];
    closeActions.forEach(btn => {
      btn.addEventListener('click', () => {
        this.elements.modalOverlay.classList.add('hidden');
      });
    });

    // إرسال بيانات الـ Modal
    this.elements.modalForm.addEventListener('submit', (e) => {
      e.preventDefault();
      // سيتم إضافة منطق الـ CRUD هنا لاحقاً
      console.log("Modal Form Submitted");
      this.elements.modalOverlay.classList.add('hidden');
    });
  }
};

// بدء التطبيق
document.addEventListener('DOMContentLoaded', () => DashboardApp.init());