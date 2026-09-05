/**
 * CloudVault - Client Application Logic
 */

// Application State
const state = {
  items: [],
  activeType: 'all',
  searchQuery: '',
  viewMode: localStorage.getItem('cloudvault_view') || 'grid',
  theme: localStorage.getItem('cloudvault_theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
  editingNoteId: null,
  activeViewingNote: null,
  currentUser: null,
  authMode: 'login' // 'login' or 'register'
};

// DOM Elements
const elements = {
  // Theme
  themeToggle: document.getElementById('theme-toggle'),
  themeIconMoon: document.getElementById('theme-icon-moon'),
  themeIconSun: document.getElementById('theme-icon-sun'),

  // Auth & Profile
  userProfileBar: document.getElementById('user-profile-bar'),
  userAvatar: document.getElementById('user-avatar'),
  userName: document.getElementById('user-name'),
  btnLogout: document.getElementById('btn-logout'),
  btnManageUsers: document.getElementById('btn-manage-users'),

  adminModal: document.getElementById('admin-modal'),
  adminSummaryGrid: document.getElementById('admin-summary-grid'),
  adminUsersList: document.getElementById('admin-users-list'),
  adminCleanupLog: document.getElementById('admin-cleanup-log'),
  adminUserCount: document.getElementById('admin-user-count'),
  btnCloseAdminModal: document.getElementById('btn-close-admin-modal'),
  btnDeleteNonAdmins: document.getElementById('btn-delete-non-admins'),
  userAdminBadge: document.getElementById('user-admin-badge'),

  authModal: document.getElementById('auth-modal'),
  authTabLogin: document.getElementById('auth-tab-login'),
  authTabRegister: document.getElementById('auth-tab-register'),
  authForm: document.getElementById('auth-form'),
  authUsername: document.getElementById('auth-username'),
  authPassword: document.getElementById('auth-password'),
  authErrorBox: document.getElementById('auth-error-box'),
  btnAuthSubmit: document.getElementById('btn-auth-submit'),
  authSubmitText: document.getElementById('auth-submit-text'),
  authSpinner: document.getElementById('auth-spinner'),

  // Stats
  statStorage: document.getElementById('stat-storage'),
  statTotal: document.getElementById('stat-total'),
  countAll: document.getElementById('count-all'),
  countText: document.getElementById('count-text'),
  countImage: document.getElementById('count-image'),
  countFile: document.getElementById('count-file'),

  // Dropzone & Uploads
  dropzone: document.getElementById('dropzone'),
  fileInput: document.getElementById('file-input'),
  btnBrowseFile: document.getElementById('btn-browse-file'),
  btnNewNote: document.getElementById('btn-new-note'),
  uploadProgressCard: document.getElementById('upload-progress-card'),
  uploadStatusText: document.getElementById('upload-status-text'),
  uploadPercentage: document.getElementById('upload-percentage'),
  uploadProgressFill: document.getElementById('upload-progress-fill'),

  // Controls
  filterTabs: document.querySelectorAll('.tab-btn'),
  searchInput: document.getElementById('search-input'),
  searchClear: document.getElementById('search-clear'),
  viewGrid: document.getElementById('view-grid'),
  viewList: document.getElementById('view-list'),

  // Items List & States
  itemsContainer: document.getElementById('items-container'),
  loadingSpinner: document.getElementById('loading-spinner'),
  emptyState: document.getElementById('empty-state'),
  emptyTitle: document.getElementById('empty-title'),
  emptyDesc: document.getElementById('empty-desc'),

  // Note Modal
  noteModal: document.getElementById('note-modal'),
  noteForm: document.getElementById('note-form'),
  noteModalTitle: document.getElementById('note-modal-title'),
  noteIdInput: document.getElementById('note-id'),
  noteTitleInput: document.getElementById('note-title-input'),
  noteContentInput: document.getElementById('note-content-input'),
  charCount: document.getElementById('char-count'),
  wordCount: document.getElementById('word-count'),
  btnCloseNoteModal: document.getElementById('btn-close-note-modal'),
  btnCancelNote: document.getElementById('btn-cancel-note'),

  // View Note Modal
  viewNoteModal: document.getElementById('view-note-modal'),
  viewNoteTitle: document.getElementById('view-note-title'),
  viewNoteDate: document.getElementById('view-note-date'),
  viewNoteContent: document.getElementById('view-note-content'),
  btnCloseViewNote: document.getElementById('btn-close-view-note'),
  btnCopyViewNote: document.getElementById('btn-copy-view-note'),
  btnCopyText: document.getElementById('btn-copy-text'),
  btnDownloadViewNote: document.getElementById('btn-download-view-note'),
  btnEditViewNote: document.getElementById('btn-edit-view-note'),

  // Lightbox
  imageLightbox: document.getElementById('image-lightbox'),
  lightboxImage: document.getElementById('lightbox-image'),
  lightboxTitle: document.getElementById('lightbox-title'),
  lightboxMeta: document.getElementById('lightbox-meta'),
  lightboxDownloadLink: document.getElementById('lightbox-download-link'),
  btnCloseLightbox: document.getElementById('btn-close-lightbox'),

  // Toast Container
  toastContainer: document.getElementById('toast-container')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  applyTheme(state.theme);
  applyViewMode(state.viewMode);
  setupEventListeners();

  if (window.location.protocol === 'file:') {
    showToast('Page opened as file://. Please run "npm start" and visit http://localhost:5000', 'error');
  } else {
    checkAuthSession();
  }
});

// Setup All UI Event Listeners
function setupEventListeners() {
  // Theme Toggle
  elements.themeToggle.addEventListener('click', () => {
    const nextTheme = state.theme === 'light' ? 'dark' : 'light';
    applyTheme(nextTheme);
  });

  // View Mode Toggles
  elements.viewGrid.addEventListener('click', () => applyViewMode('grid'));
  elements.viewList.addEventListener('click', () => applyViewMode('list'));

  // Filter Tabs
  elements.filterTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      elements.filterTabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      state.activeType = tab.dataset.type;
      loadItems();
    });
  });

  // Search Input with Debounce
  let searchTimeout;
  elements.searchInput.addEventListener('input', (e) => {
    const val = e.target.value;
    state.searchQuery = val;
    elements.searchClear.classList.toggle('hidden', !val);

    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      loadItems();
    }, 250);
  });

  elements.searchClear.addEventListener('click', () => {
    elements.searchInput.value = '';
    state.searchQuery = '';
    elements.searchClear.classList.add('hidden');
    loadItems();
  });

  // File Upload Handlers
  elements.btnBrowseFile.addEventListener('click', () => elements.fileInput.click());
  
  // Prevent clicks on the file input from bubbling up to dropzone
  elements.fileInput.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  elements.dropzone.addEventListener('click', (e) => {
    if (!e.target.closest('button')) {
      elements.fileInput.click();
    }
  });

  elements.fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesUpload(e.target.files);
      elements.fileInput.value = ''; // Reset
    }
  });

  // Global Drag and Drop Guards (prevents browser navigating away if dropped outside dropzone)
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => e.preventDefault());

  // Dropzone Drag and Drop Events
  ['dragenter', 'dragover'].forEach((eventName) => {
    elements.dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      elements.dropzone.classList.add('drag-over');
    });
  });

  ['dragleave', 'drop'].forEach((eventName) => {
    elements.dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      elements.dropzone.classList.remove('drag-over');
    });
  });

  elements.dropzone.addEventListener('drop', (e) => {
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesUpload(e.dataTransfer.files);
    }
  });

  // Note Modal Handlers
  elements.btnNewNote.addEventListener('click', () => openNoteEditor());
  elements.btnCloseNoteModal.addEventListener('click', closeNoteEditor);
  elements.btnCancelNote.addEventListener('click', closeNoteEditor);
  elements.noteForm.addEventListener('submit', handleSaveNote);

  elements.noteContentInput.addEventListener('input', updateTextareaMeta);

  // View Note Modal Handlers
  elements.btnCloseViewNote.addEventListener('click', closeViewNoteModal);
  elements.btnCopyViewNote.addEventListener('click', copyViewingNoteContent);
  elements.btnDownloadViewNote.addEventListener('click', downloadViewingNote);
  elements.btnEditViewNote.addEventListener('click', () => {
    if (state.activeViewingNote) {
      const noteToEdit = state.activeViewingNote;
      closeViewNoteModal();
      openNoteEditor(noteToEdit);
    }
  });

  // Lightbox Close Handlers
  elements.btnCloseLightbox.addEventListener('click', closeLightbox);
  elements.imageLightbox.addEventListener('click', (e) => {
    if (e.target === elements.imageLightbox) {
      closeLightbox();
    }
  });

  // Keyboard Shortcuts (Escape closes modals)
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeNoteEditor();
      closeViewNoteModal();
      closeLightbox();
    }
  });

  // Auth Event Listeners
  elements.authTabLogin.addEventListener('click', () => setAuthMode('login'));
  elements.authTabRegister.addEventListener('click', () => setAuthMode('register'));
  elements.authForm.addEventListener('submit', handleAuthSubmit);
  elements.btnLogout.addEventListener('click', handleLogout);
  elements.btnManageUsers.addEventListener('click', openAdminPanel);
  elements.btnCloseAdminModal.addEventListener('click', closeAdminPanel);
  elements.btnDeleteNonAdmins.addEventListener('click', deleteNonAdminUsers);
  elements.adminModal.addEventListener('click', (e) => {
    if (e.target === elements.adminModal) closeAdminPanel();
  });
}

// ============================================================
// AUTHENTICATION FUNCTIONS
// ============================================================

async function checkAuthSession() {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.user) {
        setCurrentUser(data.user);
        loadData();
        return;
      }
    }
  } catch (err) { /* network error — fall through to show auth modal */ }
  showAuthModal();
}

function setCurrentUser(user) {
  state.currentUser = user;
  const isAdmin = Boolean(user.is_admin);
  elements.userAvatar.textContent = user.username.charAt(0).toUpperCase();
  elements.userName.textContent = user.username;
  elements.userAdminBadge.classList.toggle('hidden', !isAdmin);
  elements.userProfileBar.classList.remove('hidden');
  elements.btnManageUsers.classList.toggle('hidden', !isAdmin);
  elements.authModal.classList.add('hidden');
}

function clearCurrentUser() {
  state.currentUser = null;
  state.items = [];
  elements.userProfileBar.classList.add('hidden');
  elements.itemsContainer.innerHTML = '';
}

function showAuthModal() {
  elements.authModal.classList.remove('hidden');
  elements.userProfileBar.classList.add('hidden');
  setAuthMode(state.authMode);
  elements.authUsername.value = '';
  elements.authPassword.value = '';
  elements.authErrorBox.classList.add('hidden');
  elements.authErrorBox.textContent = '';
  setTimeout(() => elements.authUsername.focus(), 100);
}

function setAuthMode(mode) {
  state.authMode = mode;
  if (mode === 'login') {
    elements.authTabLogin.classList.add('active');
    elements.authTabRegister.classList.remove('active');
    elements.authSubmitText.textContent = 'Sign In';
    elements.authPassword.setAttribute('autocomplete', 'current-password');
  } else {
    elements.authTabRegister.classList.add('active');
    elements.authTabLogin.classList.remove('active');
    elements.authSubmitText.textContent = 'Create Account';
    elements.authPassword.setAttribute('autocomplete', 'new-password');
  }
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const username = elements.authUsername.value.trim();
  const password = elements.authPassword.value;

  if (!username || !password) {
    elements.authErrorBox.textContent = 'Please enter both username and password.';
    elements.authErrorBox.classList.remove('hidden');
    return;
  }

  elements.authErrorBox.classList.add('hidden');
  elements.authSpinner.classList.remove('hidden');
  elements.btnAuthSubmit.disabled = true;

  const endpoint = state.authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.success) {
      setCurrentUser(data.user);
      loadData();
      showToast(`Welcome, ${data.user.username}! 👋`, 'success');
    } else {
      elements.authErrorBox.textContent = data.error || 'Authentication failed.';
      elements.authErrorBox.classList.remove('hidden');
    }
  } catch (err) {
    elements.authErrorBox.textContent = 'Network error. Make sure the server is running.';
    elements.authErrorBox.classList.remove('hidden');
  } finally {
    elements.authSpinner.classList.add('hidden');
    elements.btnAuthSubmit.disabled = false;
  }
}

async function handleLogout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  } catch (err) { /* ignore network errors on logout */ }
  closeAdminPanel();
  clearCurrentUser();
  showToast('Signed out successfully.', 'info');
  showAuthModal();
}

async function openAdminPanel() {
  if (!state.currentUser || !state.currentUser.is_admin) return;
  elements.adminModal.classList.remove('hidden');
  await loadAdminPanelData();
}

function closeAdminPanel() {
  elements.adminModal.classList.add('hidden');
}

async function loadAdminPanelData() {
  try {
    const [summaryRes, usersRes, logsRes] = await Promise.all([
      fetch('/api/admin/summary', { credentials: 'include' }),
      fetch('/api/admin/users', { credentials: 'include' }),
      fetch('/api/admin/logs', { credentials: 'include' })
    ]);

    const summaryData = await summaryRes.json();
    const usersData = await usersRes.json();
    const logsData = await logsRes.json();

    if (summaryData.success) {
      renderAdminSummary(summaryData.summary || {});
    }
    if (usersData.success) {
      renderAdminUsers(usersData.users || []);
    }
    if (logsData.success) {
      renderCleanupLogs(logsData.logs || []);
    }
  } catch (err) {
    console.error('Failed to fetch admin data:', err);
    showToast('Unable to load admin panel.', 'error');
  }
}

function renderAdminSummary(summary) {
  const cards = [
    { label: 'Retention', value: `${summary.retentionDays || 30} days` },
    { label: 'Users', value: summary.totalUsers || 0 },
    { label: 'Admins', value: summary.totalAdmins || 0 },
    { label: 'Items', value: summary.totalItems || 0 }
  ];

  elements.adminSummaryGrid.innerHTML = cards.map((card) => `
    <div class="summary-stat-box">
      <span>${escapeHtml(card.label)}</span>
      <strong>${escapeHtml(String(card.value))}</strong>
    </div>
  `).join('');
}

async function deleteNonAdminUsers() {
  const confirmed = window.confirm('Delete all non-admin users? This cannot be undone.');
  if (!confirmed) return;

  try {
    const res = await fetch('/api/admin/users/non-admins', {
      method: 'DELETE',
      credentials: 'include'
    });
    const data = await res.json();
    if (data.success) {
      showToast(`${data.deletedCount} non-admin users deleted.`, 'success');
      await loadAdminPanelData();
    } else {
      showToast(data.error || 'Could not delete non-admin users.', 'error');
    }
  } catch (err) {
    showToast('Failed to delete non-admin users.', 'error');
  }
}

function renderAdminUsers(users) {
  elements.adminUserCount.textContent = users.length;
  if (!users.length) {
    elements.adminUsersList.innerHTML = '<div class="admin-empty">No users found.</div>';
    return;
  }

  elements.adminUsersList.innerHTML = users.map((user) => `
    <div class="admin-user-item">
      <div>
        <div class="admin-user-name">${escapeHtml(user.username)}</div>
        <div class="admin-user-meta">${user.is_admin ? 'Admin' : 'User'} • Joined ${formatDate(user.created_at)}</div>
      </div>
      <button class="btn btn-secondary btn-small" data-user-id="${user.id}" data-delete-user="true" ${user.is_admin ? 'disabled' : ''}>
        ${user.is_admin ? 'Admin' : 'Delete'}
      </button>
    </div>
  `).join('');

  elements.adminUsersList.querySelectorAll('[data-delete-user]').forEach((button) => {
    button.addEventListener('click', async () => {
      const id = button.dataset.userId;
      if (!id) return;
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        showToast('User removed successfully', 'success');
        await loadAdminPanelData();
      } else {
        showToast(data.error || 'Unable to delete user', 'error');
      }
    });
  });
}

function renderCleanupLogs(logs) {
  if (!logs.length) {
    elements.adminCleanupLog.innerHTML = '<div class="admin-empty">No cleanup events yet.</div>';
    return;
  }

  elements.adminCleanupLog.innerHTML = logs.map((log) => `
    <div class="admin-log-item">
      <div class="admin-log-title">${escapeHtml(log.action || 'Cleanup')}</div>
      <div class="admin-log-meta">${escapeHtml(log.username || 'System')} • ${formatDate(log.created_at)}</div>
      <div class="admin-log-details">${escapeHtml(log.details || '')}</div>
      <div class="admin-log-stats">Deleted ${log.deleted_items || 0} items • Removed ${log.removed_files || 0} files</div>
    </div>
  `).join('');
}

// Apply Theme
function applyTheme(theme) {
  state.theme = theme;
  localStorage.setItem('cloudvault_theme', theme);
  document.documentElement.setAttribute('data-theme', theme);

  if (theme === 'dark') {
    elements.themeIconMoon.classList.add('hidden');
    elements.themeIconSun.classList.remove('hidden');
  } else {
    elements.themeIconMoon.classList.remove('hidden');
    elements.themeIconSun.classList.add('hidden');
  }
}

// Apply View Mode
function applyViewMode(mode) {
  state.viewMode = mode;
  localStorage.setItem('cloudvault_view', mode);

  if (mode === 'list') {
    elements.viewList.classList.add('active');
    elements.viewGrid.classList.remove('active');
    elements.itemsContainer.className = 'items-list';
  } else {
    elements.viewGrid.classList.add('active');
    elements.viewList.classList.remove('active');
    elements.itemsContainer.className = 'items-grid';
  }
}

// Load Data (Stats + Items)
async function loadData() {
  await Promise.all([loadStats(), loadItems()]);
}

// Load Storage Stats
async function loadStats() {
  try {
    const res = await fetch('/api/stats');
    const data = await res.json();
    if (data.success && data.stats) {
      const { totalItems, totalSize, textCount, imageCount, fileCount } = data.stats;
      elements.statStorage.textContent = formatBytes(totalSize);
      elements.statTotal.textContent = `${totalItems} ${totalItems === 1 ? 'item' : 'items'}`;

      elements.countAll.textContent = totalItems;
      elements.countText.textContent = textCount;
      elements.countImage.textContent = imageCount;
      elements.countFile.textContent = fileCount;
    }
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

// Load Items
async function loadItems() {
  elements.loadingSpinner.classList.remove('hidden');
  elements.emptyState.classList.add('hidden');
  elements.itemsContainer.innerHTML = '';

  try {
    const params = new URLSearchParams();
    if (state.activeType && state.activeType !== 'all') {
      params.append('type', state.activeType);
    }
    if (state.searchQuery && state.searchQuery.trim()) {
      params.append('search', state.searchQuery.trim());
    }

    const res = await fetch(`/api/items?${params.toString()}`);
    const data = await res.json();

    elements.loadingSpinner.classList.add('hidden');

    if (data.success) {
      state.items = data.items || [];
      renderItems(state.items);
    } else {
      showToast(data.error || 'Failed to fetch items', 'error');
    }
  } catch (err) {
    elements.loadingSpinner.classList.add('hidden');
    console.error('Failed to load items:', err);
    showToast('Network error while fetching items', 'error');
  }
}

// Render Items
function renderItems(items) {
  elements.itemsContainer.innerHTML = '';

  if (items.length === 0) {
    elements.emptyState.classList.remove('hidden');
    if (state.searchQuery) {
      elements.emptyTitle.textContent = 'No matching items found';
      elements.emptyDesc.textContent = `No items matched "${state.searchQuery}". Try a different keyword.`;
    } else if (state.activeType !== 'all') {
      elements.emptyTitle.textContent = `No ${state.activeType}s stored yet`;
      elements.emptyDesc.textContent = `Upload or create ${state.activeType}s to view them here.`;
    } else {
      elements.emptyTitle.textContent = 'Your vault is empty';
      elements.emptyDesc.textContent = 'Upload photos, store documents, or create text notes to get started.';
    }
    return;
  }

  elements.emptyState.classList.add('hidden');

  items.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.dataset.id = item.id;

    if (item.type === 'image') {
      card.innerHTML = renderImageCard(item);
    } else if (item.type === 'text') {
      card.innerHTML = renderTextCard(item);
    } else {
      card.innerHTML = renderFileCard(item);
    }

    // Attach card event listeners
    attachCardListeners(card, item);
    elements.itemsContainer.appendChild(card);
  });
}

// Template for Image Card
function renderImageCard(item) {
  const formattedSize = formatBytes(item.size);
  const formattedDate = formatDate(item.created_at);

  return `
    <div class="card-image-preview" title="Click to preview full image">
      <img src="${item.filepath}" alt="${escapeHtml(item.title)}" loading="lazy">
      <span class="image-overlay-badge">🖼️ Image</span>
    </div>
    <div class="card-content">
      <h4 class="card-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</h4>
      <div class="card-meta">
        <span>${formattedSize}</span>
        <span>&bull;</span>
        <span>${formattedDate}</span>
      </div>
    </div>
    <div class="card-actions">
      <div class="action-btns-left">
        <button class="btn-card-action btn-preview-image" title="View Fullscreen">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 3 21 3 21 9"/>
            <polyline points="9 21 3 21 3 15"/>
            <line x1="21" y1="3" x2="14" y2="10"/>
            <line x1="3" y1="21" x2="10" y2="14"/>
          </svg>
          <span>View</span>
        </button>
        <a href="/api/download/${item.id}" class="btn-card-action" title="Download">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          <span>Download</span>
        </a>
      </div>
      <button class="btn-card-action btn-card-delete" title="Delete Image">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
      </button>
    </div>
  `;
}

// Template for Text Note Card
function renderTextCard(item) {
  const formattedSize = `${item.content ? item.content.length : 0} chars`;
  const formattedDate = formatDate(item.created_at);
  const snippet = item.content || 'Empty note...';

  return `
    <div class="card-note-preview" title="Click to view full note">
      <div class="note-snippet-text">${escapeHtml(snippet)}</div>
    </div>
    <div class="card-content">
      <h4 class="card-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</h4>
      <div class="card-meta">
        <span>${formattedSize}</span>
        <span>&bull;</span>
        <span>${formattedDate}</span>
      </div>
    </div>
    <div class="card-actions">
      <div class="action-btns-left">
        <button class="btn-card-action btn-view-note" title="Read Note">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
          </svg>
          <span>Open</span>
        </button>
        <button class="btn-card-action btn-quick-copy" title="Copy Content">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          <span class="copy-lbl">Copy</span>
        </button>
      </div>
      <button class="btn-card-action btn-card-delete" title="Delete Note">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
      </button>
    </div>
  `;
}

// Template for General File Card
function renderFileCard(item) {
  const ext = getFileExtension(item.original_name || item.filename);
  const extClass = getExtClass(ext);
  const formattedSize = formatBytes(item.size);
  const formattedDate = formatDate(item.created_at);

  return `
    <div class="card-file-preview">
      <div class="file-ext-icon ${extClass}">
        ${ext.substring(0, 4)}
      </div>
    </div>
    <div class="card-content">
      <h4 class="card-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</h4>
      <div class="card-meta">
        <span>${formattedSize}</span>
        <span>&bull;</span>
        <span>${formattedDate}</span>
      </div>
    </div>
    <div class="card-actions">
      <div class="action-btns-left">
        <a href="/api/download/${item.id}" class="btn-card-action" title="Download File">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          <span>Download</span>
        </a>
      </div>
      <button class="btn-card-action btn-card-delete" title="Delete File">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
      </button>
    </div>
  `;
}

// Attach Event Listeners to each Card
function attachCardListeners(card, item) {
  // Delete action
  const deleteBtn = card.querySelector('.btn-card-delete');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleDeleteItem(item);
    });
  }

  if (item.type === 'image') {
    const previewEl = card.querySelector('.card-image-preview');
    const viewBtn = card.querySelector('.btn-preview-image');
    [previewEl, viewBtn].forEach((el) => {
      if (el) {
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          openLightbox(item);
        });
      }
    });
  } else if (item.type === 'text') {
    const previewEl = card.querySelector('.card-note-preview');
    const viewBtn = card.querySelector('.btn-view-note');
    [previewEl, viewBtn].forEach((el) => {
      if (el) {
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          openViewNoteModal(item);
        });
      }
    });

    const copyBtn = card.querySelector('.btn-quick-copy');
    if (copyBtn) {
      copyBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await navigator.clipboard.writeText(item.content || '');
        const lbl = copyBtn.querySelector('.copy-lbl');
        if (lbl) lbl.textContent = 'Copied!';
        showToast('Note copied to clipboard', 'success');
        setTimeout(() => {
          if (lbl) lbl.textContent = 'Copy';
        }, 2000);
      });
    }
  }
}

// Handle File Uploads (Multiple or Single) with Real-Time Progress Bar
function handleFilesUpload(fileList) {
  if (!fileList || fileList.length === 0) return;

  // Verify not running on local file system (file://)
  if (window.location.protocol === 'file:') {
    showToast('Cannot upload files via file:// protocol. Please run "npm start" and open http://localhost:5000', 'error');
    return;
  }

  const formData = new FormData();
  let totalBytes = 0;
  const count = fileList.length;

  for (let i = 0; i < count; i++) {
    const file = fileList[i];
    // Check 50MB per file limit client-side before sending
    if (file.size > 50 * 1024 * 1024) {
      showToast(`"${file.name}" exceeds 50MB limit (${formatBytes(file.size)}).`, 'error');
      return;
    }
    totalBytes += file.size;
    formData.append('files', file);
  }

  // Display progress card and initial state
  const countLabel = count === 1 ? '1 file' : `${count} files`;
  if (elements.uploadProgressCard) {
    elements.uploadProgressCard.classList.remove('hidden');
    elements.uploadProgressFill.style.width = '0%';
    elements.uploadPercentage.textContent = '0%';
    elements.uploadStatusText.textContent = `Uploading ${countLabel} (${formatBytes(totalBytes)})...`;
  }

  showToast(`Uploading ${countLabel}...`, 'info');

  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/api/upload', true);

  // Live progress updates
  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable && elements.uploadProgressCard) {
      const percent = Math.min(100, Math.round((e.loaded / e.total) * 100));
      elements.uploadProgressFill.style.width = `${percent}%`;
      elements.uploadPercentage.textContent = `${percent}%`;
      if (percent === 100) {
        elements.uploadStatusText.textContent = 'Processing and saving files...';
      }
    }
  };

  // Response completed
  xhr.onload = async () => {
    let data;
    try {
      data = JSON.parse(xhr.responseText);
    } catch (parseErr) {
      data = { success: false, error: `Server response error (${xhr.status}: ${xhr.statusText || 'Unexpected format'})` };
    }

    if (xhr.status >= 200 && xhr.status < 300 && data.success) {
      const uploadedCount = data.items ? data.items.length : count;
      showToast(`Successfully uploaded ${uploadedCount} item(s)!`, 'success');
      await loadData();
    } else {
      const errMsg = data.error || `Upload failed with status ${xhr.status}`;
      showToast(errMsg, 'error');
    }

    // Hide progress bar with a short delay
    setTimeout(() => {
      if (elements.uploadProgressCard) {
        elements.uploadProgressCard.classList.add('hidden');
        elements.uploadProgressFill.style.width = '0%';
      }
    }, 1200);
  };

  // Network connection error
  xhr.onerror = () => {
    showToast('Network error during upload. Ensure the server is running on http://localhost:5000.', 'error');
    if (elements.uploadProgressCard) {
      elements.uploadProgressCard.classList.add('hidden');
    }
  };

  xhr.send(formData);
}

// Note Editor: Open Modal
function openNoteEditor(note = null) {
  if (note) {
    state.editingNoteId = note.id;
    elements.noteModalTitle.textContent = 'Edit Text Note';
    elements.noteIdInput.value = note.id;
    elements.noteTitleInput.value = note.title;
    elements.noteContentInput.value = note.content || '';
  } else {
    state.editingNoteId = null;
    elements.noteModalTitle.textContent = 'Create New Text Note';
    elements.noteIdInput.value = '';
    elements.noteTitleInput.value = '';
    elements.noteContentInput.value = '';
  }

  updateTextareaMeta();
  elements.noteModal.classList.remove('hidden');
  elements.noteTitleInput.focus();
}

// Note Editor: Close Modal
function closeNoteEditor() {
  elements.noteModal.classList.add('hidden');
  elements.noteForm.reset();
  state.editingNoteId = null;
}

// Note Editor: Word & Char Count
function updateTextareaMeta() {
  const content = elements.noteContentInput.value;
  const chars = content.length;
  const words = content.trim() === '' ? 0 : content.trim().split(/\s+/).length;

  elements.charCount.textContent = `${chars} chars`;
  elements.wordCount.textContent = `${words} words`;
}

// Note Editor: Save Note
async function handleSaveNote(e) {
  e.preventDefault();

  const title = elements.noteTitleInput.value.trim();
  const content = elements.noteContentInput.value;

  if (!title) {
    showToast('Please enter a note title', 'error');
    return;
  }

  const isEditing = Boolean(state.editingNoteId);
  const url = isEditing ? `/api/text/${state.editingNoteId}` : '/api/text';
  const method = isEditing ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content })
    });

    const data = await res.json();

    if (data.success) {
      showToast(isEditing ? 'Note updated successfully!' : 'Note created successfully!', 'success');
      closeNoteEditor();
      await loadData();
    } else {
      showToast(data.error || 'Failed to save note', 'error');
    }
  } catch (err) {
    console.error('Save note error:', err);
    showToast('Network error while saving note', 'error');
  }
}

// View Note Modal: Open
function openViewNoteModal(note) {
  state.activeViewingNote = note;
  elements.viewNoteTitle.textContent = note.title;
  elements.viewNoteDate.textContent = `Saved on ${formatDate(note.created_at)}`;
  elements.viewNoteContent.textContent = note.content || '(Empty content)';
  elements.viewNoteModal.classList.remove('hidden');
}

// View Note Modal: Close
function closeViewNoteModal() {
  elements.viewNoteModal.classList.add('hidden');
  state.activeViewingNote = null;
}

// View Note Modal: Copy Content
async function copyViewingNoteContent() {
  if (state.activeViewingNote) {
    await navigator.clipboard.writeText(state.activeViewingNote.content || '');
    elements.btnCopyText.textContent = 'Copied!';
    showToast('Note copied to clipboard', 'success');
    setTimeout(() => {
      elements.btnCopyText.textContent = 'Copy Content';
    }, 2000);
  }
}

// View Note Modal: Download as .txt
function downloadViewingNote() {
  if (state.activeViewingNote) {
    window.location.href = `/api/download/${state.activeViewingNote.id}`;
  }
}

// Lightbox: Open
function openLightbox(item) {
  elements.lightboxImage.src = item.filepath;
  elements.lightboxTitle.textContent = item.title;
  elements.lightboxMeta.textContent = `${formatBytes(item.size)} • ${formatDate(item.created_at)}`;
  elements.lightboxDownloadLink.href = `/api/download/${item.id}`;
  elements.imageLightbox.classList.remove('hidden');
}

// Lightbox: Close
function closeLightbox() {
  elements.imageLightbox.classList.add('hidden');
  elements.lightboxImage.src = '';
}

// Delete Item
async function handleDeleteItem(item) {
  const confirmMsg = `Are you sure you want to delete "${item.title}"?`;
  if (!window.confirm(confirmMsg)) return;

  try {
    const res = await fetch(`/api/items/${item.id}`, { method: 'DELETE' });
    const data = await res.json();

    if (data.success) {
      showToast(`"${item.title}" deleted`, 'info');
      await loadData();
    } else {
      showToast(data.error || 'Failed to delete item', 'error');
    }
  } catch (err) {
    console.error('Delete error:', err);
    showToast('Failed to delete item', 'error');
  }
}

// Toast Notifications
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
  toast.innerHTML = `<span>${icon}</span> <span>${escapeHtml(message)}</span>`;

  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Helper: Format Bytes into KB/MB/GB
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Helper: Format Date
function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

// Helper: Extract File Extension
function getFileExtension(filename) {
  if (!filename) return 'FILE';
  const parts = filename.split('.');
  if (parts.length <= 1) return 'FILE';
  return parts.pop().toUpperCase();
}

// Helper: Get CSS class for extension icon color
function getExtClass(ext) {
  const e = ext.toLowerCase();
  if (e === 'pdf') return 'ext-pdf';
  if (['doc', 'docx', 'odt', 'rtf'].includes(e)) return 'ext-doc';
  if (['xls', 'xlsx', 'csv', 'ods'].includes(e)) return 'ext-xls';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(e)) return 'ext-zip';
  if (['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(e)) return 'ext-mp3';
  if (['mp4', 'mkv', 'mov', 'webm', 'avi'].includes(e)) return 'ext-mp4';
  if (['js', 'ts', 'py', 'html', 'css', 'json', 'c', 'cpp', 'java', 'sql'].includes(e)) return 'ext-code';
  return 'ext-generic';
}

// Helper: Escape HTML string
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

