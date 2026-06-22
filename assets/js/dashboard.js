// assets/js/dashboard.js
// منطق لوحة التحكم الرئيسي: مصادقة الأدمن، إدارة الزوار (CRUD)، عارض البيانات الخام، 
// وعرض رحلة العميل 360° مع تفويض الأحداث (Event Delegation).

const API_BASE = '/api/admin';
const PK_MAP = {
    visitor_profiles: 'uid',
    acquisitions: 'acquisition_id',
    visits: 'visit_id',
    sessions: 'session_id',
    email_activities: 'email_activity_id',
    events: 'event_id'
};

// =============================================
// 1) المصادقة والتهيئة (Auth & Initialization)
// =============================================

function checkAuth() {
    const isAuthenticated = document.cookie.includes('admin_session');
    // إصلاح خطأ التوجيه اللانهائي: البحث عن كلمة 'login' فقط لتتوافق مع الروابط النظيفة لـ Cloudflare
    const isLoginPage = window.location.pathname.includes('/login');

    if (!isAuthenticated && !isLoginPage) {
        // إذا لم يكن مسجل الدخول ولم يكن في صفحة الدخول، اذهب لصفحة الدخول
        window.location.href = '/admin/login.html';
    } else if (isAuthenticated && isLoginPage) {
        // إذا كان مسجل الدخول بالفعل وحاول فتح صفحة الدخول، وجهه للوحة التحكم مباشرة
        window.location.href = '/admin/dashboard.html';
    }
}

function initLogin() {
    const loginForm = document.getElementById('loginForm');
    if (!loginForm) return;

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = document.getElementById('password').value;
        const loginError = document.getElementById('loginError');
        loginError.style.display = 'none';

        try {
            const res = await fetch(`${API_BASE}/auth`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });

            if (res.ok) {
                window.location.href = '/admin/dashboard.html';
            } else {
                loginError.style.display = 'block';
                loginError.textContent = 'Invalid password. Please try again.';
            }
        } catch (err) {
            loginError.style.display = 'block';
            loginError.textContent = 'Network error. Please try again.';
        }
    });
}

function initLogout() {
    const logoutBtn = document.getElementById('logoutBtn') || document.getElementById('logoutBtnData');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await fetch(`${API_BASE}/auth`, { method: 'DELETE' });
            window.location.href = '/admin/login.html';
        });
    }
}

// =============================================
// 2) منطق لوحة التحكم الرئيسية (Dashboard Page Logic)
// =============================================

let allVisitors = [];

function initDashboard() {
    fetchAnalytics();
    fetchVisitors();
    initDashboardEvents();
}

async function fetchAnalytics() {
    const data = await apiRequest('/analytics');
    if (data) {
        document.getElementById('kpiVisitors').textContent = data.total_visitors || 0;
        document.getElementById('kpiHotLeads').textContent = data.hot_leads || 0;
        document.getElementById('kpiConversions').textContent = data.total_conversions || 0;
        document.getElementById('kpiSessions').textContent = data.total_sessions || 0;
    }
}

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
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-secondary);">No visitors found</td></tr>`;
        return;
    }

    tbody.innerHTML = visitors.map(v => `
        <tr>
            <td style="font-family: monospace; font-size: 0.8rem;">${v.uid.substring(0, 8)}...</td>
            <td>${v.identified_name || '<span style="color:var(--text-secondary)">Unknown</span>'}</td>
            <td>${v.identified_email || '-'}</td>
            <td><span class="badge badge-${v.lead_status || 'cold'}">${v.lead_status || 'cold'}</span></td>
            <td>${v.total_visits || 0}</td>
            <td>${v.total_conversions || 0}</td>
            <td style="display: flex; gap: 0.5rem;">
                <button class="btn btn-indigo btn-sm journey-btn" data-uid="${v.uid}">360°</button>
                <button class="btn btn-ghost btn-sm edit-btn" data-uid="${v.uid}">Edit</button>
                <button class="btn btn-danger btn-sm delete-btn" data-uid="${v.uid}">Del</button>
            </td>
        </tr>
    `).join('');
}

function initDashboardEvents() {
    const tbody = document.getElementById('visitorsTableBody');
    const addVisitorBtn = document.getElementById('addVisitorBtn');
    const visitorModal = document.getElementById('visitorModal');
    const journeyModal = document.getElementById('journeyModal');

    // تفويض الأحداث للجدول الديناميكي (Event Delegation)
    if (tbody) {
        tbody.addEventListener('click', async (e) => {
            const target = e.target;

            if (target.closest('.journey-btn')) {
                const uid = target.closest('.journey-btn').dataset.uid;
                await openJourneyModal(uid);
            } 
            else if (target.closest('.edit-btn')) {
                const uid = target.closest('.edit-btn').dataset.uid;
                const visitor = allVisitors.find(v => v.uid === uid);
                if (visitor) openEditVisitorModal(visitor);
            }
            else if (target.closest('.delete-btn')) {
                const uid = target.closest('.delete-btn').dataset.uid;
                if (confirm('Are you sure you want to delete this visitor and all related data?')) {
                    await apiRequest(`/visitors/${uid}`, 'DELETE');
                    await fetchVisitors();
                    await fetchAnalytics();
                }
            }
        });
    }

    // فتح نافذة إضافة زائر
    if (addVisitorBtn) {
        addVisitorBtn.addEventListener('click', () => {
            document.getElementById('visitorForm').reset();
            document.getElementById('visitorUid').value = '';
            document.getElementById('visitorModalTitle').textContent = 'Add Visitor';
            openModal(visitorModal);
        });
    }

    // إغلاق النوافذ
    document.getElementById('closeVisitorModal')?.addEventListener('click', () => closeModal(visitorModal));
    document.getElementById('closeJourneyModal')?.addEventListener('click', () => closeModal(journeyModal));

    // حفظ بيانات الزائر (إضافة أو تعديل)
    document.getElementById('visitorForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const uid = document.getElementById('visitorUid').value;
        const payload = {
            identified_name: document.getElementById('identified_name').value,
            identified_email: document.getElementById('identified_email').value,
            phone_number: document.getElementById('phone_number').value,
            lead_status: document.getElementById('lead_status').value,
            is_identified: true
        };

        if (uid) {
            await apiRequest(`/visitors/${uid}`, 'PATCH', payload);
        } else {
            payload.uid = crypto.randomUUID();
            payload.total_visits = 0; payload.total_conversions = 0; payload.lead_score = 0;
            await apiRequest('/visitors', 'POST', payload);
        }
        
        closeModal(visitorModal);
        await fetchVisitors();
        await fetchAnalytics();
    });
}

function openEditVisitorModal(visitor) {
    document.getElementById('visitorUid').value = visitor.uid;
    document.getElementById('identified_name').value = visitor.identified_name || '';
    document.getElementById('identified_email').value = visitor.identified_email || '';
    document.getElementById('phone_number').value = visitor.phone_number || '';
    document.getElementById('lead_status').value = visitor.lead_status || 'cold';
    document.getElementById('visitorModalTitle').textContent = 'Edit Visitor';
    openModal(document.getElementById('visitorModal'));
}

async function openJourneyModal(uid) {
    const journeyContent = document.getElementById('journeyContent');
    journeyContent.innerHTML = '<p>Loading journey...</p>';
    openModal(document.getElementById('journeyModal'));

    const data = await apiRequest(`/journey?uid=${uid}`);
    if (!data || !data.profile) {
        journeyContent.innerHTML = '<p>Could not load journey data.</p>';
        return;
    }

    let html = `<h3 style="margin-bottom:1rem;">Profile: ${data.profile.identified_email || uid}</h3>`;
    
    html += '<div style="margin-bottom:1.5rem;"><h4 style="color:var(--text-secondary); margin-bottom:0.5rem;">Acquisitions</h4>';
    if (data.acquisitions.length === 0) html += '<p style="color:var(--text-secondary)">No acquisition data.</p>';
    data.acquisitions.forEach(a => { html += `<div class="kpi-card" style="padding:0.5rem; margin-bottom:0.5rem;">Source: ${a.source} | Campaign: ${a.utm_campaign || 'N/A'}</div>`; });
    html += '</div>';

    html += '<div style="margin-bottom:1.5rem;"><h4 style="color:var(--text-secondary); margin-bottom:0.5rem;">Events (Conversions & Opens)</h4>';
    if (data.events.length === 0) html += '<p style="color:var(--text-secondary)">No events recorded.</p>';
    data.events.forEach(ev => { html += `<div class="kpi-card" style="padding:0.5rem; margin-bottom:0.5rem;">${ev.event_type} <span style="color:var(--text-secondary);">(${ev.event_value || ''})</span> - ${new Date(ev.created_at).toLocaleString()}</div>`; });
    html += '</div>';

    journeyContent.innerHTML = html;
}


// =============================================
// 3) منطق عارض البيانات الخام (Raw Data Viewer Page Logic)
// =============================================

let dataViewerState = { currentTable: 'visitor_profiles', currentPage: 1, totalPages: 1, data: [] };

function initDataViewer() {
    initDataViewerEvents();
    fetchRawData();
}

function initDataViewerEvents() {
    // التبديل بين التبويبات (Sidebar Tabs)
    document.querySelectorAll('.sidebar-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelector('.sidebar-btn.active')?.classList.remove('active');
            e.target.classList.add('active');
            dataViewerState.currentTable = e.target.dataset.table;
            dataViewerState.currentPage = 1;
            fetchRawData();
        });
    });

    // أزرار الصفحات (Pagination)
    document.getElementById('prevBtn')?.addEventListener('click', () => {
        if (dataViewerState.currentPage > 1) { dataViewerState.currentPage--; fetchRawData(); }
    });
    document.getElementById('nextBtn')?.addEventListener('click', () => {
        if (dataViewerState.currentPage < dataViewerState.totalPages) { dataViewerState.currentPage++; fetchRawData(); }
    });

    // تفويض الأحداث لأزرار التعديل والحذف (Event Delegation)
    document.getElementById('tableBody')?.addEventListener('click', async (e) => {
        const target = e.target;
        if (target.closest('.raw-edit-btn')) {
            const id = target.closest('.raw-edit-btn').dataset.id;
            const pk = target.closest('.raw-edit-btn').dataset.pk;
            const row = dataViewerState.data.find(r => r[pk] == id);
            if (row) openRawEditModal(row, pk);
        }
        else if (target.closest('.raw-delete-btn')) {
            const id = target.closest('.raw-delete-btn').dataset.id;
            if (confirm('Delete this record permanently?')) {
                await apiRequest(`/raw-data?table=${dataViewerState.currentTable}&id=${id}`, 'DELETE');
                await fetchRawData();
            }
        }
    });

    // إغلاق وحفظ نافذة التعديل
    document.getElementById('closeEditModal')?.addEventListener('click', () => closeModal(document.getElementById('editModal')));
    document.getElementById('editForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('editRecordId').value;
        const table = document.getElementById('editTableName').value;
        const pk = document.getElementById('editPkName').value;
        
        const payload = {};
        const inputs = document.querySelectorAll('#formFields input, #formFields select');
        inputs.forEach(inp => { if (inp.name !== pk) payload[inp.name] = inp.value; });

        await apiRequest(`/raw-data?table=${table}&id=${id}`, 'PATCH', payload);
        closeModal(document.getElementById('editModal'));
        await fetchRawData();
    });
}

async function fetchRawData() {
    const tbody = document.getElementById('tableBody');
    const thead = document.getElementById('tableHead');
    if (!tbody || !thead) return;

    tbody.innerHTML = `<tr><td colspan="20" style="text-align:center; padding:2rem; color:var(--text-secondary);">Loading...</td></tr>`;

    const result = await apiRequest(`/raw-data?table=${dataViewerState.currentTable}&page=${dataViewerState.currentPage}`);
    
    if (result && result.data) {
        dataViewerState.data = result.data;
        dataViewerState.totalPages = result.pagination.totalPages;
        
        document.getElementById('pageInfo').textContent = `Page ${result.pagination.currentPage} of ${result.pagination.totalPages || 1}`;
        document.getElementById('prevBtn').disabled = result.pagination.currentPage <= 1;
        document.getElementById('nextBtn').disabled = result.pagination.currentPage >= result.pagination.totalPages;

        if (result.data.length === 0) {
            thead.innerHTML = ''; 
            tbody.innerHTML = `<tr><td colspan="20" style="text-align:center; padding:2rem; color:var(--text-secondary);">No data found</td></tr>`;
            return;
        }

        const columns = Object.keys(result.data[0]);
        const pk = PK_MAP[dataViewerState.currentTable];

        thead.innerHTML = `<tr>${columns.map(c => `<th>${c}</th>`).join('')}<th>Actions</th></tr>`;
        tbody.innerHTML = result.data.map(row => {
            const rowId = row[pk];
            const cells = columns.map(col => {
                let val = row[col];
                if (val === null || val === undefined) val = '-';
                if (typeof val === 'string' && val.length > 35) val = val.substring(0, 35) + '...';
                if (typeof val === 'object') val = JSON.stringify(val);
                return `<td title="${row[col]}">${val}</td>`;
            }).join('');
            return `<tr>${cells}<td><button class="btn btn-ghost btn-sm raw-edit-btn" data-id="${rowId}" data-pk="${pk}">Edit</button> <button class="btn btn-danger btn-sm raw-delete-btn" data-id="${rowId}">Del</button></td></tr>`;
        }).join('');
    }
}

function openRawEditModal(rowData, pk) {
    document.getElementById('editRecordId').value = rowData[pk];
    document.getElementById('editTableName').value = dataViewerState.currentTable;
    document.getElementById('editPkName').value = pk;
    document.getElementById('modalTitle').innerText = `Edit Record (${pk}: ${rowData[pk]})`;

    const formFields = document.getElementById('formFields');
    formFields.innerHTML = '';

    Object.keys(rowData).forEach(col => {
        let val = rowData[col];
        if (val === null || val === undefined) val = '';
        if (typeof val === 'object') val = JSON.stringify(val);
        const isDisabled = col === pk ? 'disabled' : '';
        
        formFields.innerHTML += `
            <div class="form-group">
                <label>${col}</label>
                <input type="text" name="${col}" class="form-input" value="${val}" ${isDisabled}>
            </div>
        `;
    });

    openModal(document.getElementById('editModal'));
}


// =============================================
// 4) الأدوات المساعدة العامة (Global Utilities)
// =============================================

async function apiRequest(endpoint, method = 'GET', body = null) {
    const options = { method, credentials: 'include', headers: { 'Content-Type': 'application/json' } };
    if (body) options.body = JSON.stringify(body);

    try {
        const res = await fetch(`${API_BASE}${endpoint}`, options);
        if (res.status === 401) { window.location.href = '/admin/login.html'; return null; }
        if (res.status === 204) return true; // DELETE success
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'API Error');
        return data;
    } catch (err) {
        console.error(`API Error [${method} ${endpoint}]:`, err);
        alert(`Error: ${err.message}`);
        return null;
    }
}

function openModal(modalElement) { if (modalElement) modalElement.classList.add('active'); }
function closeModal(modalElement) { if (modalElement) modalElement.classList.remove('active'); }


// =============================================
// 5) محرك التشغيل الرئيسي (Bootstrapper)
// =============================================

document.addEventListener('DOMContentLoaded', () => {
    checkAuth(); // التحقق من الصلاحيات أولاً
    initLogout();

    // تشغيل المنطق بناءً على الصفحة التي نحن فيها
    if (document.getElementById('loginForm')) {
        initLogin();
    } 
    else if (document.getElementById('dashboardPage')) {
        initDashboard();
    } 
    else if (document.getElementById('dataViewerPage')) {
        initDataViewer();
    }
});