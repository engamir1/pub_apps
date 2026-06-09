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

async function loadOrders() {
    const statusEl = document.getElementById('tableStatus');
    const containerEl = document.getElementById('tableContainer');
    const bodyEl = document.getElementById('ordersBody');

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

        const orders = await res.json();
        
        if (orders.length === 0) {
            statusEl.innerHTML = '<div style="padding: 2rem;">لا توجد طلبات نشر حالية.</div>';
            return;
        }

        statusEl.style.display = 'none';
        containerEl.style.display = 'block';

        orders.forEach(order => {
            const tr = document.createElement('tr');
            
            // Format date
            const date = new Date(order.created_at);
            const formattedDate = date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
            
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
                filesHtml += `<a href="/api/orders/${order.id}/download/icon" class="btn-file" target="_blank" onclick="appendToken(this, event)">أيقونة</a>`;
            }
            if (order.feature_path) {
                filesHtml += `<a href="/api/orders/${order.id}/download/feature" class="btn-file" target="_blank" onclick="appendToken(this, event)">مميزة</a>`;
            }
            if (order.screenshots_paths && order.screenshots_paths.length > 0) {
                order.screenshots_paths.forEach((_, idx) => {
                    filesHtml += `<a href="/api/orders/${order.id}/download/screenshot_${idx + 1}" class="btn-file" target="_blank" onclick="appendToken(this, event)">لقطة ${idx + 1}</a>`;
                });
            }
            if (order.aab_path) {
                filesHtml += `<a href="/api/orders/${order.id}/download/aab" class="btn-file" target="_blank" onclick="appendToken(this, event)" style="background-color: var(--secondary); border-color: var(--secondary);">حزمة AAB</a>`;
            }

            // Actions Column
            let actionsHtml = '<div style="display: flex; flex-direction: column; gap: 5px;">';
            if (order.status === 'pending') {
                actionsHtml += `<button class="btn-action btn-publish" onclick="updateStatus(${order.id}, 'published')">تم النشر بالمتجر</button>`;
            } else if (order.status === 'published') {
                actionsHtml += `<button class="btn-action btn-pay" onclick="updateStatus(${order.id}, 'paid')">تأكيد استلام الدفع</button>`;
                actionsHtml += `<button class="btn-action btn-delete" onclick="updateStatus(${order.id}, 'deleted')">تعطيل التطبيق</button>`;
            }
            // Add permanent delete button always
            actionsHtml += `<button class="btn-action btn-delete" style="background-color: #b91c1c; border-color: #991b1b; color: white;" onclick="deleteOrderPermanently(${order.id})">حذف نهائي 🗑️</button>`;
            actionsHtml += '</div>';

            // Notes Column (Admin Feedback edit area)
            const notesText = order.admin_notes || '';
            const notesHtml = `
                <div style="display: flex; flex-direction: column;">
                    <textarea id="notes-${order.id}" class="notes-textarea" placeholder="مثال: يرجى رفع صورة أيقونة بجودة أعلى...">${notesText}</textarea>
                    <button class="btn-save-notes" onclick="saveNotes(${order.id})">حفظ الملاحظة</button>
                </div>
            `;

            // Plan display name
            let planDisp = order.plan_selection;
            if (order.plan_selection === 'basic') planDisp = 'الباقة الأساسية';
            else if (order.plan_selection === 'pro') planDisp = 'الباقة الاحترافية';
            else if (order.plan_selection === 'lifetime') planDisp = 'باقة مدى الحياة';
            else if (order.plan_selection === 'update') planDisp = 'تحديث إصدار 🚀';

            tr.innerHTML = `
                <td>#${order.id}</td>
                <td>${formattedDate}</td>
                <td>
                    <strong>${order.dev_name}</strong><br>
                    <small style="color: var(--text-secondary);">${order.dev_phone}</small><br>
                    <small style="color: var(--text-secondary);">${order.dev_email}</small>
                </td>
                <td>
                    <strong>${order.app_title}</strong><br>
                    <small style="color: var(--text-secondary);">${order.app_category || 'وراثة من التطبيق الأب'}</small>
                    ${order.plan_selection === 'update' ? `<br><small style="color: var(--secondary); font-weight: 800;">نسخة: ${order.app_version || '1.0.0'}</small>` : `<br><small style="color: var(--primary); font-weight: 800;">نسخة: ${order.app_version || '1.0.0'}</small>`}
                    ${order.changelog ? `<br><div style="font-size: 0.8rem; background: #fffbeb; border: 1px solid #b45309; padding: 6px; border-radius: 4px; margin-top: 4px; color: #b45309; line-height: 1.4;"><strong>التغييرات:</strong> ${order.changelog}</div>` : ''}
                </td>
                <td>${planDisp}</td>
                <td><strong>${order.total_price} ج.م</strong></td>
                <td>
                    ${statusBadge}
                    ${deadlineHtml}
                </td>
                <td>${filesHtml || 'بدون ملفات'}</td>
                <td>${notesHtml}</td>
                <td>${actionsHtml}</td>
            `;
            
            bodyEl.appendChild(tr);
        });

    } catch (err) {
        console.error(err);
        statusEl.innerHTML = `<div class="error-message" style="padding: 2rem;">حدث خطأ: ${err.message}</div>`;
    }
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
