// Admin Dashboard JavaScript

// Check admin access
async function checkAdminAccess() {
    const token = getToken();
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    try {
        const response = await authFetch('/auth/verify');
        if (!response || !response.ok) {
            window.location.href = '/login.html';
            return;
        }

        const data = await response.json();
        if (data.user.role !== 'admin' && data.user.role !== 'superadmin') {
            window.location.href = '/index.html';
            return;
        }

        // Set admin name
        document.getElementById('adminName').textContent = data.user.name || 'Admin';
        
        // Load dashboard data
        loadDashboardStats();
        loadUsers();
        loadTransfers();
    } catch (error) {
        console.error('Admin access check error:', error);
        window.location.href = '/login.html';
    }
}

// Load dashboard stats
async function loadDashboardStats() {
    try {
        const response = await authFetch('/api/admin/stats');
        if (response && response.ok) {
            const stats = await response.json();
            document.getElementById('totalUsers').textContent = stats.totalUsers || 0;
            document.getElementById('activeTransfers').textContent = stats.activeTransfers || 0;
            document.getElementById('totalDownloads').textContent = stats.totalDownloads || 0;
            document.getElementById('storageUsed').textContent = formatSize(stats.storageUsed || 0);
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Load users
async function loadUsers() {
    try {
        const response = await authFetch('/api/admin/users');
        if (response && response.ok) {
            const data = await response.json();
            renderUsersTable(data.users);
        }
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

// Render users table
function renderUsersTable(users) {
    const tbody = document.getElementById('usersTableBody');
    if (!users || users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No users found</td></tr>';
        return;
    }

    tbody.innerHTML = users.map(user => `
        <tr>
            <td>${escapeHtml(user.name || 'N/A')}</td>
            <td>${escapeHtml(user.email)}</td>
            <td><span class="role-badge ${user.role}">${user.role}</span></td>
            <td><span class="provider-badge">${user.provider === 'google' ? '🔵 Google' : '📧 Email'}</span></td>
            <td>${formatDate(user.createdAt)}</td>
            <td>
                <div class="action-btns">
                    <button class="action-btn edit" onclick="editUser('${user.id}')">Edit</button>
                    ${user.role !== 'superadmin' ? `<button class="action-btn delete" onclick="deleteUser('${user.id}')">Delete</button>` : ''}
                </div>
            </td>
        </tr>
    `).join('');
}

// Load transfers
async function loadTransfers() {
    try {
        const response = await authFetch('/api/admin/transfers');
        if (response && response.ok) {
            const data = await response.json();
            renderTransfersTable(data.transfers);
        }
    } catch (error) {
        console.error('Error loading transfers:', error);
    }
}

// Render transfers table
function renderTransfersTable(transfers) {
    const tbody = document.getElementById('transfersTableBody');
    if (!transfers || transfers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No active transfers</td></tr>';
        return;
    }

    tbody.innerHTML = transfers.map(transfer => `
        <tr>
            <td><code style="color: var(--primary-color); font-size: 1.1rem;">${transfer.code}</code></td>
            <td>${transfer.fileCount} file(s)</td>
            <td>${formatSize(transfer.totalSize)}</td>
            <td>${transfer.downloadCount}</td>
            <td>${transfer.uploadedBy || 'Anonymous'}</td>
            <td>${getTimeRemaining(transfer.expiresAt)}</td>
            <td>
                <div class="action-btns">
                    <button class="action-btn delete" onclick="deleteTransfer('${transfer.code}')">Delete</button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Edit user
async function editUser(userId) {
    try {
        const response = await authFetch(`/api/admin/users/${userId}`);
        if (response && response.ok) {
            const user = await response.json();
            document.getElementById('editUserId').value = user.id;
            document.getElementById('editUserName').value = user.name || '';
            document.getElementById('editUserEmail').value = user.email;
            document.getElementById('editUserRole').value = user.role;
            document.getElementById('userModal').style.display = 'flex';
        }
    } catch (error) {
        console.error('Error fetching user:', error);
        showToast('Failed to load user', 'error');
    }
}

// Close user modal
function closeUserModal() {
    document.getElementById('userModal').style.display = 'none';
}

// Delete user
async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
        const response = await authFetch(`/api/admin/users/${userId}`, {
            method: 'DELETE'
        });

        if (response && response.ok) {
            showToast('User deleted successfully');
            loadUsers();
            loadDashboardStats();
        } else {
            const data = await response.json();
            showToast(data.error || 'Failed to delete user', 'error');
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        showToast('Failed to delete user', 'error');
    }
}

// Delete transfer
async function deleteTransfer(code) {
    if (!confirm('Are you sure you want to delete this transfer?')) return;

    try {
        const response = await authFetch(`/api/admin/transfers/${code}`, {
            method: 'DELETE'
        });

        if (response && response.ok) {
            showToast('Transfer deleted successfully');
            loadTransfers();
            loadDashboardStats();
        } else {
            showToast('Failed to delete transfer', 'error');
        }
    } catch (error) {
        console.error('Error deleting transfer:', error);
        showToast('Failed to delete transfer', 'error');
    }
}

// Helper functions
function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}

function getTimeRemaining(expiresAt) {
    if (!expiresAt) return 'N/A';
    const now = Date.now();
    const expires = new Date(expiresAt).getTime();
    const diff = expires - now;
    
    if (diff <= 0) return 'Expired';
    
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Tab switching
document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const tab = btn.dataset.tab;
        document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
        document.getElementById(`${tab}Section`).classList.add('active');
        
        // Load settings when switching to settings tab
        if (tab === 'settings') {
            loadSettings();
        }
    });
});

// Load current settings
async function loadSettings() {
    try {
        const response = await authFetch('/api/admin/settings');
        if (response && response.ok) {
            const data = await response.json();
            const settings = data.settings;
            
            // Populate transfer settings
            document.getElementById('maxFileSize').value = settings.maxFileSize || 2000;
            document.getElementById('maxFiles').value = settings.maxFiles || 50;
            document.getElementById('expiryTime').value = settings.expiryTime || 24;
            document.getElementById('allowAnonymous').checked = settings.allowAnonymous !== false;
            
            // Populate storage settings
            document.getElementById('storagePath').value = settings.storagePath || 'uploads';
            document.getElementById('enableCloudStorage').checked = settings.enableCloudStorage || false;
            document.getElementById('cloudProvider').value = settings.cloudProvider || 'local';
            document.getElementById('cloudBucket').value = settings.cloudBucket || '';
            document.getElementById('cloudRegion').value = settings.cloudRegion || '';
            
            // Toggle cloud settings visibility
            toggleCloudSettings();
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

// Toggle cloud settings visibility
function toggleCloudSettings() {
    const enableCloud = document.getElementById('enableCloudStorage').checked;
    const cloudSettings = document.getElementById('cloudSettings');
    if (cloudSettings) {
        cloudSettings.style.display = enableCloud ? 'block' : 'none';
    }
}

// Refresh buttons
document.getElementById('refreshUsersBtn')?.addEventListener('click', loadUsers);
document.getElementById('refreshTransfersBtn')?.addEventListener('click', loadTransfers);

// Cloud storage toggle
document.getElementById('enableCloudStorage')?.addEventListener('change', toggleCloudSettings);

// Logout button
document.getElementById('logoutBtn')?.addEventListener('click', logout);

// Edit user form
document.getElementById('editUserForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const userId = document.getElementById('editUserId').value;
    const name = document.getElementById('editUserName').value;
    const email = document.getElementById('editUserEmail').value;
    const role = document.getElementById('editUserRole').value;

    try {
        const response = await authFetch(`/api/admin/users/${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, role })
        });

        if (response && response.ok) {
            showToast('User updated successfully');
            closeUserModal();
            loadUsers();
        } else {
            const data = await response.json();
            showToast(data.error || 'Failed to update user', 'error');
        }
    } catch (error) {
        console.error('Error updating user:', error);
        showToast('Failed to update user', 'error');
    }
});

// Settings form (Transfer settings)
document.getElementById('settingsForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const settings = {
        maxFileSize: parseInt(document.getElementById('maxFileSize').value),
        maxFiles: parseInt(document.getElementById('maxFiles').value),
        expiryTime: parseInt(document.getElementById('expiryTime').value),
        allowAnonymous: document.getElementById('allowAnonymous').checked
    };

    try {
        const response = await authFetch('/api/admin/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        });

        if (response && response.ok) {
            showToast('Transfer settings saved successfully');
        } else {
            showToast('Failed to save settings', 'error');
        }
    } catch (error) {
        console.error('Error saving settings:', error);
        showToast('Failed to save settings', 'error');
    }
});

// Storage settings form
document.getElementById('storageForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const settings = {
        storagePath: document.getElementById('storagePath').value,
        enableCloudStorage: document.getElementById('enableCloudStorage').checked,
        cloudProvider: document.getElementById('cloudProvider').value,
        cloudBucket: document.getElementById('cloudBucket').value,
        cloudRegion: document.getElementById('cloudRegion').value
    };

    try {
        const response = await authFetch('/api/admin/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        });

        if (response && response.ok) {
            showToast('Storage settings saved successfully');
        } else {
            showToast('Failed to save storage settings', 'error');
        }
    } catch (error) {
        console.error('Error saving storage settings:', error);
        showToast('Failed to save storage settings', 'error');
    }
});

// Change password form
document.getElementById('changePasswordForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmNewPassword = document.getElementById('confirmNewPassword').value;

    if (newPassword !== confirmNewPassword) {
        showToast('Passwords do not match', 'error');
        return;
    }

    try {
        const response = await authFetch('/api/admin/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentPassword, newPassword })
        });

        if (response && response.ok) {
            showToast('Password changed successfully');
            document.getElementById('changePasswordForm').reset();
        } else {
            const data = await response.json();
            showToast(data.error || 'Failed to change password', 'error');
        }
    } catch (error) {
        console.error('Error changing password:', error);
        showToast('Failed to change password', 'error');
    }
});

// Initialize on load
checkAdminAccess();

// ==================== DATABASE MANAGEMENT ====================

let databaseData = null;

// Load database info
async function loadDatabase() {
    try {
        const response = await authFetch('/api/admin/database');
        if (response && response.ok) {
            databaseData = await response.json();
            renderDatabaseView();
        }
    } catch (error) {
        console.error('Error loading database:', error);
        showToast('Failed to load database', 'error');
    }
}

// Render database view
function renderDatabaseView() {
    if (!databaseData || !databaseData.databases) return;
    
    const { users, settings } = databaseData.databases;
    
    // Update counts
    document.getElementById('userCount').textContent = users.recordCount || 0;
    
    // Update file info
    const dbFileInfo = document.getElementById('dbFileInfo');
    if (dbFileInfo) {
        const usersSize = formatSize(users.size || 0);
        const settingsSize = formatSize(settings.size || 0);
        dbFileInfo.textContent = `Users: ${usersSize} | Settings: ${settingsSize} | Last modified: ${formatDate(users.modified)}`;
    }
    
    // Render JSON in viewers
    const usersEditor = document.getElementById('usersJsonEditor');
    const settingsEditor = document.getElementById('settingsJsonEditor');
    
    if (usersEditor) {
        usersEditor.value = JSON.stringify(users.data, null, 2);
    }
    if (settingsEditor) {
        settingsEditor.value = JSON.stringify(settings.data, null, 2);
    }
}

// Database tab switching
document.querySelectorAll('.db-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.db-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const db = btn.dataset.db;
        document.querySelectorAll('.db-view').forEach(v => v.classList.remove('active'));
        document.getElementById(`db${db.charAt(0).toUpperCase() + db.slice(1)}View`).classList.add('active');
    });
});

// Download handlers
document.getElementById('downloadUsersBtn')?.addEventListener('click', () => {
    downloadDatabase('users');
});

document.getElementById('downloadSettingsBtn')?.addEventListener('click', () => {
    downloadDatabase('settings');
});

document.getElementById('downloadAllBtn')?.addEventListener('click', () => {
    downloadDatabase('all');
});

async function downloadDatabase(type) {
    try {
        const token = getToken();
        const response = await fetch(`/api/admin/database/download/${type}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const filename = type === 'all' ? `backup-${Date.now()}.json` : `${type}.json`;
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
            showToast(`Downloaded ${filename}`);
        } else {
            showToast('Download failed', 'error');
        }
    } catch (error) {
        console.error('Download error:', error);
        showToast('Download failed', 'error');
    }
}

// Refresh database
document.getElementById('refreshDatabaseBtn')?.addEventListener('click', loadDatabase);

// Enable edit mode
document.getElementById('enableEditMode')?.addEventListener('change', (e) => {
    const editPanel = document.getElementById('editModePanel');
    if (editPanel) {
        editPanel.style.display = e.target.checked ? 'block' : 'none';
        if (e.target.checked) {
            loadEditableData();
        }
    }
});

// Load editable data
function loadEditableData() {
    const select = document.getElementById('editDbSelect');
    const editor = document.getElementById('editJsonEditor');
    
    if (!databaseData || !select || !editor) return;
    
    const type = select.value;
    if (type === 'settings') {
        editor.value = JSON.stringify(databaseData.databases.settings.data, null, 2);
    } else if (type === 'users') {
        editor.value = JSON.stringify(databaseData.databases.users.data, null, 2);
    }
}

document.getElementById('editDbSelect')?.addEventListener('change', loadEditableData);

// Validate JSON
document.getElementById('validateJsonBtn')?.addEventListener('click', () => {
    const editor = document.getElementById('editJsonEditor');
    try {
        JSON.parse(editor.value);
        showToast('✓ Valid JSON');
    } catch (error) {
        showToast('Invalid JSON: ' + error.message, 'error');
    }
});

// Save database changes
document.getElementById('saveDbChangesBtn')?.addEventListener('click', async () => {
    const select = document.getElementById('editDbSelect');
    const editor = document.getElementById('editJsonEditor');
    
    if (!select || !editor) return;
    
    const type = select.value;
    let data;
    
    try {
        data = JSON.parse(editor.value);
    } catch (error) {
        showToast('Invalid JSON: ' + error.message, 'error');
        return;
    }
    
    if (!confirm(`Are you sure you want to update the ${type} database? This action cannot be undone!`)) {
        return;
    }
    
    try {
        const response = await authFetch(`/api/admin/database/${type}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data })
        });
        
        if (response && response.ok) {
            showToast(`${type} database updated successfully`);
            loadDatabase(); // Refresh view
        } else {
            const result = await response.json();
            showToast(result.error || 'Failed to update database', 'error');
        }
    } catch (error) {
        console.error('Save error:', error);
        showToast('Failed to save changes', 'error');
    }
});

// Load database when database tab is shown
document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if (btn.dataset.tab === 'database') {
            loadDatabase();
        }
    });
});
