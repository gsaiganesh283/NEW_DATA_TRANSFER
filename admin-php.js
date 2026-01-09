// Admin Dashboard JavaScript for PHP

const API_BASE = '/php'; // Adjust based on deployment

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
        const adminNameEl = document.getElementById('adminName');
        if (adminNameEl) {
            adminNameEl.textContent = data.user.name || 'Admin';
        }
        
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
            displayUsers(data.users || []);
        }
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

// Display users in table
function displayUsers(users) {
    const tableBody = document.getElementById('usersTableBody');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    users.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${user.name}</td>
            <td>${user.email}</td>
            <td>
                <select onchange="updateUserRole('${user.id}', this.value)" style="padding: 5px;">
                    <option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option>
                    <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                    <option value="superadmin" ${user.role === 'superadmin' ? 'selected' : ''}>SuperAdmin</option>
                </select>
            </td>
            <td>${new Date(user.createdAt).toLocaleDateString()}</td>
            <td>
                <button onclick="deleteUser('${user.id}')" class="btn btn-small btn-danger">Delete</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// Load transfers
async function loadTransfers() {
    try {
        const response = await authFetch('/api/admin/transfers');
        if (response && response.ok) {
            const data = await response.json();
            displayTransfers(data.transfers || []);
        }
    } catch (error) {
        console.error('Error loading transfers:', error);
    }
}

// Display transfers in table
function displayTransfers(transfers) {
    const tableBody = document.getElementById('transfersTableBody');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    transfers.forEach(transfer => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${transfer.code}</td>
            <td>${transfer.fileCount}</td>
            <td>${formatSize(transfer.totalSize)}</td>
            <td>${transfer.downloadCount}</td>
            <td>${transfer.uploadedBy}</td>
            <td>${new Date(transfer.uploadedAt).toLocaleString()}</td>
            <td>
                <button onclick="deleteTransfer('${transfer.code}')" class="btn btn-small btn-danger">Delete</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// Update user role
async function updateUserRole(userId, newRole) {
    try {
        const response = await authFetch(`/api/admin/users/${userId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ role: newRole })
        });

        if (response.ok) {
            showToast('User role updated', 'success');
            loadUsers();
        } else {
            const data = await response.json();
            showToast(data.error || 'Update failed', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Error updating user', 'error');
    }
}

// Delete user
async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user?')) return;
    
    try {
        const response = await authFetch(`/api/admin/users/${userId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showToast('User deleted', 'success');
            loadUsers();
        } else {
            const data = await response.json();
            showToast(data.error || 'Delete failed', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Error deleting user', 'error');
    }
}

// Delete transfer
async function deleteTransfer(code) {
    if (!confirm('Are you sure you want to delete this transfer?')) return;
    
    try {
        const response = await authFetch(`/api/admin/transfers/${code}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showToast('Transfer deleted', 'success');
            loadTransfers();
            loadDashboardStats();
        } else {
            const data = await response.json();
            showToast(data.error || 'Delete failed', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Error deleting transfer', 'error');
    }
}

// Handle settings form
const settingsForm = document.getElementById('settingsForm');
if (settingsForm) {
    // Load current settings
    async function loadSettings() {
        try {
            const response = await authFetch('/api/admin/settings');
            if (response.ok) {
                const data = await response.json();
                document.getElementById('maxFileSize').value = data.settings.maxFileSize;
                document.getElementById('maxFiles').value = data.settings.maxFiles;
                document.getElementById('expiryTime').value = data.settings.expiryTime;
                document.getElementById('allowAnonymous').checked = data.settings.allowAnonymous;
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }
    
    loadSettings();
    
    settingsForm.addEventListener('submit', async (e) => {
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
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(settings)
            });

            const data = await response.json();

            if (response.ok) {
                showToast('Settings updated', 'success');
            } else {
                showToast(data.error || 'Update failed', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            showToast('Error updating settings', 'error');
        }
    });
}

// Handle password change form
const changePasswordForm = document.getElementById('changePasswordForm');
if (changePasswordForm) {
    changePasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        if (newPassword !== confirmPassword) {
            showToast('Passwords do not match', 'error');
            return;
        }
        
        if (newPassword.length < 6) {
            showToast('Password must be at least 6 characters', 'error');
            return;
        }
        
        try {
            const response = await authFetch('/api/admin/change-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    currentPassword,
                    newPassword
                })
            });

            const data = await response.json();

            if (response.ok) {
                showToast('Password changed successfully', 'success');
                changePasswordForm.reset();
            } else {
                showToast(data.error || 'Failed to change password', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            showToast('Error changing password', 'error');
        }
    });
}

// Handle logout
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        logout();
    });
}

// Refresh stats every 30 seconds
setInterval(() => {
    loadDashboardStats();
    loadTransfers();
}, 30000);

// Load admin data on page load
document.addEventListener('DOMContentLoaded', () => {
    checkAdminAccess();
});

// Utility function for file size formatting
function formatSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
