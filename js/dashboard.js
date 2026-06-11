/**
 * Member Dashboard UI & Event Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    initializeAuth();
});

let userToken = AuthService.getStoredToken();
let authMode = 'signin';

function initializeAuth() {
    // Render custom Sign-in with Google button
    const btnContainer = document.getElementById("googleBtn");
    if (btnContainer) {
        btnContainer.innerHTML = `
            <button onclick="handleGoogleLoginClick()" style="display: flex; align-items: center; justify-content: center; gap: 10px; background-color: white; color: #1f2937; border: 1px solid #d1d5db; padding: 0.75rem 1.5rem; border-radius: 8px; cursor: pointer; font-weight: bold; font-family: inherit; font-size: 1rem; width: 100%; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <svg style="width: 20px; height: 20px;" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                تسجيل الدخول باستخدام Google
            </button>
        `;
    }

    if (userToken) {
        showDashboard();
    } else {
        showLogin();
    }
}

function toggleAuthMode() {
    // Signup is disabled — accounts are created by invitation only
    console.warn('Signup disabled: accounts are created by admin invitation only.');
}

async function handleGoogleLoginClick() {
    const errorEl = document.getElementById('loginError');
    if (errorEl) errorEl.style.display = 'none';
    
    try {
        const result = await AuthService.signInWithGoogle();
        AuthService.saveToken(result.accessToken);
        userToken = result.accessToken;
        
        if (result.role === 'admin') {
            window.location.href = 'admin.html';
            return;
        }
        
        showDashboard();
    } catch (err) {
        console.error(err);
        if (errorEl) {
            errorEl.textContent = err.message || "حدث خطأ أثناء تسجيل الدخول عبر Google.";
            errorEl.style.display = 'block';
        }
    }
}

async function handleEmailAuth(event) {
    event.preventDefault();
    const errorEl = document.getElementById('loginError');
    if (errorEl) errorEl.style.display = 'none';
    
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    const submitBtn = document.getElementById('btnAuthSubmit');
    const originalBtnText = submitBtn.textContent;
    
    submitBtn.textContent = 'جاري التحميل...';
    submitBtn.disabled = true;
    
    try {
        const result = await AuthService.signInOrSignUpWithEmail(email, password, authMode);
        AuthService.saveToken(result.accessToken);
        userToken = result.accessToken;
        
        if (result.role === 'admin') {
            window.location.href = 'admin.html';
            return;
        }
        
        showDashboard();
    } catch (err) {
        console.error(err);
        let errMsg = err.message;
        if (err.code === 'auth/email-already-in-use') {
            errMsg = "هذا البريد الإلكتروني مستخدم بالفعل.";
        } else if (err.code === 'auth/invalid-email') {
            errMsg = "البريد الإلكتروني غير صالح.";
        } else if (err.code === 'auth/weak-password') {
            errMsg = "كلمة المرور ضعيفة جداً (يجب أن تكون 6 أحرف على الأقل).";
        } else if (err.code === 'auth/user-not-found') {
            errMsg = "لم يتم العثور على حساب بهذا البريد الإلكتروني.";
        } else if (err.code === 'auth/wrong-password') {
            errMsg = "كلمة المرور غير صحيحة.";
        } else if (err.code === 'auth/user-disabled') {
            errMsg = "هذا الحساب معطل من قبل المشرف.";
        }
        if (errorEl) {
            errorEl.textContent = errMsg;
            errorEl.style.display = 'block';
        }
    } finally {
        submitBtn.textContent = originalBtnText;
        submitBtn.disabled = false;
    }
}

function showLogin() {
    document.getElementById('loginWrapper').style.display = 'flex';
    document.getElementById('dashboardWrapper').style.display = 'none';

    // Reset header elements for logged-out state
    const userEmailDisplay = document.getElementById('userEmailDisplay');
    const headerLogoutBtn = document.getElementById('headerLogoutBtn');
    const headerOrderBtn = document.getElementById('headerOrderBtn');
    
    if (userEmailDisplay) userEmailDisplay.style.display = 'none';
    if (headerLogoutBtn) headerLogoutBtn.style.display = 'none';
    if (headerOrderBtn) {
        headerOrderBtn.textContent = 'اطلب الخدمة الآن';
        headerOrderBtn.href = 'order.html';
    }
}

function showDashboard() {
    document.getElementById('loginWrapper').style.display = 'none';
    document.getElementById('dashboardWrapper').style.display = 'block';
    
    const payload = AuthService.decodeToken(userToken);
    const email = payload ? payload.email : "المطور";
    
    if (payload && payload.role === 'admin') {
        window.location.href = 'admin.html';
        return;
    }
    
    document.getElementById('userEmail').textContent = email;
    
    // Update header elements for logged-in state
    const userEmailDisplay = document.getElementById('userEmailDisplay');
    const headerLogoutBtn = document.getElementById('headerLogoutBtn');
    const headerOrderBtn = document.getElementById('headerOrderBtn');
    
    if (userEmailDisplay) {
        userEmailDisplay.textContent = email;
        userEmailDisplay.style.display = 'inline-block';
    }
    if (headerLogoutBtn) headerLogoutBtn.style.display = 'inline-block';
    if (headerOrderBtn) {
        headerOrderBtn.textContent = 'تقديم طلب نشر جديد';
        headerOrderBtn.href = 'order.html';
    }

    loadUserOrders();
}

async function logout() {
    await AuthService.logout();
    userToken = null;
    showLogin();
}

async function loadUserOrders() {
    const statusEl = document.getElementById('dashboardStatus');
    const listEl = document.getElementById('appsList');

    statusEl.style.display = 'block';
    listEl.style.display = 'none';
    listEl.innerHTML = '';

    try {
        const res = await fetch(`${API_BASE}/api/apps`, {
            headers: { 'Authorization': `Bearer ${userToken}` }
        });

        if (res.status === 401 || res.status === 403) {
            logout();
            return;
        }

        if (!res.ok) throw new Error("فشل تحميل قائمة التطبيقات");

        const apps = await res.json();
        
        if (apps.length === 0) {
            statusEl.innerHTML = `
                <div class="empty-dashboard-state">
                    <p>لم تقم بتقديم أي تطبيقات بعد.</p>
                    <a href="order.html" class="btn btn-primary">اضغط هنا لرفع تطبيقك الأول 🚀</a>
                </div>
            `;
            return;
        }

        statusEl.style.display = 'none';
        listEl.style.display = 'grid';

        apps.forEach(app => {
            const card = document.createElement('div');
            card.className = 'app-card';
            card.onclick = () => {
                window.location.href = `app_details.html?id=${app.id}`;
            };
            
            // Icon
            let iconHtml = '<div class="app-card-icon">📱</div>';
            if (app.icon_path) {
                const iconUrl = `${API_BASE}/api/apps/${app.id}/download/icon`;
                iconHtml = `<img src="" data-src="${iconUrl}" class="app-card-icon lazy-icon" alt="${app.title}">`;
            }

            // Plan translation
            let planText = app.plan_selection;
            if (app.plan_selection === 'basic') planText = 'الباقة الأساسية';
            else if (app.plan_selection === 'pro') planText = 'الباقة الاحترافية';
            else if (app.plan_selection === 'lifetime') planText = 'باقة مدى الحياة';
            else if (app.plan_selection === 'update') planText = 'تحديث';

            card.innerHTML = `
                <div class="app-card-header">
                    ${iconHtml}
                    <div class="app-card-info">
                        <h3 class="app-card-title">${app.title}</h3>
                        <span class="app-card-category">${app.category}</span>
                    </div>
                </div>
                <div class="app-card-body">
                    ${app.short_desc || 'لا يوجد وصف قصير لهذا التطبيق.'}
                </div>
                <div class="app-card-footer">
                    <span class="app-card-plan">${planText}</span>
                    <span style="font-size: 0.85rem; color: var(--text-light); font-weight: 700;">التفاصيل ➔</span>
                </div>
            `;
            
            listEl.appendChild(card);
        });

        // Lazy load icons with Auth header
        lazyLoadIcons();

    } catch (err) {
        console.error(err);
        statusEl.innerHTML = `<div class="error-message" style="padding: 2rem;">حدث خطأ أثناء جلب تطبيقاتك: ${err.message}</div>`;
    }
}

function lazyLoadIcons() {
    const icons = document.querySelectorAll('.lazy-icon');
    icons.forEach(img => {
        const src = img.getAttribute('data-src');
        if (!src) return;
        fetch(src, {
            headers: { 'Authorization': `Bearer ${userToken}` }
        })
        .then(res => {
            if (!res.ok) throw new Error();
            return res.blob();
        })
        .then(blob => {
            const objectURL = URL.createObjectURL(blob);
            img.src = objectURL;
        })
        .catch(() => {
            // Fallback to text icon if load fails
            const parent = img.parentNode;
            if (parent) {
                const placeholder = document.createElement('div');
                placeholder.className = 'app-card-icon';
                placeholder.textContent = '📱';
                parent.replaceChild(placeholder, img);
            }
        });
    });
}
