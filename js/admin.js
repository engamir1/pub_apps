/**
 * Admin Panel UI & Event Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    initializeAuth();
});

let adminToken = AuthService.getStoredToken();

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

    if (adminToken) {
        showDashboard();
    } else {
        showLogin();
    }
}

async function handleGoogleLoginClick() {
    const errorEl = document.getElementById('loginError');
    if (errorEl) errorEl.style.display = 'none';
    
    try {
        const result = await AuthService.signInWithGoogle();
        
        if (result.role !== 'admin') {
            throw new Error("عذراً، هذا الحساب غير مسجل كمسؤول نظام.");
        }

        AuthService.saveToken(result.accessToken);
        adminToken = result.accessToken;
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
        const result = await AuthService.signInOrSignUpWithEmail(email, password, 'signin');
        
        if (result.role !== 'admin') {
            throw new Error("عذراً، هذا الحساب مسجل كعضو عادي وليس مسؤول نظام.");
        }

        AuthService.saveToken(result.accessToken);
        adminToken = result.accessToken;
        showDashboard();
    } catch (err) {
        console.error(err);
        let errMsg = err.message;
        if (err.code === 'auth/invalid-email') {
            errMsg = "البريد الإلكتروني غير صالح.";
        } else if (err.code === 'auth/user-not-found') {
            errMsg = "لم يتم العثور على حساب المشرف بهذا البريد الإلكتروني.";
        } else if (err.code === 'auth/wrong-password') {
            errMsg = "كلمة المرور غير صحيحة.";
        } else if (err.code === 'auth/user-disabled') {
            errMsg = "حساب المشرف هذا معطل.";
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
    
    const userEmailDisplay = document.getElementById('userEmailDisplay');
    const headerLogoutBtn = document.getElementById('headerLogoutBtn');
    if (userEmailDisplay) userEmailDisplay.style.display = 'none';
    if (headerLogoutBtn) headerLogoutBtn.style.display = 'none';
}

function showDashboard() {
    document.getElementById('loginWrapper').style.display = 'none';
    document.getElementById('dashboardWrapper').style.display = 'block';
    
    const payload = AuthService.decodeToken(adminToken);
    const email = payload ? payload.email : "مسؤول النظام";
    
    if (payload && payload.role !== 'admin') {
        logout();
        return;
    }
    
    document.getElementById('userEmail').textContent = email;
    
    const userEmailDisplay = document.getElementById('userEmailDisplay');
    const headerLogoutBtn = document.getElementById('headerLogoutBtn');
    if (userEmailDisplay) {
        userEmailDisplay.textContent = email;
        userEmailDisplay.style.display = 'inline-block';
    }
    if (headerLogoutBtn) headerLogoutBtn.style.display = 'inline-block';

    loadOrders();
}

async function logout() {
    await AuthService.logout();
    adminToken = null;
    showLogin();
}

let activeAdminTab = 'requests';
let allOrders = [];

function switchAdminTab(tabName) {
    activeAdminTab = tabName;
    const tabRequestsBtn = document.getElementById('tabRequestsBtn');
    const tabPaymentsBtn = document.getElementById('tabPaymentsBtn');
    
    if (tabRequestsBtn && tabPaymentsBtn) {
        if (tabName === 'requests') {
            tabRequestsBtn.classList.add('active');
            tabPaymentsBtn.classList.remove('active');
        } else {
            tabPaymentsBtn.classList.add('active');
            tabRequestsBtn.classList.remove('active');
        }
    }
    renderActiveTab();
}

async function loadOrders() {
    const statusEl = document.getElementById('tableStatus');
    const containerEl = document.getElementById('tableContainer');
    const bodyEl = document.getElementById('ordersGrid');

    statusEl.style.display = 'block';
    containerEl.style.display = 'none';
    bodyEl.innerHTML = '';

    try {
        const res = await fetch(`${API_BASE}/api/orders`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });

        if (res.status === 401 || res.status === 403) {
            logout();
            return;
        }

        if (!res.ok) throw new Error("فشل جلب قائمة الطلبات");

        allOrders = await res.json();
        
        if (allOrders.length === 0) {
            statusEl.innerHTML = '<div style="padding: 2rem;">لا توجد طلبات نشر حالية.</div>';
            return;
        }

        statusEl.style.display = 'none';
        containerEl.style.display = 'block';

        renderActiveTab();

    } catch (err) {
        console.error(err);
        statusEl.innerHTML = `<div class="error-message" style="padding: 2rem;">حدث خطأ: ${err.message}</div>`;
    }
}

function renderActiveTab() {
    const statusEl = document.getElementById('tableStatus');
    const containerEl = document.getElementById('tableContainer');
    const bodyEl = document.getElementById('ordersGrid');

    bodyEl.innerHTML = '';

    // Filter orders based on active tab
    let filteredOrders = [];
    if (activeAdminTab === 'requests') {
        filteredOrders = allOrders.filter(order => order.status === 'pending' || order.status === 'published');
    } else if (activeAdminTab === 'payments') {
        filteredOrders = allOrders.filter(order => order.status === 'paid');
    }

    if (filteredOrders.length === 0) {
        if (activeAdminTab === 'requests') {
            bodyEl.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 40px; font-weight: 800; color: var(--text-light); background: white; border: 3px solid var(--border-color); border-radius: 12px; box-shadow: var(--shadow-flat);">
                    📋 لا توجد طلبات معلقة أو قيد الانتظار حالياً.
                </div>
            `;
        } else {
            bodyEl.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 40px; font-weight: 800; color: var(--text-light); background: white; border: 3px solid var(--border-color); border-radius: 12px; box-shadow: var(--shadow-flat);">
                    💸 لا توجد مدفوعات مستلمة أو مكتملة بعد.
                </div>
            `;
        }
        return;
    }

    // Prepend financial overview cards if payments tab is selected
    if (activeAdminTab === 'payments') {
        const totalRevenue = filteredOrders.reduce((sum, o) => sum + (o.total_price || 0), 0);
        const totalCount = filteredOrders.length;

        const summaryCard = document.createElement('div');
        summaryCard.style.gridColumn = '1 / -1';
        summaryCard.style.display = 'grid';
        summaryCard.style.gridTemplateColumns = 'repeat(auto-fit, minmax(280px, 1fr))';
        summaryCard.style.gap = '20px';
        summaryCard.style.marginBottom = '25px';

        summaryCard.innerHTML = `
            <div style="background: #ecfdf5; border: 3px solid var(--border-color); border-radius: 12px; padding: 25px; box-shadow: var(--shadow-flat-sm); display: flex; flex-direction: column; gap: 8px;">
                <span style="font-size: 1rem; font-weight: 800; color: #065f46;">💰 إجمالي الإيرادات المحصلة</span>
                <span style="font-size: 2.3rem; font-weight: 800; color: var(--text-dark);">${totalRevenue} ج.م</span>
            </div>
            <div style="background: #eff6ff; border: 3px solid var(--border-color); border-radius: 12px; padding: 25px; box-shadow: var(--shadow-flat-sm); display: flex; flex-direction: column; gap: 8px;">
                <span style="font-size: 1rem; font-weight: 800; color: #1e40af;">✅ عمليات الدفع المؤكدة</span>
                <span style="font-size: 2.3rem; font-weight: 800; color: var(--text-dark);">${totalCount} عملية</span>
            </div>
        `;
        bodyEl.appendChild(summaryCard);
    }

    filteredOrders.forEach(order => {
        const card = document.createElement('div');
        card.className = 'order-card';

        // Format date
        const date = new Date(order.created_at);
        const formattedDate = date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });

        // Payment date (if paid)
        let paymentDateHtml = '';
        if (order.status === 'paid' && (order.paid_at || order.updated_at)) {
            const payDate = new Date(order.paid_at || order.updated_at);
            const formattedPayDate = payDate.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            paymentDateHtml = `<div style="font-size: 0.85rem; color: var(--accent-green); font-weight: 800; margin-top: 5px;">📅 تأكيد الدفع: ${formattedPayDate}</div>`;
        }

        // Status badge
        let statusBadge = '';
        let deadlineHtml = '';

        if (order.status === 'pending') {
            statusBadge = '<span class="badge-status badge-pending">بانتظار المراجعة</span>';
        } else if (order.status === 'published') {
            statusBadge = '<span class="badge-status badge-published">تم النشر (غير مدفوع)</span>';

            // Calculate remaining deadline time
            const deadline = new Date(order.payment_deadline);
            const now = new Date();
            const timeDiff = deadline - now;
            const daysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24));

            if (daysLeft > 0) {
                deadlineHtml = `<span class="deadline-text deadline-active">متبقي ${daysLeft} أيام للسداد</span>`;
            } else {
                deadlineHtml = `<span class="deadline-text deadline-overdue">متأخر عن السداد! ⚠️</span>`;
            }
        } else if (order.status === 'paid') {
            statusBadge = '<span class="badge-status badge-paid">تم السداد بنجاح</span>';
        } else if (order.status === 'deleted') {
            statusBadge = '<span class="badge-status badge-deleted">تم حذف التطبيق</span>';
        }

        // Files Column
        let filesHtml = '';
        if (order.icon_path) {
            filesHtml += `<a href="/api/orders/${order.id}/download/icon" class="btn-file" target="_blank" onclick="appendToken(this, event)">🖼️ أيقونة</a>`;
        }
        if (order.feature_path) {
            filesHtml += `<a href="/api/orders/${order.id}/download/feature" class="btn-file" target="_blank" onclick="appendToken(this, event)">🌟 مميزة</a>`;
        }
        if (order.screenshots_paths && order.screenshots_paths.length > 0) {
            order.screenshots_paths.forEach((_, idx) => {
                filesHtml += `<a href="/api/orders/${order.id}/download/screenshot_${idx + 1}" class="btn-file" target="_blank" onclick="appendToken(this, event)">📸 لقطة ${idx + 1}</a>`;
            });
        }
        if (order.aab_path) {
            filesHtml += `<a href="/api/orders/${order.id}/download/aab" class="btn-file" target="_blank" onclick="appendToken(this, event)" style="background-color: var(--secondary); border-color: var(--secondary); color: white;">📦 حزمة AAB</a>`;
        }

        // Primary actions based on status
        let primaryActionsHtml = '';
        if (order.status === 'pending') {
            primaryActionsHtml = `<button class="btn-action btn-publish" onclick="updateStatus(${order.id}, 'published')">🚀 اعتماد ونشر بالمتجر</button>`;
        } else if (order.status === 'published') {
            primaryActionsHtml = `
                <button class="btn-action btn-pay" onclick="updateStatus(${order.id}, 'paid')">💸 تأكيد استلام الدفع</button>
                <button class="btn-action btn-delete" onclick="updateStatus(${order.id}, 'deleted')">🛑 تعطيل التطبيق</button>
            `;
        }

        // Notes Column (Admin Feedback edit area)
        const notesText = order.admin_notes || '';
        const notesHtml = `
            <div style="display: flex; flex-direction: column; gap: 8px; width: 100%;">
                <textarea id="notes-${order.id}" class="notes-textarea" placeholder="مثال: يرجى رفع صورة أيقونة بجودة أعلى...">${notesText}</textarea>
                <button class="btn-save-notes" onclick="saveNotes(${order.id})">حفظ الملاحظة 💾</button>
            </div>
        `;

        // Plan display name
        let planDisp = order.plan_selection;
        if (order.plan_selection === 'basic') planDisp = 'الباقة الأساسية';
        else if (order.plan_selection === 'pro') planDisp = 'الباقة الاحترافية';
        else if (order.plan_selection === 'lifetime') planDisp = 'باقة مدى الحياة';
        else if (order.plan_selection === 'update') planDisp = 'تحديث إصدار 🚀';

        // Clickable App Title for Admin
        let appTitleHtml = '';
        if (order.app_id) {
            appTitleHtml = `<a href="app_details.html?id=${order.app_id}" target="_blank" class="app-title-link" title="عرض تفاصيل التطبيق والتحديثات بالكامل">${order.app_title}</a>`;
        } else {
            appTitleHtml = `<span class="app-title-static">${order.app_title}</span>`;
        }

        card.innerHTML = `
            <!-- Header -->
            <div class="order-card-header">
                <div class="order-card-id-wrapper">
                    <span class="order-id">طلب #${order.id}</span>
                    <span class="order-date">${formattedDate}</span>
                </div>
                <div class="status-deadline-box">
                    ${statusBadge}
                    ${deadlineHtml}
                    ${paymentDateHtml}
                </div>
            </div>

            <!-- Body -->
            <div class="order-card-middle">
                <div class="order-card-body">
                    <!-- App Info -->
                    <div class="app-info-row">
                        ${appTitleHtml}
                        <div class="app-meta">
                            <span class="app-category-badge">📂 ${order.app_category || 'وراثة من التطبيق الأب'}</span>
                            <span class="app-plan-badge">💎 ${planDisp}</span>
                            ${order.plan_selection === 'update' ? `<span class="app-version-badge" style="background: #fff1f2; color: var(--secondary);">نسخة: ${order.app_version || '1.0.0'}</span>` : `<span class="app-version-badge">نسخة: ${order.app_version || '1.0.0'}</span>`}
                        </div>
                        ${order.changelog ? `<div class="changelog-box"><strong>📝 التغييرات الجديدة:</strong><br>${order.changelog}</div>` : ''}
                    </div>

                    <!-- Client Info -->
                    <div class="client-info-row">
                        <div class="client-name">👤 العميل: ${order.dev_name}</div>
                        <div class="client-contacts">
                            <a href="https://wa.me/${order.dev_phone.replace(/[+\s]/g, '')}" target="_blank" class="contact-btn contact-whatsapp" title="تواصل عبر واتساب">
                                💬 واتساب
                            </a>
                            <a href="mailto:${order.dev_email}" class="contact-btn contact-email" title="تراسل بالبريد">
                                ✉️ البريد الإلكتروني
                            </a>
                            <a href="tel:${order.dev_phone}" class="contact-btn contact-phone" title="اتصال هاتفي">
                                📞 ${order.dev_phone}
                            </a>
                        </div>
                    </div>

                    <!-- Price -->
                    <div class="price-status-row">
                        <div class="price-box">
                            <span class="price-label">السعر المستحق</span>
                            <span class="price-amount">${order.total_price} ج.م</span>
                        </div>
                    </div>

                    <!-- Attached Files -->
                    <div class="files-row">
                        <span class="files-label">📎 الملفات المرفقة:</span>
                        <div class="files-list">
                            ${filesHtml || '<span style="color: var(--text-light); font-size: 0.85rem; font-weight:700;">لا توجد ملفات مرفقة</span>'}
                        </div>
                    </div>

                    <!-- Notes -->
                    <div class="notes-row">
                        <span class="notes-label">📢 ملاحظات وتنبيهات العميل:</span>
                        ${notesHtml}
                    </div>
                </div>

                <!-- Actions Footer -->
                <div class="card-actions-wrapper">
                    <!-- Status specific actions (Primary) -->
                    ${primaryActionsHtml ? `<div class="primary-actions ${order.status === 'pending' ? 'single-action' : ''}">${primaryActionsHtml}</div>` : ''}
                    
                    <!-- App details and chat (Secondary) -->
                    <div class="secondary-actions">
                        ${order.app_id ? `
                            <a href="app_details.html?id=${order.app_id}" class="btn-action btn-details" target="_blank">
                                📱 تفاصيل التطبيق
                            </a>
                            <button class="btn-action btn-chat" onclick="openAdminChat(${order.app_id}, '${order.app_title.replace(/'/g, "\\'")}')">
                                💬 شات الدعم
                            </button>
                        ` : '<span style="color: var(--text-light); font-size: 0.8rem; text-align: center; grid-column: span 2; font-weight:700;">طلب قديم غير مرتبط بتطبيق</span>'}
                    </div>

                    <!-- Delete action -->
                    <div class="danger-action">
                        <button class="btn-action btn-danger" onclick="deleteOrderPermanently(${order.id})">
                            🗑️ حذف نهائي للطلب
                        </button>
                    </div>
                </div>
            </div>
        `;

        bodyEl.appendChild(card);
    });
}

// Appends the JWT token to URL for file download requests
function appendToken(anchor, e) {
    e.preventDefault();
    let targetUrl = anchor.getAttribute('href');
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        const base = API_BASE || window.location.origin;
        targetUrl = base + targetUrl;
    }
    const url = new URL(targetUrl);
    
    // Standard fetch call with Auth headers to download the file directly
    fetch(url, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
    })
    .then(res => {
        if (res.status === 401 || res.status === 403) {
            logout();
            return;
        }
        if (!res.ok) throw new Error("فشل تحميل الملف");
        return res.blob();
    })
    .then(blob => {
        if (!blob) return;
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        
        const pathParts = url.pathname.split('/');
        const key = pathParts[pathParts.length - 1];
        a.download = key === 'aab' ? 'app_bundle.aab' : `${key}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
    })
    .catch(err => {
        console.error(err);
        alert("حدث خطأ أثناء تحميل الملف.");
    });
}

async function updateStatus(orderId, newStatus) {
    let confirmMsg = `هل أنت متأكد من تغيير حالة الطلب #${orderId} إلى `;
    if (newStatus === 'published') confirmMsg += "منشور؟ (سيتم إرسال إيميل الدفع للمطور وبدء مهلة الـ 3 أيام)";
    else if (newStatus === 'paid') confirmMsg += "مدفوع بالكامل؟";
    else if (newStatus === 'deleted') confirmMsg += "معطل؟";

    if (!confirm(confirmMsg)) return;

    try {
        const res = await fetch(`${API_BASE}/api/orders/${orderId}/status`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ status: newStatus })
        });

        if (!res.ok) throw new Error("فشل تحديث حالة الطلب");

        loadOrders();
    } catch (err) {
        console.error(err);
        alert("خطأ: " + err.message);
    }
}

async function saveNotes(orderId) {
    const notesText = document.getElementById(`notes-${orderId}`).value;

    try {
        const res = await fetch(`${API_BASE}/api/orders/${orderId}/notes`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ notes: notesText })
        });

        if (!res.ok) throw new Error("فشل حفظ الملاحظات");
        
        alert("تم حفظ الملاحظة وإرسال التنبيه لعضو النظام بنجاح.");
        loadOrders();
    } catch (err) {
        console.error(err);
        alert("خطأ: " + err.message);
    }
}

async function deleteOrderPermanently(orderId) {
    const confirmMsg = `🚨 تحذير هام جداً! 🚨\n\nهل أنت متأكد من حذف الطلب #${orderId} نهائياً؟\nسيؤدي ذلك إلى حذف الطلب من قاعدة البيانات نهائياً وحذف جميع ملفات التطبيق (AAB، الأيقونة، لقطات الشاشة) بالكامل من القرص المحلي ومن مساحة التخزين السحابية Cloudflare R2! هذا الإجراء لا يمكن التراجع عنه.`;
    if (!confirm(confirmMsg)) return;
    
    try {
        const res = await fetch(`${API_BASE}/api/orders/${orderId}`, {
            method: 'DELETE',
            headers: { 
                'Authorization': `Bearer ${adminToken}`
            }
        });
        
        if (!res.ok) throw new Error("فشل حذف الطلب نهائياً");
        
        const data = await res.json();
        alert(data.detail || "تم حذف الطلب وملفاته نهائياً بنجاح");
        loadOrders();
    } catch (err) {
        console.error(err);
        alert("خطأ: " + err.message);
    }
}

// ------------------ ADMIN CHAT LOGIC (Stage 5) ------------------

let currentChatAppId = null;
let adminChatInterval = null;

function openAdminChat(appId, appTitle) {
    if (!appId) {
        alert("هذا الطلب قديم وغير مرتبط بتطبيق حالي.");
        return;
    }
    currentChatAppId = appId;
    document.getElementById('adminChatTitle').textContent = `شات دعم التطبيق: ${appTitle}`;
    document.getElementById('adminChatModal').style.display = 'flex';
    fetchAdminChatMessages();
    
    if (!adminChatInterval) {
        adminChatInterval = setInterval(fetchAdminChatMessages, 5000);
    }
}

function closeAdminChat() {
    document.getElementById('adminChatModal').style.display = 'none';
    currentChatAppId = null;
    if (adminChatInterval) {
        clearInterval(adminChatInterval);
        adminChatInterval = null;
    }
}

async function fetchAdminChatMessages() {
    if (!currentChatAppId) return;
    const chatContainer = document.getElementById('adminChatMessages');
    
    try {
        const res = await fetch(`${API_BASE}/api/apps/${currentChatAppId}/messages`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        
        if (!res.ok) throw new Error();
        const messages = await res.json();
        
        if (messages.length === 0) {
            chatContainer.innerHTML = `
                <div style="text-align: center; color: var(--text-light); padding: 40px; font-weight:700;">
                    لا توجد رسائل سابقة في هذا الشات.
                </div>
            `;
            return;
        }

        const isAtBottom = chatContainer.scrollHeight - chatContainer.clientHeight <= chatContainer.scrollTop + 50;
        chatContainer.innerHTML = '';
        
        messages.forEach(msg => {
            const bubble = document.createElement('div');
            const isAdmin = msg.sender_role === 'admin';
            
            // Stylings
            bubble.style.border = '2px solid var(--border-color)';
            bubble.style.boxShadow = '2px 2px 0px var(--border-color)';
            bubble.style.borderRadius = '10px';
            bubble.style.padding = '12px 16px';
            bubble.style.maxWidth = '75%';
            bubble.style.fontWeight = '600';
            bubble.style.fontSize = '0.95rem';
            bubble.style.lineHeight = '1.5';
            
            if (isAdmin) {
                // Sent by admin -> align right (sent style)
                bubble.style.alignSelf = 'flex-start';
                bubble.style.backgroundColor = '#e0e7ff';
                bubble.style.borderTopLeftRadius = '0';
            } else {
                // Sent by user -> align left (received style)
                bubble.style.alignSelf = 'flex-end';
                bubble.style.backgroundColor = '#ffffff';
                bubble.style.borderTopRightRadius = '0';
            }
            
            const date = new Date(msg.created_at);
            const timeStr = date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
            
            bubble.innerHTML = `
                <div class="chat-message-content">${msg.content}</div>
                <div class="chat-message-meta" style="display: flex; justify-content: space-between; align-items: center; gap: 10px; font-size: 0.75rem; color: var(--text-light); margin-top: 6px; font-weight: 700;">
                    <span class="chat-sender-name" style="${isAdmin ? 'color:#4f46e5; font-weight:800;' : 'color:#10b981; font-weight:800;'}">${msg.sender_name}</span>
                    <span>${timeStr}</span>
                </div>
            `;
            
            chatContainer.appendChild(bubble);
        });

        if (isAtBottom || chatContainer.children.length <= messages.length) {
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
    } catch (e) {
        console.error(e);
    }
}

async function handleSendAdminChat(event) {
    event.preventDefault();
    if (!currentChatAppId) return;
    
    const inputEl = document.getElementById('txtAdminChatInput');
    const content = inputEl.value.trim();
    if (!content) return;
    
    inputEl.value = '';
    
    try {
        const res = await fetch(`${API_BASE}/api/apps/${currentChatAppId}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ content: content })
        });
        
        if (!res.ok) throw new Error("فشل إرسال الرسالة");
        fetchAdminChatMessages();
    } catch (err) {
        console.error(err);
        alert(err.message);
    }
}
