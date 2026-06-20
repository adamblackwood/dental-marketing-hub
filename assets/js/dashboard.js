// assets/js/dashboard.js - FINAL VERSION WITH JOURNEY & SOURCES

const DashboardApp = {
  state: {
    currentTab: 'visitors',
    currentPage: 1,
    limit: 25,
    total: 0,
    currentAction: { type: '', action: '', id: '' },
    isLoading: false
  },

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
    modalForm: document.getElementById('modal-form'),
    modalTitle: document.getElementById('modal-title'),
    modalFields: document.getElementById('modal-fields'),
    confirmModalBtn: document.getElementById('confirm-modal-btn'),
    addNewBtn: document.getElementById('add-new-btn'),
    tableHead: document.getElementById('table-head'),
    tableBody: document.getElementById('table-body'),
    paginationContainer: document.getElementById('pagination-container'),
    dateFilter: document.getElementById('date-filter'),
    chartsArea: document.querySelector('.charts-area'),
    sourcesContainer: document.getElementById('sources-container'),
    toastContainer: document.getElementById('toast-container')
  },

  init() {
    this.setupEventListeners();
    this.loadCurrentTabData();
  },

  showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    this.elements.toastContainer.appendChild(toast);
    setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 3000);
  },

  setButtonLoading(button, isLoading) {
    if (isLoading) {
      button.disabled = true;
      button.classList.add('btn-loading');
      button.dataset.originalText = button.textContent;
      button.innerHTML = `<span class="spinner"></span> Processing...`;
    } else {
      button.disabled = false;
      button.classList.remove('btn-loading');
      button.textContent = button.dataset.originalText || 'Submit';
    }
  },

  setupEventListeners() {
    this.elements.viewToggle.addEventListener('change', (e) => {
      const isAnalytics = e.target.checked;
      this.elements.analyticsView.classList.toggle('hidden', !isAnalytics);
      this.elements.dataView.classList.toggle('hidden', isAnalytics);
      this.elements.labelData.classList.toggle('active', !isAnalytics);
      this.elements.labelAnalytics.classList.toggle('active', isAnalytics);
      if (isAnalytics) this.loadAnalytics();
    });

    this.elements.tabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        this.elements.tabs.forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        this.state.currentTab = e.target.dataset.target;
        this.state.currentPage = 1;
        this.loadCurrentTabData();
      });
    });

    this.elements.dateFilter.addEventListener('change', () => {
      if (this.elements.viewToggle.checked) this.loadAnalytics();
    });

    this.elements.logoutBtn.addEventListener('click', async () => {
      await fetch('/api/admin/auth', { method: 'DELETE' });
      window.location.href = '/admin/login.html';
    });

    [this.elements.closeModalBtn, this.elements.cancelModalBtn].forEach(btn => {
      btn.addEventListener('click', () => this.elements.modalOverlay.classList.add('hidden'));
    });

    this.elements.paginationContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('page-btn')) {
        this.state.currentPage = parseInt(e.target.dataset.page);
        this.loadCurrentTabData();
      }
    });

    this.elements.addNewBtn.addEventListener('click', () => this.openModal('add', 'visitor', null));

    // Table Actions (Edit/Delete/Journey)
    this.elements.tableBody.addEventListener('click', (e) => {
      const btn = e.target.closest('.action-btn');
      if (!btn) return;
      const id = btn.dataset.id;
      const type = btn.dataset.type;
      
      if (btn.classList.contains('edit-btn')) this.openModal('edit', type, id);
      else if (btn.classList.contains('delete-btn')) this.openModal('delete', type, id);
      else if (btn.classList.contains('journey-btn')) this.openJourneyModal(id);
    });

    this.elements.modalForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleModalSubmit();
    });
  },

  async loadCurrentTabData() {
    if (this.state.isLoading) return;
    const { currentTab, currentPage, limit } = this.state;
    const endpoint = `/api/admin/${currentTab}?page=${currentPage}&limit=${limit}`;
    
    try {
      this.state.isLoading = true;
      const res = await fetch(endpoint);
      if (res.status === 401) { window.location.href = '/admin/login.html'; return; }
      const result = await res.json();
      
      this.state.total = result.total;
      this.renderTable(currentTab, result.data);
      this.renderPagination();
    } catch (error) {
      this.showToast('Failed to load data', 'error');
    } finally {
      this.state.isLoading = false;
    }
  },

  renderTable(type, data) {
    let headers = '';
    let rows = '';

    if (type === 'visitors') {
      headers = `<tr><th>Fingerprint</th><th>Name / Email</th><th>Clinic Size</th><th>Status</th><th>Last Seen</th><th>Actions</th></tr>`;
      rows = data.map(v => `
        <tr>
          <td title="${v.fingerprint_id}">${v.fingerprint_id.substring(0, 12)}...</td>
          <td><strong>${v.identified_name || '-'}</strong><br><small>${v.identified_email || '-'}</small></td>
          <td>${v.clinic_size || '-'}</td>
          <td>
            ${v.is_hot_lead ? '<span style="color:var(--success)">🔥 Hot</span>' : '-'}
            ${v.is_identified ? '<span style="color:var(--accent)"> Identified</span>' : '<span style="color:var(--text-muted)"> Anon</span>'}
          </td>
          <td>${new Date(v.last_seen_at).toLocaleDateString()}</td>
          <td>
            <button class="action-btn journey-btn" data-id="${v.fingerprint_id}" data-type="visitor" style="background:var(--accent); color:white;">Journey 🗺️</button>
            <button class="action-btn edit-btn" data-id="${v.fingerprint_id}" data-type="visitor">Edit</button>
            <button class="action-btn delete-btn" data-id="${v.fingerprint_id}" data-type="visitor">Del</button>
          </td>
        </tr>
      `).join('');
    } 
    else if (type === 'sessions') {
      headers = `<tr><th>Session ID</th><th>Fingerprint</th><th>Entry</th><th>Duration</th><th>Scroll</th><th>Bounce</th><th>Actions</th></tr>`;
      rows = data.map(s => `
        <tr>
          <td title="${s.session_id}">${s.session_id.substring(0, 8)}...</td>
          <td title="${s.fingerprint_id}">${s.fingerprint_id.substring(0, 8)}...</td>
          <td>${s.entry_page}</td>
          <td>${s.duration_sec}s</td>
          <td>${s.max_scroll_pct}%</td>
          <td>${s.is_bounce ? '<span style="color:var(--danger)">Yes</span>' : '<span style="color:var(--success)">No</span>'}</td>
          <td><button class="action-btn delete-btn" data-id="${s.session_id}" data-type="session">Del</button></td>
        </tr>
      `).join('');
    } 
    else if (type === 'events') {
      headers = `<tr><th>Event ID</th><th>Fingerprint</th><th>Type</th><th>Value</th><th>Date</th><th>Actions</th></tr>`;
      rows = data.map(e => `
        <tr>
          <td>${e.event_id}</td>
          <td title="${e.fingerprint_id}">${e.fingerprint_id.substring(0, 8)}...</td>
          <td><strong>${e.event_type}</strong></td>
          <td>${e.event_value ? e.event_value.substring(0, 20) : '-'}</td>
          <td>${new Date(e.created_at).toLocaleString()}</td>
          <td><button class="action-btn delete-btn" data-id="${e.event_id}" data-type="event">Del</button></td>
        </tr>
      `).join('');
    }

    this.elements.tableHead.innerHTML = headers;
    this.elements.tableBody.innerHTML = rows || `<tr><td colspan="6" style="text-align:center">No data found</td></tr>`;
  },

  renderPagination() {
    const { total, currentPage, limit } = this.state;
    const totalPages = Math.ceil(total / limit);
    if (totalPages <= 1) { this.elements.paginationContainer.innerHTML = `<small style="color:var(--text-muted)">Total: ${total}</small>`; return; }

    let buttons = `<small style="color:var(--text-muted); margin-right: 15px;">Total: ${total}</small>`;
    if (currentPage > 1) buttons += `<button class="control-btn page-btn" data-page="${currentPage - 1}">Prev</button>`;
    const startPage = Math.max(1, currentPage - 1);
    const endPage = Math.min(totalPages, currentPage + 1);
    for (let i = startPage; i <= endPage; i++) {
      buttons += `<button class="control-btn page-btn ${i === currentPage ? 'primary-btn' : ''}" data-page="${i}">${i}</button>`;
    }
    if (currentPage < totalPages) buttons += `<button class="control-btn page-btn" data-page="${currentPage + 1}">Next</button>`;

    this.elements.paginationContainer.innerHTML = buttons;
  },

  openModal(action, type, id) {
    this.state.currentAction = { type, action, id };
    this.elements.modalFields.innerHTML = ''; 
    this.elements.confirmModalBtn.classList.remove('primary-btn', 'danger-btn');

    if (action === 'delete') {
      this.elements.modalTitle.textContent = `Confirm Deletion`;
      this.elements.confirmModalBtn.textContent = `Delete Permanently`;
      this.elements.confirmModalBtn.classList.add('danger-btn');
      this.elements.modalFields.innerHTML = `<p style="color:var(--text-muted)">Are you sure you want to delete this ${type}? This cannot be undone.</p><input type="hidden" id="modal-delete-id" value="${id}">`;
    } 
    else if (action === 'edit' && type === 'visitor') {
      this.elements.modalTitle.textContent = `Edit Visitor`;
      this.elements.confirmModalBtn.textContent = `Save Changes`;
      this.elements.confirmModalBtn.classList.add('primary-btn');
      const row = document.querySelector(`button[data-id="${id}"]`).closest('tr');
      const name = row.cells[1].querySelector('strong').textContent;
      const email = row.cells[1].querySelector('small').textContent;
      this.elements.modalFields.innerHTML = `
        <div class="form-group"><label>Name</label><input type="text" id="modal-name" value="${name !== '-' ? name : ''}"></div>
        <div class="form-group"><label>Email</label><input type="email" id="modal-email" value="${email !== '-' ? email : ''}"></div>
        <div class="form-group"><label>Clinic Size</label><input type="text" id="modal-clinic"></div>
        <div class="form-group"><label><input type="checkbox" id="modal-hot"> Mark as Hot Lead 🔥</label></div>
        <input type="hidden" id="modal-edit-id" value="${id}">
      `;
    }
    else if (action === 'add' && type === 'visitor') {
      this.elements.modalTitle.textContent = `Add New Visitor`;
      this.elements.confirmModalBtn.textContent = `Add Visitor`;
      this.elements.confirmModalBtn.classList.add('primary-btn');
      this.elements.modalFields.innerHTML = `
        <div class="form-group"><label>Name</label><input type="text" id="modal-name" required></div>
        <div class="form-group"><label>Email</label><input type="email" id="modal-email" required></div>
        <div class="form-group"><label>Clinic Size</label><input type="text" id="modal-clinic"></div>
        <div class="form-group"><label><input type="checkbox" id="modal-hot"> Mark as Hot Lead 🔥</label></div>
      `;
    }
    this.elements.modalOverlay.classList.remove('hidden');
  },

  // 🚀 دالة استكشاف الرحلة (Timeline)
  async openJourneyModal(fp) {
    this.state.currentAction = { type: 'journey', action: 'journey', id: fp };
    this.elements.modalTitle.textContent = 'Visitor Journey 🗺️';
    this.elements.confirmModalBtn.textContent = 'Close';
    this.elements.confirmModalBtn.classList.remove('danger-btn');
    this.elements.confirmModalBtn.classList.add('primary-btn');
    this.elements.modalFields.innerHTML = '<p style="text-align:center; color:var(--text-muted)">Loading journey...</p>';
    this.elements.modalOverlay.classList.remove('hidden');

    try {
      const res = await fetch(`/api/admin/journey?fp=${fp}`);
      if (res.status === 401) { window.location.href = '/admin/login.html'; return; }
      const result = await res.json();

      const visitor = result.visitor || {};
      const timeline = result.timeline || [];

      let timelineHTML = `
        <div class="journey-header">
          <h4>${visitor.identified_name || 'Anonymous Visitor'}</h4>
          <p>Email: ${visitor.identified_email || 'N/A'} | Source: ${visitor.first_source || 'Direct'}</p>
        </div>
        <div class="timeline">
      `;

      if (timeline.length === 0) {
        timelineHTML += '<p style="text-align:center">No activity recorded yet.</p>';
      } else {
        timeline.forEach(item => {
          timelineHTML += `
            <div class="timeline-item">
              <div class="timeline-icon">${item.icon}</div>
              <div class="timeline-content">
                <div class="timeline-time">${new Date(item.time).toLocaleString()}</div>
                <div class="timeline-details">${item.details}</div>
              </div>
            </div>
          `;
        });
      }

      timelineHTML += '</div>';
      this.elements.modalFields.innerHTML = timelineHTML;

    } catch (error) {
      this.elements.modalFields.innerHTML = '<p style="color:var(--danger)">Error loading journey.</p>';
    }
  },

  async handleModalSubmit() {
    const { action } = this.state.currentAction;
    
    // إذا كانت النافذة مخصصة للرحلة (Journey)، أغلقها فقط
    if (action === 'journey') {
      this.elements.modalOverlay.classList.add('hidden');
      return;
    }

    const submitBtn = this.elements.confirmModalBtn;
    const { type } = this.state.currentAction;
    let endpoint = '', method = '', body = {};

    this.setButtonLoading(submitBtn, true);

    try {
      if (action === 'delete') {
        const id = document.getElementById('modal-delete-id').value;
        endpoint = `/api/admin/${type}s/${id}`;
        method = 'DELETE';
      } 
      else if (action === 'edit' && type === 'visitor') {
        const id = document.getElementById('modal-edit-id').value;
        endpoint = `/api/admin/visitors/${id}`;
        method = 'PATCH';
        body = {
          identified_name: document.getElementById('modal-name').value,
          identified_email: document.getElementById('modal-email').value,
          clinic_size: document.getElementById('modal-clinic').value,
          is_hot_lead: document.getElementById('modal-hot').checked
        };
      }
      else if (action === 'add' && type === 'visitor') {
        endpoint = `/api/admin/visitors`;
        method = 'POST';
        body = {
          name: document.getElementById('modal-name').value,
          email: document.getElementById('modal-email').value,
          clinic_size: document.getElementById('modal-clinic').value,
          is_hot_lead: document.getElementById('modal-hot').checked
        };
      }

      const res = await fetch(endpoint, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: method !== 'DELETE' ? JSON.stringify(body) : undefined
      });

      if (res.ok) {
        this.elements.modalOverlay.classList.add('hidden');
        this.showToast(`Action completed successfully!`, 'success');
        this.loadCurrentTabData(); 
      } else {
        const errData = await res.json();
        this.showToast(errData.error || 'Action failed', 'error');
      }
    } catch (error) {
      this.showToast('Network error occurred', 'error');
    } finally {
      this.setButtonLoading(submitBtn, false);
    }
  },

  // --- Analytics Functions ---
  async loadAnalytics() {
    const range = this.elements.dateFilter.value;
    try {
      const res = await fetch(`/api/admin/analytics?range=${range}`);
      if (res.status === 401) { window.location.href = '/admin/login.html'; return; }
      const result = await res.json();
      this.renderKPIs(result.kpis);
      this.renderChart(result.chart);
      this.renderSources(result.sources);
    } catch (error) {
      this.showToast('Failed to load analytics', 'error');
    }
  },

  renderKPIs(kpis) {
    document.getElementById('kpi-visits').textContent = kpis.totalVisits.toLocaleString();
    document.getElementById('kpi-visitors').textContent = kpis.totalVisitors.toLocaleString();
    document.getElementById('kpi-leads').textContent = kpis.totalLeads.toLocaleString();
    document.getElementById('kpi-clicks').textContent = kpis.totalClicks.toLocaleString();
    const bounceEl = document.getElementById('kpi-bounce');
    bounceEl.textContent = `${kpis.bounceRate}%`;
    bounceEl.style.color = kpis.bounceRate > 60 ? 'var(--danger)' : 'var(--success)';
  },

  renderChart(chartData) {
    if (!chartData || chartData.length === 0) {
      this.elements.chartsArea.innerHTML = '<p style="text-align:center; color:var(--text-muted)">No chart data available</p>';
      return;
    }
    const maxVisits = Math.max(...chartData.map(d => d.visits), 1);
    let barsHTML = chartData.map(day => {
      const heightPercent = (day.visits / maxVisits) * 100;
      return `
        <div class="bar-group">
          <div class="bar" style="height: ${heightPercent}%;">
            <span class="bar-value">${day.visits}</span>
          </div>
          <span class="bar-label">${day.date}</span>
        </div>
      `;
    }).join('');

    this.elements.chartsArea.innerHTML = `
      <h3 class="chart-title">Daily Visits (Last 7 Days)</h3>
      <div class="bar-chart">${barsHTML}</div>
    `;
  },

  // 🚀 رسم بطاقات المصادر (Traffic Sources)
  renderSources(sources) {
    if (!sources || sources.length === 0) {
      this.elements.sourcesContainer.innerHTML = '<p style="text-align:center; color:var(--text-muted)">No source data</p>';
      return;
    }

    let html = '<h3 class="chart-title">Traffic Sources</h3>';
    
    sources.forEach(s => {
      let color = '#64748b'; // Default gray
      if (s.name === 'cold_email' || s.name === 'email') color = '#ef4444'; // Red for email
      else if (s.name === 'facebook') color = '#3b82f6'; // Blue for FB
      
      const cleanName = s.name.replace('_', ' ');
      
      html += `
        <div class="source-item">
          <div class="source-header">
            <span style="text-transform:capitalize">${cleanName}</span>
            <span>${s.percentage}% (${s.count})</span>
          </div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width: ${s.percentage}%; background: ${color};"></div>
          </div>
        </div>
      `;
    });

    this.elements.sourcesContainer.innerHTML = html;
  }
};

document.addEventListener('DOMContentLoaded', () => DashboardApp.init());