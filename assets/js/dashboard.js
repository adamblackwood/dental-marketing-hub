// assets/js/dashboard.js
// منطق لوحة التحكم الرئيسي V4.0 - يدعم Visit Journeys والجداول السبعة

const API_BASE = '/api/admin';
const PK_MAP = {
    visitor_profiles: 'uid', acquisitions: 'acquisition_id', visits: 'visit_id',
    sessions: 'session_id', visit_journeys: 'visit_id', email_activities: 'email_activity_id', events: 'event_id'
};

// =============================================
// 1) Auth & Init
// =============================================
async function checkAuth() { try { const r = await fetch(`${API_BASE}/auth`,{method:'GET',credentials:'include'}); if(!r.ok) window.location.href='/admin/login.html'; } catch(e){ window.location.href='/admin/login.html'; } }

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    initLogout();
    if (document.getElementById('dashboardPage')) initDashboard();
    if (document.getElementById('dataViewerPage')) initDataViewer();
});

function initLogout() {
    const btn = document.getElementById('logoutBtn') || document.getElementById('logoutBtnData');
    if (btn) btn.addEventListener('click', async () => { await fetch(`${API_BASE}/auth`,{method:'DELETE'}); window.location.href='/admin/login.html'; });
}

// =============================================
// 2) Dashboard Logic (Visits & Journeys)
// =============================================
let allVisitors = [];

function initDashboard() { fetchAnalytics(); fetchVisitors(); initDashboardEvents(); }

async function fetchAnalytics() {
    const d = await apiRequest('/analytics'); if(!d) return;
    document.getElementById('kpiVisitors').textContent = d.total_visitors || 0;
    document.getElementById('kpiHotLeads').textContent = d.hot_leads || 0;
    document.getElementById('kpiConversions').textContent = d.total_conversions || 0;
    document.getElementById('kpiSessions').textContent = d.total_visits || 0; // الآن تعرض الزيارات الفعلية
}

async function fetchVisitors() {
    const d = await apiRequest('/visitors'); if(d && Array.isArray(d)) { allVisitors = d; renderVisitorsTable(d); }
}

function renderVisitorsTable(visitors) {
    const tbody = document.getElementById('visitorsTableBody'); if(!tbody) return;
    if (!visitors.length) { tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-secondary)">No visitors</td></tr>`; return; }
    tbody.innerHTML = visitors.map(v => `
        <tr>
            <td style="font-family:monospace">${v.uid.substring(0,8)}...</td>
            <td>${v.identified_name || 'Unknown'}</td>
            <td>${v.identified_email || '-'}</td>
            <td><span class="badge badge-${v.lead_status}">${v.lead_status}</span></td>
            <td>${v.total_visits || 0}</td>
            <td>${v.total_conversions || 0}</td>
            <td><button class="btn btn-indigo btn-sm journey-btn" data-uid="${v.uid}">360°</button></td>
        </tr>
    `).join('');
}

function initDashboardEvents() {
    const tbody = document.getElementById('visitorsTableBody');
    const addBtn = document.getElementById('addVisitorBtn');
    const modal = document.getElementById('visitorModal');

    if (tbody) tbody.addEventListener('click', async (e) => {
        if (e.target.closest('.journey-btn')) await openJourneyModal(e.target.closest('.journey-btn').dataset.uid);
    });
    if (addBtn) addBtn.addEventListener('click', () => { document.getElementById('visitorForm').reset(); openModal(modal); });
    document.getElementById('closeVisitorModal')?.addEventListener('click', () => closeModal(modal));
    document.getElementById('closeJourneyModal')?.addEventListener('click', () => closeModal(document.getElementById('journeyModal')));
    
    document.getElementById('visitorForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const uid = document.getElementById('visitorUid').value;
        const payload = { identified_name: document.getElementById('identified_name').value, identified_email: document.getElementById('identified_email').value, lead_status: document.getElementById('lead_status').value, is_identified: true };
        if (uid) await apiRequest(`/visitors/${uid}`, 'PATCH', payload); else { payload.uid = crypto.randomUUID(); payload.total_visits=0; await apiRequest('/visitors', 'POST', payload); }
        closeModal(modal); fetchVisitors();
    });
}

// الـ Journey Modal الجديد كلياً (يدعم V4 Visits & Journeys)
async function openJourneyModal(uid) {
    const jContent = document.getElementById('journeyContent');
    jContent.innerHTML = '<p>Loading...</p>';
    openModal(document.getElementById('journeyModal'));

    const data = await apiRequest(`/journey?uid=${uid}`);
    if (!data || !data.profile) { jContent.innerHTML = '<p>No data found.</p>'; return; }

    let html = `<h3 style="margin-bottom:1rem">${data.profile.identified_email || uid}</h3>`;

    // رسم خريطة الزيارات والرحلات
    if (data.visits && data.visits.length > 0) {
        data.visits.forEach(visit => {
            const journeyObj = data.journeys ? data.journeys.find(j => j.visit_id === visit.visit_id) : null;
            const visitEvents = data.events ? data.events.filter(e => e.visit_id === visit.visit_id) : [];
            
            html += `<div style="margin-bottom:1.5rem; border-left:3px solid var(--accent); padding-left:1rem;">`;
            html += `<strong>Visit on ${new Date(visit.started_at).toLocaleString()}</strong> (Duration: ${visit.duration_sec}s, Bounce: ${visit.is_bounce})<br>`;
            
            if (journeyObj && journeyObj.journey) {
                html += `<div style="margin:0.5rem 0; color:#fcd34d;">Journey: ${journeyObj.journey.join(' ➔ ')}</div>`;
            }
            
            if (visitEvents.length > 0) {
                html += `<ul style="margin-top:0.5rem; padding-left:1.5rem;">`;
                visitEvents.forEach(ev => {
                    html += `<li style="color:var(--success); font-weight:bold;">⚡ ${ev.event_type} ${ev.event_value ? '('+ev.event_value+')' : ''}</li>`;
                });
                html += `</ul>`;
            }
            html += `</div>`;
        });
    } else {
        html += `<p style="color:var(--text-secondary)">No visits recorded.</p>`;
    }

    jContent.innerHTML = html;
}


// =============================================
// 3) Data Viewer Logic (7 Tables)
// =============================================
let dvState = { currentTable: 'visitor_profiles', currentPage: 1, data: [] };

function initDataViewer() { initDvEvents(); fetchRawData(); }

function initDvEvents() {
    document.querySelectorAll('.sidebar-btn').forEach(btn => btn.addEventListener('click', (e) => {
        document.querySelector('.sidebar-btn.active')?.classList.remove('active');
        e.target.classList.add('active');
        dvState.currentTable = e.target.dataset.table; dvState.currentPage = 1; fetchRawData();
    }));
    document.getElementById('prevBtn')?.addEventListener('click', () => { if(dvState.currentPage>1){dvState.currentPage--;fetchRawData();} });
    document.getElementById('nextBtn')?.addEventListener('click', () => { dvState.currentPage++; fetchRawData(); });
    document.getElementById('tableBody')?.addEventListener('click', async (e) => {
        if(e.target.closest('.raw-edit-btn')) { const id=e.target.closest('.raw-edit-btn').dataset.id; const pk=e.target.closest('.raw-edit-btn').dataset.pk; const row=dvState.data.find(r=>r[pk]==id); if(row) openRawEditModal(row,pk); }
        if(e.target.closest('.raw-delete-btn')) { const id=e.target.closest('.raw-delete-btn').dataset.id; if(confirm('Delete?')){ await apiRequest(`/raw-data?table=${dvState.currentTable}&id=${id}`,'DELETE'); fetchRawData(); } }
    });
    document.getElementById('closeEditModal')?.addEventListener('click', () => closeModal(document.getElementById('editModal')));
    document.getElementById('editForm')?.addEventListener('submit', async (e) => {
        e.preventDefault(); const id=document.getElementById('editRecordId').value; const table=document.getElementById('editTableName').value; const pk=document.getElementById('editPkName').value;
        const payload={}; document.querySelectorAll('#formFields input').forEach(inp => { if(inp.name!==pk) payload[inp.name]=inp.value; });
        await apiRequest(`/raw-data?table=${table}&id=${id}`, 'PATCH', payload);
        closeModal(document.getElementById('editModal')); fetchRawData();
    });
}

async function fetchRawData() {
    const tbody=document.getElementById('tableBody'), thead=document.getElementById('tableHead');
    tbody.innerHTML=`<tr><td colspan="20">Loading...</td></tr>`;
    const result = await apiRequest(`/raw-data?table=${dvState.currentTable}&page=${dvState.currentPage}`);
    if(result&&result.data){ dvState.data=result.data; const cols=Object.keys(result.data[0]||{}); const pk=PK_MAP[dvState.currentTable];
        thead.innerHTML=`<tr>${cols.map(c=>`<th>${c}</th>`).join('')}<th>Act</th></tr>`;
        tbody.innerHTML=result.data.map(row=>{ const rid=row[pk]; return `<tr>${cols.map(c=>`<td>${JSON.stringify(row[c])?.substring(0,30)}</td>`).join('')}<td><button class="btn btn-ghost btn-sm raw-edit-btn" data-id="${rid}" data-pk="${pk}">E</button> <button class="btn btn-danger btn-sm raw-delete-btn" data-id="${rid}">D</button></td></tr>`; }).join('');
        document.getElementById('pageInfo').textContent=`Page ${result.pagination.currentPage} of ${result.pagination.totalPages||1}`;
    }
}

function openRawEditModal(rowData, pk) {
    document.getElementById('editRecordId').value=rowData[pk]; document.getElementById('editTableName').value=dvState.currentTable; document.getElementById('editPkName').value=pk;
    const ff=document.getElementById('formFields'); ff.innerHTML='';
    Object.keys(rowData).forEach(c=>{ const v=rowData[c]===null?'':JSON.stringify(rowData[c]); ff.innerHTML+=`<div class="form-group"><label>${c}</label><input type="text" name="${c}" class="form-input" value="${v}" ${c===pk?'disabled':''}></div>`; });
    openModal(document.getElementById('editModal'));
}


// =============================================
// 4) Global Utilities
// =============================================
async function apiRequest(endpoint, method='GET', body=null) {
    const options = { method, credentials: 'include', headers: { 'Content-Type': 'application/json' } };
    if (body) options.body = JSON.stringify(body);
    try { const res=await fetch(`${API_BASE}${endpoint}`,options); if(res.status===401) window.location.href='/admin/login.html'; if(res.status===204) return true; const d=await res.json(); if(!res.ok) throw new Error(d.error); return d; } catch(e){ console.error(e); alert(e.message); return null; }
}
function openModal(m){if(m)m.classList.add('active')}
function closeModal(m){if(m)m.classList.remove('active')}