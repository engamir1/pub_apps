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

async function deleteOrder(orderId, orderTitle, versionName) {
    const confirmed = confirm(`هل أنت متأكد من حذف طلب الإصدار ${versionName} من تطبيق "${orderTitle}"?\n\nتحذير: سيتم حذف الطلب نهائياً ولا يمكن التراجع عنه.`);
    if (!confirmed) return;

    try {
        const res = await fetch(`${API_BASE}/api/orders/${orderId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${userToken}` }
        });

        if (res.status === 401 || res.status === 403) {
            alert('ليس لديك صلاحية حذف هذا الطلب.');
            return;
        }
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || `خطأ ${res.status}`);
        }

        // Reload dashboard after successful deletion
        loadUserOrders();
    } catch (err) {
        console.error(err);
        alert(`حدث خطأ أثناء الحذف: ${err.message}`);
    }
}

async function loadUserOrders() {
    const statusEl = document.getElementById('dashboardStatus');
    const listEl = document.getElementById('ordersList');

    statusEl.style.display = 'block';
    listEl.style.display = 'none';
    listEl.innerHTML = '';

    try {
        const res = await fetch(`${API_BASE}/api/orders`, {
            headers: { 'Authorization': `Bearer ${userToken}` }
        });

        if (res.status === 401 || res.status === 403) {
            logout();
            return;
        }

        if (!res.ok) throw new Error("فشل تحميل طلبات النشر");

        const orders = await res.json();
        
        if (orders.length === 0) {
            statusEl.innerHTML = `
                <div class="empty-dashboard-state">
                    <p>لم تقم بتقديم أي طلبات نشر بعد.</p>
                    <a href="order.html" class="btn btn-primary">اضغط هنا لرفع تطبيقك الأول 🚀</a>
                </div>
            `;
            return;
        }

        statusEl.style.display = 'none';
        listEl.style.display = 'flex';
        listEl.style.flexDirection = 'column';

        // 1. Group orders by app_title
        const appGroups = {};
        orders.forEach(order => {
            const title = order.app_title;
            if (!appGroups[title]) {
                appGroups[title] = [];
            }
            appGroups[title].push(order);
        });

        // 2. Render each group as an accordion
        Object.keys(appGroups).forEach(appTitle => {
            const groupOrders = appGroups[appTitle];
            // Sort by id descending (newest version first)
            groupOrders.sort((a, b) => b.id - a.id);
            
            const latestOrder = groupOrders[0];
            const accordion = document.createElement('div');
            accordion.className = 'app-accordion';
            
            // Latest status badge
            let latestStatusBadge = '';
            if (latestOrder.status === 'pending') {
                latestStatusBadge = '<span class="badge-status badge-pending">قيد المراجعة</span>';
            } else if (latestOrder.status === 'published') {
                latestStatusBadge = '<span class="badge-status badge-published">بانتظار السداد</span>';
            } else if (latestOrder.status === 'paid') {
                latestStatusBadge = '<span class="badge-status badge-paid">نشط ومنشور</span>';
            } else if (latestOrder.status === 'deleted') {
                latestStatusBadge = '<span class="badge-status badge-deleted">محذوف</span>';
            }

            // Build accordion header
            const headerDiv = document.createElement('div');
            headerDiv.className = 'app-accordion-header';
            headerDiv.innerHTML = `
                <div class="app-accordion-title-sec">
                    <span class="app-accordion-icon">📱</span>
                    <div>
                        <h3 class="app-accordion-name">${appTitle}</h3>
                        <span class="app-category-badge">${latestOrder.app_category || 'تطبيق منشور'}</span>
                    </div>
                </div>
                <div class="app-accordion-actions">
                    <span style="font-weight: 800; font-size: 0.9rem; color: var(--text-light);">
                        آخر إصدار: ${latestOrder.app_version || '1.0.0'}
                    </span>
                    ${latestStatusBadge}
                    <button class="btn btn-primary nav-btn" style="padding: 6px 14px; font-size: 0.85rem;" 
                            onclick="event.stopPropagation(); window.location.href='order.html?plan=update&app=${encodeURIComponent(appTitle)}'">
                        رفع تحديث جديد 🚀
                    </button>
                    <span class="app-accordion-toggle-indicator">▼</span>
                </div>
            `;

            // Toggle accordion expand/collapse
            headerDiv.addEventListener('click', () => {
                accordion.classList.toggle('active');
            });

            // Build accordion body (version timeline)
            const bodyDiv = document.createElement('div');
            bodyDiv.className = 'app-accordion-body';
            
            const logList = document.createElement('div');
            logList.className = 'version-log-list';

            groupOrders.forEach(order => {
                const verItem = document.createElement('div');
                verItem.className = 'version-item';

                const date = new Date(order.created_at);
                const formattedDate = date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });

                // Status badge for this specific version
                let verStatusBadge = '';
                let deadlineHtml = '';
                if (order.status === 'pending') {
                    verStatusBadge = '<span class="badge-status badge-pending">بانتظار البدء والمراجعة</span>';
                } else if (order.status === 'published') {
                    verStatusBadge = '<span class="badge-status badge-published">تم النشر (غير مدفوع)</span>';
                    
                    const deadline = new Date(order.payment_deadline);
                    const now = new Date();
                    const daysLeft = Math.ceil((deadline - now) / (1000 * 3600 * 24));
                    
                    if (daysLeft > 0) {
                        deadlineHtml = `
                            <div class="deadline-box deadline-active" style="margin-top: 10px;">
                                ⚠️ تم النشر بنجاح! يرجى سداد التكلفة عبر InstaPay خلال ${daysLeft} أيام لتفادي الإيقاف.
                            </div>
                        `;
                    } else {
                        deadlineHtml = `
                            <div class="deadline-box deadline-overdue" style="margin-top: 10px;">
                                🚨 متأخر عن السداد! يرجى تحويل التكلفة فوراً لتفادي حذف التطبيق.
                            </div>
                        `;
                    }
                } else if (order.status === 'paid') {
                    verStatusBadge = '<span class="badge-status badge-paid">تم السداد ونشط بالمتجر</span>';
                } else if (order.status === 'deleted') {
                    verStatusBadge = '<span class="badge-status badge-deleted">تم حذف الإصدار</span>';
                }

                // Changelog html (for updates)
                let changelogHtml = '';
                if (order.plan_selection === 'update' && order.changelog) {
                    changelogHtml = `
                        <div class="changelog-box">
                            <div class="changelog-title">📋 التغييرات في هذا الإصدار:</div>
                            <div style="line-height: 1.5;">${order.changelog}</div>
                        </div>
                    `;
                }

                // Admin notes
                let notesHtml = '';
                if (order.admin_notes && order.admin_notes.trim() !== '') {
                    notesHtml = `
                        <div class="admin-notes-box" style="margin-top: 12px;">
                            <div class="admin-notes-title">💬 رسالة من المشرف:</div>
                            <div class="admin-notes-content">${order.admin_notes}</div>
                        </div>
                    `;
                }

                // Plan display name
                let planDisp = order.plan_selection;
                if (order.plan_selection === 'basic') planDisp = 'الباقة الأساسية';
                else if (order.plan_selection === 'pro') planDisp = 'الباقة الاحترافية';
                else if (order.plan_selection === 'lifetime') planDisp = 'باقة مدى الحياة';
                else if (order.plan_selection === 'update') planDisp = 'تحديث إصدار';

                verItem.innerHTML = `
                    <div class="version-item-header">
                        <div>
                            <span class="version-name-tag">إصدار نسخة: ${order.app_version || '1.0.0'}</span>
                            <span style="color: var(--text-light); margin-right: 15px; font-size: 0.85rem;">(${planDisp})</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            ${verStatusBadge}
                            ${order.status === 'pending' ? `
                            <button
                                onclick="deleteOrder(${order.id}, '${appTitle.replace(/'/g, "\\'").replace(/"/g, '&quot;')}', '${(order.app_version || '1.0.0').replace(/'/g, "\\'")}')"
                                style="background: #fff0f0; color: #dc2626; border: 2px solid #dc2626; border-radius: 6px; padding: 5px 12px; font-weight: 800; font-size: 0.8rem; cursor: pointer; font-family: inherit;"
                                onmouseover="this.style.background='#dc2626';this.style.color='#fff'"
                                onmouseout="this.style.background='#fff0f0';this.style.color='#dc2626'">
                                🗑️ حذف الطلب
                            </button>` : ''}
                        </div>
                    </div>
                    
                    <div class="order-meta-grid" style="grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px;">
                        <div class="meta-item">
                            <span class="meta-label">تاريخ الطلب</span>
                            <span class="meta-value" style="font-size: 0.95rem;">${formattedDate}</span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-label">التكلفة</span>
                            <span class="meta-value" style="color: var(--success); font-size: 0.95rem;">${order.total_price} ج.م</span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-label">معرف الطلب (ID)</span>
                            <span class="meta-value" style="font-size: 0.95rem;">#${order.id}</span>
                        </div>
                    </div>

                    ${changelogHtml}
                    ${deadlineHtml}
                    ${notesHtml}
                `;

                logList.appendChild(verItem);
            });

            bodyDiv.appendChild(logList);
            accordion.appendChild(headerDiv);
            accordion.appendChild(bodyDiv);
            listEl.appendChild(accordion);
        });

    } catch (err) {
        console.error(err);
        statusEl.innerHTML = `<div class="error-message" style="padding: 2rem;">حدث خطأ أثناء جلب طلباتك: ${err.message}</div>`;
    }
}
