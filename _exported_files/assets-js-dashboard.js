// assets/js/dashboard.js
let activeTab = 'visitors';

window.addEventListener('DOMContentLoaded', async () => {
    // 1. Auth Check
    try {
        const res = await fetch('/api/admin/auth');
        if (!res.ok) return window.location.href = '/admin/login.html';
    } catch (err) {
        return window.location.href = '/admin/login.html';
    }

    // 2. Logout Logic
    document.getElementById('logout-btn').addEventListener('click', async (e) => {
        e.preventDefault();
        await fetch('/api/admin/auth', { method: 'DELETE' });
        window.location.href = '/admin/login.html';
    });

    // 3. Analytics
    fetchAnalytics();

    // 4. Tabs & Event Delegation
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            activeTab = e.target.getAttribute('data-tab');
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            fetchTableData();
        });
    });

    // Event Delegation for Table Actions
    document.getElementById('table-body').addEventListener('click', async (e) => {
        const target = e.target.closest('button');
        if (!target) return;

        const id = target.getAttribute('data-id');
        
        if (target.classList.contains('btn-360')) {
            openJourneyModal(id);
        } else if (target.classList.contains('btn-delete')) {
            if (confirm('Are you sure you want to delete this row?')) {
                await fetch(`/api/admin/${activeTab}/${id}`, { method: 'DELETE' });
                fetchTableData(); // Refresh
            }
        }
    });

    // Modal Close
    document.getElementById('modal-close').addEventListener('click', () => {
        document.getElementById('journey-modal').classList.remove('active');
    });

    // Initial Load
    fetchTableData();
});

async function fetchAnalytics() {
    try {
        const res = await fetch('/api/admin/analytics');
        const data = await res.json();
        document.getElementById('kpi-visitors').innerText = data.total_visitors;
        document.getElementById('kpi-hot').innerText = data.hot_leads;
        document.getElementById('kpi-visits').innerText = data.total_visits;
        document.getElementById('kpi-conversions').innerText = data.total_conversions;
    } catch (err) {
        console.error('Analytics error:', err);
    }
}

async function fetchTableData() {
    const thead = document.getElementById('table-head');
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">Loading...</td></tr>`;

    try {
        const res = await fetch(`/api/admin/${activeTab}`);
        const data = await res.json();
        
        if (data.length === 0) {
            thead.innerHTML = '';
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No data found.</td></tr>`;
            return;
        }

        let headers = '';
        let rows = '';

        if (activeTab === 'visitors') {
            headers = `<tr><th>Email</th><th>Status</th><th>Score</th><th>Last Seen</th><th>Actions</th></tr>`;
            data.forEach(v => {
                const badgeClass = v.lead_status === 'hot' ? 'badge-hot' : (v.lead_status === 'warm' ? 'badge-warm' : 'badge-cold');
                rows += `
                    <tr>
                        <td>${v.identified_email || '<span style="color:var(--text-muted)">Anonymous</span>'}</td>
                        <td><span class="badge ${badgeClass}">${v.lead_status}</span></td>
                        <td>${v.lead_score}</td>
                        <td>${new Date(v.last_seen_at).toLocaleString('en-US')}</td>
                        <td>
                            <button class="btn-action btn-360" data-id="${v.uid}">360° View</button>
                            <button class="btn-action btn-delete" data-id="${v.uid}">Delete</button>
                        </td>
                    </tr>
                `;
            });
        } else if (activeTab === 'sessions') {
            headers = `<tr><th>UID</th><th>Device</th><th>Scroll %</th><th>Started</th><th>Actions</th></tr>`;
            data.forEach(s => {
                rows += `
                    <tr>
                        <td>${s.uid.substring(0,8)}...</td>
                        <td>${s.device_type}</td>
                        <td>${s.max_scroll_pct}%</td>
                        <td>${new Date(s.started_at).toLocaleString('en-US')}</td>
                        <td>
                            <button class="btn-action btn-delete" data-id="${s.session_id}">Delete</button>
                        </td>
                    </tr>
                `;
            });
        } else if (activeTab === 'events') {
            headers = `<tr><th>Type</th><th>Value</th><th>UID</th><th>Date</th><th>Actions</th></tr>`;
            data.forEach(ev => {
                rows += `
                    <tr>
                        <td>${ev.event_type}</td>
                        <td>${ev.event_value || '-'}</td>
                        <td>${ev.uid.substring(0,8)}...</td>
                        <td>${new Date(ev.created_at).toLocaleString('en-US')}</td>
                        <td>
                            <button class="btn-action btn-delete" data-id="${ev.event_id}">Delete</button>
                        </td>
                    </tr>
                `;
            });
        }

        thead.innerHTML = headers;
        tbody.innerHTML = rows;

    } catch (err) {
        console.error('Table fetch error:', err);
    }
}

async function openJourneyModal(uid) {
    const modal = document.getElementById('journey-modal');
    const content = document.getElementById('journey-content');
    modal.classList.add('active');
    content.innerHTML = 'Loading journey...';

    try {
        const res = await fetch(`/api/admin/journey?uid=${uid}`);
        const data = await res.json();
        
        let html = `
            <div style="margin-bottom: 1rem;">
                <strong>Email:</strong> ${data.profile?.identified_email || 'Anonymous'}<br>
                <strong>Lead Score:</strong> ${data.profile?.lead_score} (${data.profile?.lead_status})<br>
                <strong>Total Visits:</strong> ${data.profile?.total_visits}
            </div>
            <h3>Navigation Journey (Zero-Bloat JSONB)</h3>
        `;

        // Map visit_id to started_at to fix the "Invalid Date" issue
        const visitDates = {};
        if (data.visits) {
            data.visits.forEach(v => {
                visitDates[v.visit_id] = v.started_at;
            });
        }

        if (data.journeys && data.journeys.length > 0) {
            data.journeys.forEach(j => {
                const visitDate = visitDates[j.visit_id] ? new Date(visitDates[j.visit_id]).toLocaleString('en-US') : 'Unknown Date';
                
                html += `<div style="margin-bottom: 1.5rem; border-left: 2px solid var(--border); padding-left: 1rem;">`;
                html += `<div style="color: var(--text-muted); font-size: 0.85rem;">Visit Started: ${visitDate}</div>`;
                html += `<div class="timeline">`;
                
                if (Array.isArray(j.journey)) {
                    j.journey.forEach((path, idx) => {
                        html += `
                            <div class="timeline-item">
                                <div class="timeline-time">Step ${idx + 1}</div>
                                <div class="timeline-path">${path}</div>
                            </div>
                        `;
                    });
                }
                html += `</div></div>`;
            });
        } else {
            html += '<p>No journey data recorded.</p>';
        }

        if (data.events && data.events.length > 0) {
            html += `<h3 style="margin-top:1.5rem;">Commercial Events</h3><ul>`;
            data.events.forEach(ev => {
                const eventDate = new Date(ev.created_at).toLocaleString('en-US');
                html += `<li><strong>${ev.event_type}</strong> - ${ev.event_value || ''} (${eventDate})</li>`;
            });
            html += `</ul>`;
        }

        content.innerHTML = html;

    } catch (err) {
        content.innerHTML = '<p style="color: var(--danger);">Error loading journey.</p>';
    }
}