// Auth State
const AUTH_TOKEN_KEY = 'file_transfer_token';
const AUTH_USER_KEY = 'file_transfer_user';

// Get stored auth data
function getToken() {
    return localStorage.getItem(AUTH_TOKEN_KEY);
}

function getUser() {
    const user = localStorage.getItem(AUTH_USER_KEY);
    return user ? JSON.parse(user) : null;
}

function setAuth(token, user) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

function clearAuth() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
}

function isAuthenticated() {
    return !!getToken();
}

// Show error message
function showAuthError(message) {
    const errorDiv = document.getElementById('authError');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    }
}

// Show toast notification
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.textContent = message;
        toast.className = `toast ${type} show`;
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}

// Login function
async function login(email, password) {
    try {
        const response = await fetch('/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            showAuthError(data.error || 'Login failed');
            return false;
        }

        setAuth(data.token, data.user);
        showToast('Login successful!');

        // Redirect based on role
        if (data.user.role === 'superadmin' || data.user.role === 'admin') {
            window.location.href = '/admin.html';
        } else {
            window.location.href = '/index.html';
        }

        return true;
    } catch (error) {
        console.error('Login error:', error);
        showAuthError('Connection error. Please try again.');
        return false;
    }
}

// Signup function
async function signup(name, email, password) {
    try {
        const response = await fetch('/auth/signup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            showAuthError(data.error || 'Signup failed');
            return false;
        }

        setAuth(data.token, data.user);
        showToast('Account created successfully!');
        window.location.href = '/index.html';

        return true;
    } catch (error) {
        console.error('Signup error:', error);
        showAuthError('Connection error. Please try again.');
        return false;
    }
}

// Logout function
async function logout() {
    try {
        await fetch('/auth/logout', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getToken()}`
            }
        });
    } catch (error) {
        console.error('Logout error:', error);
    }

    clearAuth();
    window.location.href = '/login.html';
}

// Check authentication and redirect if needed
async function checkAuth() {
    const token = getToken();
    const currentPage = window.location.pathname;

    if (token) {
        try {
            const response = await fetch('/auth/verify', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                // Update stored user data
                localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));

                // If on login/signup page, redirect to main app
                if (currentPage.includes('login.html') || currentPage.includes('signup.html')) {
                    if (data.user.role === 'superadmin' || data.user.role === 'admin') {
                        window.location.href = '/admin.html';
                    } else {
                        window.location.href = '/index.html';
                    }
                }
                return true;
            } else {
                clearAuth();
            }
        } catch (error) {
            console.error('Auth check error:', error);
            clearAuth();
        }
    }

    return false;
}

// Check if user is admin
function isAdmin() {
    const user = getUser();
    return user && (user.role === 'admin' || user.role === 'superadmin');
}

// Check if user is superadmin
function isSuperAdmin() {
    const user = getUser();
    return user && user.role === 'superadmin';
}

// Fetch with auth header
async function authFetch(url, options = {}) {
    const token = getToken();
    const headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`
    };

    const response = await fetch(url, { ...options, headers });

    if (response.status === 401) {
        clearAuth();
        window.location.href = '/login.html';
        return null;
    }

    return response;
}

// Render user header for authenticated pages
function renderUserHeader() {
    const user = getUser();
    if (!user) return '';

    const initials = user.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase() : '?';
    const avatar = user.avatar 
        ? `<img src="${user.avatar}" alt="${user.name}">`
        : initials;

    return `
        <div class="user-header">
            <div class="user-info">
                <div class="user-avatar">${avatar}</div>
                <div>
                    <div class="user-name">${user.name || 'User'}</div>
                    <span class="user-role">${user.role}</span>
                </div>
            </div>
            ${isAdmin() ? '<a href="/admin.html" class="btn btn-small btn-secondary">🛡️ Admin</a>' : ''}
            <button onclick="logout()" class="btn btn-small btn-danger">Logout</button>
        </div>
    `;
}

// Initialize user header on page load
function initUserHeader() {
    const user = getUser();
    if (user) {
        const container = document.querySelector('.container');
        if (container) {
            const headerHTML = renderUserHeader();
            container.insertAdjacentHTML('afterbegin', headerHTML);
        }
    }
}

// Handle Google OAuth callback
function handleOAuthCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const userStr = urlParams.get('user');

    if (token && userStr) {
        try {
            const user = JSON.parse(decodeURIComponent(userStr));
            setAuth(token, user);
            
            // Clean URL and redirect
            if (user.role === 'superadmin' || user.role === 'admin') {
                window.location.href = '/admin.html';
            } else {
                window.location.href = '/index.html';
            }
        } catch (error) {
            console.error('OAuth callback error:', error);
        }
    }
}

// Check for OAuth callback on page load
if (window.location.search.includes('token=')) {
    handleOAuthCallback();
}
