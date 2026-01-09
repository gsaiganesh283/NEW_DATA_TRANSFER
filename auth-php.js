// Auth State
const AUTH_TOKEN_KEY = 'file_transfer_token';
const AUTH_USER_KEY = 'file_transfer_user';
const API_BASE = '/php'; // Adjust based on deployment

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

// Fetch with auth header
async function authFetch(url, options = {}) {
    const token = getToken();
    
    const headers = options.headers || {};
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    options.headers = headers;
    
    return fetch(API_BASE + url, options);
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
        const response = await fetch(API_BASE + '/auth/login', {
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
        const response = await fetch(API_BASE + '/auth/signup', {
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
        showToast('Signup successful!');
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
        await authFetch('/auth/logout', {
            method: 'POST'
        });
    } catch (error) {
        console.error('Logout error:', error);
    }
    
    clearAuth();
    window.location.href = '/login.html';
}

// Show user header if logged in
function showUserHeader() {
    const user = getUser();
    const headerContainer = document.getElementById('userHeaderContainer');
    const authButtons = document.getElementById('authButtons');
    
    if (user && headerContainer) {
        headerContainer.innerHTML = `
            <div class="user-header">
                <div class="user-info">
                    <span class="user-name">👤 ${user.name || user.email}</span>
                </div>
                <button onclick="logout()" class="btn btn-small btn-secondary">Logout</button>
            </div>
        `;
        
        if (authButtons) {
            authButtons.style.display = 'none';
        }
    } else if (authButtons) {
        authButtons.style.display = 'block';
    }
}

// Check if authenticated on page load for protected pages
function checkAuthentication(requireAuth = false) {
    const user = getUser();
    
    if (requireAuth && !user) {
        window.location.href = '/login.html';
    }
    
    showUserHeader();
}

// Call checkAuthentication on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    checkAuthentication();
});

// Handle login form submission
if (document.getElementById('loginForm')) {
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        await login(email, password);
    });
}

// Handle signup form submission
if (document.getElementById('signupForm')) {
    document.getElementById('signupForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        if (password !== confirmPassword) {
            showAuthError('Passwords do not match');
            return;
        }
        
        await signup(name, email, password);
    });
}
