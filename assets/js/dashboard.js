// assets/js/dashboard.js
// منطق لوحة التحكم الرئيسي: جلب الزوار، إدارة النماذج (Add/Edit)، التفويض الديناميكي للأزرار (Event Delegation)، 
// وعرض رحلة العميل 360°.

const API_BASE = '/api/admin';

// =============================================
// 1) التهيئة والأدوات المساعدة (Initialization & Utilities)
// =============================================

document.addEventListener('DOMContentLoaded', () => {
    // التأكد من وجود الصلاحيات (بسيط)
    checkAuth();

    // ربط الأحداث الثابتة (Static Elements)
    initStaticListeners();

    // تفويض الأحداث للجداول الديناميكية (Event Delegation)
    initDelegatedListeners();

    // جلب البيانات الأولية
    fetchVisitors();
});

/** فحص وجود كوكي الأدمن (بسيط، الحماية الحقيقية في السيرفر) */
function checkAuth() {
    if (!document.cookie.includes('admin_session')) {
        window.location.href = '/admin/login.html';
    }
}

/** طلبات API موحدة مع إرسال الكوكيز */
async function apiRequest(endpoint, method = 'GET', body = null) {
    const options = {
        method,
        credentials: 'include', // إرسال HTTP-only Cookie
        headers: { 'Content-Type': 'application/json' }
    };
    if (body) options.body = JSON.stringify(body);

    try {
        const res = await fetch(`${API_BASE}${endpoint}`, options);
        if (res.status === 401) {
            window.location.href = '/admin/login.html';
            return null;
        }
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `Request failed with status ${res.status}`);
        }
        if (res.status === 204) return true; // No Content (للحذف)
        return await res.json();
    } catch (err) {
        console.error(`API Error [${method} ${endpoint}]:`, err.message);
        alert(`خطأ: ${err.message}`);
        return null;
    }
}

// =============================================
// 2) ربط الأحداث (Event Listeners)
// =============================================

function initStaticListeners() {
    // زر فتح نافذة إضافة زائر جديد
    const addVisitorBtn = document.getElementById('addVisitorBtn');
    const visitorModal = document.getElementById('visitorModal');
    const closeVisitorModal = document.getElementById('closeVisitorModal');
    const visitorForm = document.getElementById('visitorForm');

    if (addVisitorBtn) {
        addVisitorBtn.addEventListener('click', () => {
            // مسح الحقول قبل الفتح
            if (visitorForm) visitorForm.reset();
            document.getElementById('visitorUid').value = ''; // التأكد من أن الـ UID فارغ للإضافة
            openModal(visitorModal);
        });
    }

    if (closeVisitorModal) {
        closeVisitorModal.addEventListener('click', () => closeModal(visitorModal));
    }

    if (visitorForm) {
        visitorForm.addEventListener('submit', handleVisitorFormSubmit);
    }

    // أحداث نافذة الـ Journey
    const journeyModal = document.getElementById('journeyModal');
    const closeJourneyModal = document.getElementById('closeJourneyModal');

    if (closeJourneyModal) {
        closeJourneyModal.addEventListener('click', () => closeModal(journeyModal));
    }
}

function initDelegatedListeners() {
    const visitorsTableBody = document.getElementById('visitorsTableBody');

    if (visitorsTableBody) {
        // تفويض الحدث للعنصر الأب الثابت لالتقاط النقر على الأزرار الديناميكية
        visitorsTableBody.addEventListener('click', (e) => {
            const target = e.target;

            // زر رحلة العميل 360°
            const journeyBtn = target.closest('.journey-btn');
            if (journeyBtn) {
                const uid = journeyBtn.dataset.uid;
                if (uid) openJourneyModal(uid);
                return;
            }

            // زر تعديل الزائر
            const editBtn = target.closest('.edit-btn');
            if (editBtn) {
                const uid = editBtn.dataset.uid;
                if (uid) loadVisitorForEdit(uid);
                return;
            }

            // زر حذف الزائر
            const deleteBtn = target.closest('.delete-btn');
            if (deleteBtn) {
                const uid = deleteBtn.dataset.uid;
                if (uid) deleteVisitor(uid);
                return;
            }
        });
    }
}

// =============================================
// 3) إدارة النوافذ المنبثقة (Modals)
// =============================================

function openModal(modalElement) {
    if (modalElement) {
        modalElement.classList.remove('hidden');
        modalElement.classList.add('flex');
    }
}

function closeModal(modalElement) {
    if (modalElement) {
        modalElement.classList.add('hidden');
        modalElement.classList.remove('flex');
    }
}

// =============================================
// 4) الزوار CRUD Operations
// =============================================

let allVisitors = []; // تخزين مؤقت للبيانات لتسريع البحث/التعديل

async function fetchVisitors() {
    const data = await apiRequest('/visitors');
    if (data && Array.isArray(data)) {
        allVisitors = data;
        renderVisitorsTable(data);
    }
}

function renderVisitorsTable(visitors) {
    const tbody = document.getElementById('visitorsTableBody');
    if (!tbody) return;

    if (visitors.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-gray-400">لا يوجد زوار بعد</td></tr>`;
        return;
    }

    tbody.innerHTML = visitors.map(v => `
        <tr class="border-b border-gray-700 hover:bg-gray-800 transition-colors">
            <td class="px-4 py-3 text-sm text-gray-300 font-mono">${v.uid.substring(0, 8)}...</td>
            <td class="px-4 py-3 text-sm text-white">${v.identified_name || '<span class="text-gray-500">مجهول</span>'}</td>
            <td class="px-4 py-3 text-sm text-gray-300">${v.identified_email || '-'}</td>
            <td class="px-4 py-3 text-sm">
                <span class="px-2 py-1 rounded text-xs font-bold ${
                    v.lead_status === 'hot' ? 'bg-red-900 text-red-200' :
                    v.lead_status === 'warm' ? 'bg-yellow-900 text-yellow-200' :
                    'bg-blue-900 text-blue-200'
                }">${v.lead_status || 'cold'}</span>
            </td>
            <td class="px-4 py-3 text-sm text-gray-300 text-center">${v.total_visits || 0}</td>
            <td class="px-4 py-3 text-sm text-gray-300 text-center">${v.total_conversions || 0}</td>
            <td class="px-4 py-3 text-sm flex gap-2">
                <button class="journey-btn bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-1 rounded text-xs" data-uid="${v.uid}">360°</button>
                <button class="edit-btn bg-gray-600 hover:bg-gray-700 text-white px-2 py-1 rounded text-xs" data-uid="${v.uid}">تعديل</button>
                <button class="delete-btn bg-red-700 hover:bg-red-800 text-white px-2 py-1 rounded text-xs" data-uid="${v.uid}">حذف</button>
            </td>
        </tr>
    `).join('');
}

async function loadVisitorForEdit(uid) {
    const visitor = allVisitors.find(v => v.uid === uid);
    if (!visitor) return;

    document.getElementById('visitorUid').value = visitor.uid;
    document.getElementById('identified_name').value = visitor.identified_name || '';
    document.getElementById('identified_email').value = visitor.identified_email || '';
    document.getElementById('phone_number').value = visitor.phone_number || '';
    document.getElementById('lead_status').value = visitor.lead_status || 'cold';

    openModal(document.getElementById('visitorModal'));
}

async function handleVisitorFormSubmit(e) {
    e.preventDefault();

    const uid = document.getElementById('visitorUid').value;
    const payload = {
        identified_name: document.getElementById('identified_name').value,
        identified_email: document.getElementById('identified_email').value,
        phone_number: document.getElementById('phone_number').value,
        lead_status: document.getElementById('lead_status').value,
        is_identified: true // بمجرد تعبئة البيانات يصبح معرفاً
    };

    let result;
    if (uid) {
        // تعديل (PATCH)
        result = await apiRequest(`/visitors/${uid}`, 'PATCH', payload);
    } else {
        // إضافة جديدة (POST) - نحتاج لتوليد UID
        payload.uid = crypto.randomUUID();
        payload.total_visits = 0;
        payload.total_conversions = 0;
        payload.lead_score = 0;
        result = await apiRequest('/visitors', 'POST', payload);
    }

    if (result) {
        closeModal(document.getElementById('visitorModal'));
        await fetchVisitors(); // تحديث الجدول
    }
}

async function deleteVisitor(uid) {
    if (!confirm('هل أنت متأكد من حذف هذا الزائر؟ سيتم حذف كل بياناته المرتبطة.')) return;
    const result = await apiRequest(`/visitors/${uid}`, 'DELETE');
    if (result) {
        await fetchVisitors();
    }
}

// =============================================
// 5) رحلة العميل 360° (Customer Journey)
// =============================================

async function openJourneyModal(uid) {
    const journeyModal = document.getElementById('journeyModal');
    const journeyContent = document.getElementById('journeyContent');
    
    if (!journeyModal || !journeyContent) return;

    journeyContent.innerHTML = `<div class="text-center text-gray-400 py-8">جاري تحميل بيانات الرحلة...</div>`;
    openModal(journeyModal);

    const data = await apiRequest(`/journey?uid=${uid}`);

    if (!data || data.error) {
        journeyContent.innerHTML = `<div class="text-center text-red-400 py-8">فشل في تحميل البيانات</div>`;
        return;
    }

    // دمج الأحداث زمنياً (Visitor Profile, Acquisitions, Sessions, Events)
    const timeline = [];

    // ملف الزائر
    if (data.profile) {
        timeline.push({
            date: data.profile.first_seen_at,
            type: 'profile_start',
            title: 'أول ظهور للزائر',
            details: `الحالة: ${data.profile.lead_status} | النقاط: ${data.profile.lead_score}`
        });
    }

    // الحملات والمصادر
    if (data.acquisitions && data.acquisitions.length > 0) {
        data.acquisitions.forEach(acq => {
            timeline.push({
                date: acq.first_visit_at,
                type: 'acquisition',
                title: `مصدر زيارة: ${acq.source || 'مباشر'}`,
                details: `الحملة: ${acq.utm_campaign || 'لا يوجد'} | المدينة: ${acq.city || 'غير معروفة'}`
            });
        });
    }

    // الجلسات
    if (data.sessions && data.sessions.length > 0) {
        data.sessions.forEach(ses => {
            timeline.push({
                date: ses.started_at,
                type: 'session',
                title: `جلسة تصفح (${ses.device_type || 'غير معروف'})`,
                details: `المدة: ${ses.duration_sec || 0}ث | التمرير: ${ses.max_scroll_pct || 0}% | ارتداد: ${ses.is_bounce ? 'نعم' : 'لا'}`
            });
        });
    }

    // الأحداث الحرجة
    if (data.events && data.events.length > 0) {
        data.events.forEach(evt => {
            timeline.push({
                date: evt.created_at,
                type: 'event',
                title: `حدث: ${evt.event_type}`,
                details: `القيمة: ${evt.event_value || '-'}`
            });
        });
    }

    // ترتيب تنازلي (من الأحدث للأقدم)
    timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

    // عرض الـ Timeline
    if (timeline.length === 0) {
        journeyContent.innerHTML = `<div class="text-center text-gray-400 py-8">لا توجد بيانات كافية لعرض الرحلة</div>`;
        return;
    }

    journeyContent.innerHTML = `
        <div class="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            ${timeline.map(item => {
                const colorMap = { profile_start: 'blue', acquisition: 'purple', session: 'gray', event: 'green' };
                const color = colorMap[item.type] || 'gray';
                return `
                    <div class="flex items-start gap-3">
                        <div class="flex flex-col items-center">
                            <div class="w-3 h-3 rounded-full bg-${color}-500 mt-1.5"></div>
                            <div class="w-px h-full bg-gray-700"></div>
                        </div>
                        <div>
                            <p class="text-xs text-gray-500">${new Date(item.date).toLocaleString('en-US', { timeZone: 'America/New_York' })}</p>
                            <h4 class="text-sm font-bold text-white">${item.title}</h4>
                            <p class="text-xs text-gray-400 mt-1">${item.details}</p>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}