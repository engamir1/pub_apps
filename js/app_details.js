// Detect backend URL
if (typeof API_BASE === 'undefined') {
    window.API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? (window.location.port === '8001' ? '' : 'http://localhost:8001')
      : 'http://localhost:8001';
}

const userToken = localStorage.getItem('admin_token');

// Redirect if not logged in
if (!userToken) {
    window.location.href = 'dashboard.html';
}

// Extract app ID from URL query
const urlParams = new URLSearchParams(window.location.search);
const appId = parseInt(urlParams.get('id'));

if (isNaN(appId)) {
    window.location.href = 'dashboard.html';
}

let appData = null;
let chatInterval = null;
let activeTab = 'details';

// File upload state for updates and metadata
let fileState = {
    icon: null,
    feature: null,
    screenshots: [],
    aab: null
};

document.addEventListener('DOMContentLoaded', () => {
    fetchAppDetails();
    setupHeaderUserInfo();
    
    // Update back link if the logged-in user is an admin
    try {
        const payload = JSON.parse(atob(userToken.split('.')[1]));
        if (payload && payload.role === 'admin') {
            const backLink = document.querySelector('.back-link');
            if (backLink) {
                backLink.href = 'admin.html';
                backLink.innerHTML = '<span>🔙 العودة للوحة الإدارة</span>';
            }
        }
    } catch (e) {
        console.error(e);
    }
    
    // Setup Dropzones
    setupDropzone('dropzoneIcon', 'fileIcon', 'icon', false, 'previewIcon');
    setupDropzone('dropzoneFeature', 'fileFeature', 'feature', false, 'previewFeature');
    setupDropzone('dropzoneScreenshots', 'fileScreenshots', 'screenshots', true, 'previewScreenshots');
    setupDropzone('dropzoneAAB', 'fileAAB', 'aab', false, 'previewAAB');
});

// Setup User Info Display in Header
function setupHeaderUserInfo() {
    try {
        const payload = JSON.parse(atob(userToken.split('.')[1]));
        const email = payload ? payload.email : "";
        const role = payload ? payload.role : "user";
        const userEmailDisplay = document.getElementById('userEmailDisplay');
        const headerLogoutBtn = document.getElementById('headerLogoutBtn');
        const headerOrderBtn = document.getElementById('headerOrderBtn');
        
        if (userEmailDisplay && email) {
            userEmailDisplay.textContent = email;
            userEmailDisplay.title = email;
            userEmailDisplay.style.display = 'inline-block';
        }
        if (headerLogoutBtn) headerLogoutBtn.style.display = 'inline-block';
        if (headerOrderBtn) {
            if (role === 'admin') {
                headerOrderBtn.textContent = 'لوحة تحكم الإدارة';
                headerOrderBtn.href = 'admin.html';
            } else {
                headerOrderBtn.textContent = 'تقديم طلب نشر جديد';
                headerOrderBtn.href = 'order.html';
            }
        }
    } catch (e) {
        console.error(e);
    }
}

// Log out
async function logout() {
    localStorage.removeItem('admin_token');
    window.location.href = 'dashboard.html';
}

// Switch tabs view
function switchTab(tabName) {
    activeTab = tabName;
    
    // Update tab button active state
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const clickedBtn = document.querySelector(`.tab-btn[onclick="switchTab('${tabName}')"]`);
    if (clickedBtn) clickedBtn.classList.add('active');

    // Update tab panel active state
    document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.remove('active');
    });
    const targetPanel = document.getElementById(`panel-${tabName}`);
    if (targetPanel) targetPanel.classList.add('active');

    // Support Chat management
    if (tabName === 'chat') {
        fetchChatMessages();
        // Start polling support chat replies every 5 seconds
        if (!chatInterval) {
            chatInterval = setInterval(fetchChatMessages, 5000);
        }
    } else {
        // Clear chat polling interval when leaving chat tab
        if (chatInterval) {
            clearInterval(chatInterval);
            chatInterval = null;
        }
    }
}

// Fetch App and Versions info
async function fetchAppDetails() {
    const loadingEl = document.getElementById('loadingState');
    const contentEl = document.getElementById('appContent');
    
    try {
        const res = await fetch(`${API_BASE}/api/apps/${appId}`, {
            headers: { 'Authorization': `Bearer ${userToken}` }
        });
        
        if (res.status === 401 || res.status === 403) {
            logout();
            return;
        }
        
        if (!res.ok) throw new Error("فشل في تحميل تفاصيل التطبيق");
        
        appData = await res.json();
        
        // Render headers
        document.getElementById('appHeaderTitle').textContent = appData.app.title;
        document.getElementById('appHeaderCategory').textContent = appData.app.category;
        
        const planBadge = document.getElementById('appHeaderPlan');
        let planName = appData.app.plan_selection;
        let updatePrice = 150;
        
        if (appData.app.plan_selection === 'lifetime') {
            planBadge.textContent = 'باقة مدى الحياة ♾️';
            planBadge.style.backgroundColor = '#ecfdf5';
            planBadge.style.color = '#047857';
            updatePrice = 0;
        } else if (appData.app.plan_selection === 'pro') {
            planBadge.textContent = 'الباقة الاحترافية ⭐';
            planBadge.style.backgroundColor = '#eff6ff';
            planBadge.style.color = '#1d4ed8';
            updatePrice = 100;
        } else {
            planBadge.textContent = 'الباقة الأساسية 📱';
            planBadge.style.backgroundColor = '#faf5ff';
            planBadge.style.color = '#7c3aed';
            updatePrice = 150;
        }
        
        // Show update cost
        document.getElementById('lblUpdatePrice').textContent = updatePrice;
        
        // Render App Header Icon
        if (appData.app.icon_path) {
            const iconUrl = `${API_BASE}/api/apps/${appData.app.id}/download/icon`;
            fetchImageBlob(iconUrl, document.getElementById('appHeaderIcon'), true);
        } else {
            document.getElementById('appHeaderIcon').textContent = '📱';
        }
        
        // Populate Forms metadata
        document.getElementById('txtTitle').value = appData.app.title;
        document.getElementById('txtCategory').value = appData.app.category;
        document.getElementById('txtShortDesc').value = appData.app.short_desc;
        document.getElementById('txtLongDesc').value = appData.app.long_desc;
        document.getElementById('txtPrivacyLink').value = appData.app.privacy_link || '';

        // Populate Forms Images
        renderSavedAppAssets();
        
        // Populate Versions list
        renderVersionsList(appData.versions);
        
        // If logged-in user is admin, restrict editing permissions (Read-Only)
        let loggedInRole = 'user';
        try {
            const payload = JSON.parse(atob(userToken.split('.')[1]));
            if (payload && payload.role) loggedInRole = payload.role;
        } catch (e) {}

        if (loggedInRole === 'admin') {
            document.getElementById('txtTitle').disabled = true;
            document.getElementById('txtCategory').disabled = true;
            document.getElementById('txtShortDesc').disabled = true;
            document.getElementById('txtLongDesc').disabled = true;
            document.getElementById('txtPrivacyLink').disabled = true;

            const btnUpdateApp = document.getElementById('btnUpdateApp');
            if (btnUpdateApp) btnUpdateApp.style.display = 'none';

            const dropzoneIcon = document.getElementById('dropzoneIcon');
            if (dropzoneIcon) dropzoneIcon.style.display = 'none';
            const dropzoneFeature = document.getElementById('dropzoneFeature');
            if (dropzoneFeature) dropzoneFeature.style.display = 'none';
            const dropzoneScreenshots = document.getElementById('dropzoneScreenshots');
            if (dropzoneScreenshots) dropzoneScreenshots.style.display = 'none';

            const versionUploadCard = document.querySelector('#panel-versions .form-card');
            if (versionUploadCard) versionUploadCard.style.display = 'none';
            const timelineLayout = document.querySelector('.timeline-layout');
            if (timelineLayout) timelineLayout.style.gridTemplateColumns = '1fr';
        }
        
        // Check for unread support chat alerts
        checkUnreadChatAlert(appData.app.id);

        loadingEl.style.display = 'none';
        contentEl.style.display = 'block';
        
    } catch (err) {
        console.error(err);
        loadingEl.innerHTML = `
            <div class="error-message" style="padding: 2rem; border: 2px solid #ef4444; background: #fef2f2; border-radius: 8px; color: #b91c1c; text-align: center; font-family: inherit;">
                <p style="font-weight: 800; font-size: 1.15rem; margin-top: 0; margin-bottom: 10px;">⚠️ فشل تحميل البيانات من السيرفر</p>
                <p style="margin-bottom: 15px; font-weight: 600;">السبب: ${err.message}</p>
                <div style="font-size: 0.85rem; color: #7f1d1d; line-height: 1.6; border-top: 1px dashed #fca5a5; padding-top: 12px; text-align: right; direction: rtl;">
                    <strong>💡 إرشادات الحل المقترحة:</strong>
                    <ul style="margin: 5px 0 0 20px; padding: 0; list-style-type: decimal;">
                        <li>تأكد من تشغيل <strong>برنامج الـ VPN (مثل Cloudflare WARP)</strong> على جهازك لتخطي حظر الـ DNS/DPI لشبكة الإنترنت المحلية وتوصيل السيرفر بـ MongoDB Atlas.</li>
                        <li>تحقق من إعدادات الـ DNS لجهازك وتأكد من استخدام DNS جوجل <code>8.8.8.8</code>.</li>
                        <li>تأكد من أن السيرفر (Backend) يعمل بشكل سليم على المنفذ <code>8001</code>.</li>
                    </ul>
                </div>
            </div>
        `;
    }
}

// Fetch image with authentication headers
function fetchImageBlob(url, targetElement, isHeaderIcon = false) {
    fetch(url, {
        headers: { 'Authorization': `Bearer ${userToken}` }
    })
    .then(res => {
        if (!res.ok) throw new Error();
        return res.blob();
    })
    .then(blob => {
        const objectURL = URL.createObjectURL(blob);
        if (isHeaderIcon) {
            targetElement.innerHTML = `<img src="${objectURL}" style="width: 100%; height:100%; object-fit:cover; border-radius:10px;" alt="Icon">`;
        } else if (targetElement.tagName === 'IMG') {
            targetElement.src = objectURL;
        }
    })
    .catch(() => {
        if (isHeaderIcon) {
            targetElement.textContent = '📱';
        }
    });
}

// Render saved image assets in the metadata tab
function renderSavedAppAssets() {
    const previewIcon = document.getElementById('previewIcon');
    const previewFeature = document.getElementById('previewFeature');
    const previewScreenshots = document.getElementById('previewScreenshots');

    previewIcon.innerHTML = '';
    previewFeature.innerHTML = '';
    previewScreenshots.innerHTML = '';

    if (appData.app.icon_path) {
        const iconUrl = `${API_BASE}/api/apps/${appData.app.id}/download/icon`;
        const item = createSavedAssetPreview(iconUrl, 'أيقونة حالية.png');
        previewIcon.appendChild(item);
    }
    
    if (appData.app.feature_path) {
        const featureUrl = `${API_BASE}/api/apps/${appData.app.id}/download/feature`;
        const item = createSavedAssetPreview(featureUrl, 'صورة مميزة حالية.png');
        previewFeature.appendChild(item);
    }

    if (appData.app.screenshots_paths && appData.app.screenshots_paths.length > 0) {
        appData.app.screenshots_paths.forEach((_, idx) => {
            const url = `${API_BASE}/api/apps/${appData.app.id}/download/screenshot_${idx + 1}`;
            const item = createSavedAssetPreview(url, `لقطة_${idx + 1}.png`);
            previewScreenshots.appendChild(item);
        });
    }
}

function createSavedAssetPreview(url, name) {
    const previewItem = document.createElement('div');
    previewItem.className = 'preview-item';
    
    const img = document.createElement('img');
    img.src = '';
    fetchImageBlob(url, img);
    
    const info = document.createElement('div');
    info.className = 'preview-info';
    info.textContent = name;
    
    previewItem.appendChild(img);
    previewItem.appendChild(info);
    return previewItem;
}

// Render Timeline of Versions list
function renderVersionsList(versions) {
    const listEl = document.getElementById('versionsList');
    listEl.innerHTML = '';
    
    let loggedInRole = 'user';
    try {
        const payload = JSON.parse(atob(userToken.split('.')[1]));
        if (payload && payload.role) loggedInRole = payload.role;
    } catch (e) {}
    
    if (versions.length === 0) {
        listEl.innerHTML = '<div style="padding: 2rem; text-align:center;">لا توجد إصدارات مسجلة لهذا التطبيق.</div>';
        return;
    }
    
    versions.forEach(order => {
        const verItem = document.createElement('div');
        verItem.className = 'version-item';
        
        const date = new Date(order.created_at);
        const formattedDate = date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });

        // Status badge
        let statusBadge = '';
        let deadlineHtml = '';
        
        if (order.status === 'pending') {
            statusBadge = '<span class="badge-status badge-pending">بانتظار البدء والمراجعة</span>';
        } else if (order.status === 'published') {
            statusBadge = '<span class="badge-status badge-published">تم النشر (غير مدفوع)</span>';
            
            const deadline = new Date(order.payment_deadline);
            const now = new Date();
            const daysLeft = Math.ceil((deadline - now) / (1000 * 3600 * 24));
            
            if (daysLeft > 0) {
                deadlineHtml = `
                    <div class="deadline-box deadline-active" style="margin-top: 10px;">
                        ⚠️ تم نشر الإصدار بنجاح! يرجى سداد التكلفة المذكورة أدناه عبر تحويل InstaPay خلال ${daysLeft} أيام لتفادي الإيقاف.
                    </div>
                `;
            } else {
                deadlineHtml = `
                    <div class="deadline-box deadline-overdue" style="margin-top: 10px;">
                        🚨 متأخر عن السداد! يرجى تحويل التكلفة فوراً لتفادي حذف التطبيق من المتجر.
                    </div>
                `;
            }

            // Show payment invoice card to the developer/user
            if (loggedInRole !== 'admin') {
                const waMessage = `مرحباً، قمت بتحويل مبلغ ${order.total_price} ج.م لتطبيق "${appData.app.title}" إصدار ${order.app_version || '1.0.0'} (طلب #${order.id})`;
                const waLink = `https://wa.me/201507890092?text=${encodeURIComponent(waMessage)}`;
                
                deadlineHtml += `
                    <div class="payment-invoice-card">
                        <div class="invoice-header">
                            <span>💳</span>
                            <span>فاتورة سداد مستحقة الرسوم</span>
                        </div>
                        
                        <div class="invoice-details">
                            <div class="invoice-detail-row">
                                <span>اسم التطبيق:</span>
                                <span style="color: var(--text-dark);">${appData.app.title}</span>
                            </div>
                            <div class="invoice-detail-row">
                                <span>إصدار التطبيق:</span>
                                <span style="color: var(--text-dark);">${order.app_version || '1.0.0'}</span>
                            </div>
                            <div class="invoice-detail-row">
                                <span>رقم الطلب (ID):</span>
                                <span style="color: var(--text-dark);">#${order.id}</span>
                            </div>
                            <div class="invoice-detail-row total">
                                <span>المبلغ المطلوب سداده:</span>
                                <span style="font-weight: 800; color: #065f46;">${order.total_price} ج.م</span>
                            </div>
                        </div>
                        
                        <div class="instapay-info-box">
                            <div class="instapay-info-title">📍 معلومات تحويل InstaPay:</div>
                            <ul class="instapay-info-list">
                                <li class="instapay-info-item">
                                    <span>العنوان (Address):</span>
                                    <span class="instapay-value">cedratech@instapay</span>
                                </li>
                                <li class="instapay-info-item">
                                    <span>رقم الهاتف (Mobile):</span>
                                    <span class="instapay-value">01507890092</span>
                                </li>
                            </ul>
                        </div>
                        
                        <a href="${waLink}" target="_blank" class="btn btn-whatsapp-payment" style="display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; text-decoration: none; padding: 12px;">
                            <span>💬</span>
                            <span>تأكيد الدفع وإرسال التحويل (واتساب)</span>
                        </a>
                    </div>
                `;
            }
        } else if (order.status === 'paid') {
            statusBadge = '<span class="badge-status badge-paid">تم السداد ونشط بالمتجر</span>';
        } else if (order.status === 'deleted') {
            statusBadge = '<span class="badge-status badge-deleted">تم حذف الإصدار</span>';
        }

        // Helper to format date and time in Arabic
        const formatDateWithTime = (dateStr) => {
            if (!dateStr) return null;
            const d = new Date(dateStr);
            return d.toLocaleDateString('ar-EG', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        };

        const uploadDateDisp = formatDateWithTime(order.created_at);
        const publishDateDisp = formatDateWithTime(order.published_at);
        const paidDateDisp = formatDateWithTime(order.paid_at);
        const deadlineDateDisp = formatDateWithTime(order.payment_deadline);

        // Build history log of updates and payments
        let historyLogHtml = `
            <div class="version-history-log" style="margin: 15px 0; border-top: 2px dashed var(--border-color); border-bottom: 2px dashed var(--border-color); padding: 12px 10px; background-color: #faf5ff; border-radius: 8px;">
                <div style="font-weight: 800; margin-bottom: 8px; color: var(--text-dark); font-size: 0.9rem;">⏳ سجل تتبع التحديث والمدفوعات:</div>
                <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; font-size: 0.85rem;">
                    <li style="display: flex; align-items: center; gap: 8px; color: var(--text-dark);">
                        <span style="color: #a78bfa; font-size: 1rem;">●</span>
                        <strong>تاريخ رفع التحديث:</strong> 
                        <span style="color: var(--text-light);">${uploadDateDisp}</span>
                    </li>
        `;

        if (order.published_at) {
            historyLogHtml += `
                    <li style="display: flex; align-items: center; gap: 8px; color: var(--text-dark);">
                        <span style="color: #3b82f6; font-size: 1rem;">●</span>
                        <strong>تاريخ الموافقة والنشر بالمتجر:</strong> 
                        <span style="color: var(--text-light);">${publishDateDisp}</span>
                    </li>
            `;
        } else if (order.status === 'pending') {
            historyLogHtml += `
                    <li style="display: flex; align-items: center; gap: 8px; color: #d97706;">
                        <span style="font-size: 1rem;">○</span>
                        <strong>حالة النشر بالمتجر:</strong> قيد الفحص والمراجعة الفنية من المشرف...
                    </li>
            `;
        }

        if (order.status === 'paid') {
            historyLogHtml += `
                    <li style="display: flex; align-items: center; gap: 8px; color: #10b981; font-weight: 700;">
                        <span style="font-size: 1rem;">●</span>
                        <strong>حالة السداد والتأكيد:</strong> 
                        <span>تم دفع مبلغ الفاتورة (${order.total_price} ج.م) وقبوله من الإدارة بتاريخ ${paidDateDisp || uploadDateDisp} ✅</span>
                    </li>
            `;
        } else if (order.status === 'published') {
            historyLogHtml += `
                    <li style="display: flex; align-items: center; gap: 8px; color: #ef4444; font-weight: 700;">
                        <span style="font-size: 1rem;">○</span>
                        <strong>حالة السداد والتأكيد:</strong> 
                        <span>بانتظار سداد (${order.total_price} ج.م) عبر InstaPay (المهلة حتى: ${deadlineDateDisp}) ⏳</span>
                    </li>
            `;
        } else if (order.status === 'pending') {
            historyLogHtml += `
                    <li style="display: flex; align-items: center; gap: 8px; color: var(--text-light);">
                        <span style="font-size: 1rem;">○</span>
                        <strong>حالة السداد والتأكيد:</strong> 
                        <span>تُطلب الفاتورة بعد إتمام النشر بالمتجر (${order.total_price} ج.م)</span>
                    </li>
            `;
        }

        historyLogHtml += `
                </ul>
            </div>
        `;

        // Changelog
        let changelogHtml = '';
        if (order.changelog) {
            changelogHtml = `
                <div class="changelog-box" style="margin-top: 10px;">
                    <div class="changelog-title">📋 التغييرات والتحسينات في هذا الإصدار:</div>
                    <div style="line-height: 1.5;">${order.changelog}</div>
                </div>
            `;
        }

        // Admin notes/feedback
        let notesHtml = '';
        if (loggedInRole === 'admin') {
            const notesText = order.admin_notes || '';
            notesHtml = `
                <div class="admin-notes-box" style="margin-top: 12px; background-color: #f8fafc; border: 2px dashed var(--border-color); padding: 12px; border-radius: 8px;">
                    <div class="admin-notes-title" style="font-weight: 800; margin-bottom: 8px; color: var(--text-dark); font-size: 0.9rem;">✍️ ملاحظات ورسالة المراجعة لهذا الإصدار:</div>
                    <textarea id="notes-${order.id}" class="form-textarea" style="min-height: 80px; font-size:0.85rem;" placeholder="اكتب ملاحظة أو توجيه للمطور هنا (مثال: يرجى تعديل صور المتجر)...">${notesText}</textarea>
                    <button class="btn" style="background-color: var(--primary); color: white; font-size: 0.8rem; font-weight: 800; border: 2px solid var(--border-color); border-radius: 6px; padding: 5px 12px; margin-top: 8px; cursor: pointer; font-family: inherit;" onclick="saveVersionNotes(${order.id})">💾 حفظ الملاحظة وإرسالها للمطور</button>
                </div>
            `;
        } else if (order.admin_notes && order.admin_notes.trim() !== '') {
            notesHtml = `
                <div class="admin-notes-box" style="margin-top: 12px;">
                    <div class="admin-notes-title">💬 رسالة وملاحظة من المشرف:</div>
                    <div class="admin-notes-content">${order.admin_notes}</div>
                </div>
            `;
        }

        // AAB Download button (secured request)
        let downloadButton = '';
        if (order.aab_path) {
            downloadButton = `
                <button class="btn" style="padding: 6px 12px; font-size: 0.8rem; background-color: #f1f5f9; color: var(--text-dark);" onclick="downloadAABFile(${order.id})">
                    📥 تحميل الـ AAB
                </button>
            `;
        }

        let planDisp = order.plan_selection;
        if (order.plan_selection === 'basic') planDisp = 'الباقة الأساسية';
        else if (order.plan_selection === 'pro') planDisp = 'الباقة الاحترافية';
        else if (order.plan_selection === 'lifetime') planDisp = 'باقة مدى الحياة';
        else if (order.plan_selection === 'update') planDisp = 'تحديث إصدار';

        // Admin Action Buttons
        let adminActionsHtml = '';
        if (loggedInRole === 'admin') {
            if (order.status === 'pending') {
                adminActionsHtml = `
                    <button onclick="updateVersionStatus(${order.id}, 'published')" style="background-color: var(--primary); color: white; border: 2px solid var(--border-color); border-radius: 6px; padding: 4px 10px; font-weight: 800; font-size: 0.75rem; cursor: pointer; font-family: inherit;">
                        🚀 اعتماد ونشر التحديث بالمتجر
                    </button>
                `;
            } else if (order.status === 'published') {
                adminActionsHtml = `
                    <div style="display: flex; gap: 5px;">
                        <button onclick="updateVersionStatus(${order.id}, 'paid')" style="background-color: var(--success); color: white; border: 2px solid var(--border-color); border-radius: 6px; padding: 4px 10px; font-weight: 800; font-size: 0.75rem; cursor: pointer; font-family: inherit;">
                            💸 تأكيد استلام المبلغ
                        </button>
                        <button onclick="updateVersionStatus(${order.id}, 'deleted')" style="background-color: #ef4444; color: white; border: 2px solid var(--border-color); border-radius: 6px; padding: 4px 10px; font-weight: 800; font-size: 0.75rem; cursor: pointer; font-family: inherit;">
                            🛑 تعطيل التحديث
                        </button>
                    </div>
                `;
            }
        }

        verItem.innerHTML = `
            <div class="version-item-header">
                <div>
                    <span class="version-name-tag">إصدار نسخة: ${order.app_version || '1.0.0'}</span>
                    <span style="color: var(--text-light); margin-right: 15px; font-size: 0.85rem;">(${planDisp})</span>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    ${statusBadge}
                    ${loggedInRole === 'admin' ? adminActionsHtml : (order.status === 'pending' ? `
                    <button
                        onclick="deletePendingVersion(${order.id}, '${(order.app_version || '1.0.0').replace(/'/g, "\\'")}')"
                        style="background: #fff0f0; color: #dc2626; border: 2px solid #dc2626; border-radius: 6px; padding: 4px 10px; font-weight: 800; font-size: 0.75rem; cursor: pointer; font-family: inherit;">
                        🗑️ إلغاء
                    </button>` : '')}
                </div>
            </div>
            
            <div class="order-meta-grid" style="grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; margin-bottom: 10px;">
                <div class="meta-item">
                    <span class="meta-label">تاريخ الرفع</span>
                    <span class="meta-value" style="font-size: 0.9rem;">${formattedDate}</span>
                </div>
                <div class="meta-item">
                    <span class="meta-label">التكلفة المطلوبة</span>
                    <span class="meta-value" style="color: var(--success); font-size: 0.9rem;">${order.total_price} ج.م</span>
                </div>
                <div class="meta-item">
                    <span class="meta-label">معرف الإصدار (ID)</span>
                    <span class="meta-value" style="font-size: 0.9rem;">#${order.id}</span>
                </div>
                <div class="meta-item">
                    <span class="meta-label">حزمة التطبيق</span>
                    <span class="meta-value">${downloadButton || '<span style="color: var(--text-light); font-size: 0.85rem;">غير مرفوعة</span>'}</span>
                </div>
            </div>

            ${historyLogHtml}
            ${changelogHtml}
            ${deadlineHtml}
            ${notesHtml}
        `;
        
        listEl.appendChild(verItem);
    });
}

// Download AAB with Authorization Token
function downloadAABFile(orderId) {
    const url = `${API_BASE}/api/orders/${orderId}/download/aab?token=${encodeURIComponent(userToken)}`;
    window.open(url, '_blank');
}

// Delete a pending version
async function deletePendingVersion(orderId, versionName) {
    const confirmed = confirm(`هل أنت متأكد من إلغاء وحذف طلب الإصدار ${versionName}؟\n\nتحذير: سيتم مسح هذا الطلب والملف المرفوع نهائياً.`);
    if (!confirmed) return;

    try {
        const res = await fetch(`${API_BASE}/api/orders/${orderId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${userToken}` }
        });

        if (res.status === 401 || res.status === 403) {
            alert('انتهت صلاحية الجلسة، يرجى إعادة تسجيل الدخول.');
            logout();
            return;
        }
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || `خطأ ${res.status}`);
        }

        // Reload data after successful deletion
        fetchAppDetails();
    } catch (err) {
        console.error(err);
        alert(`حدث خطأ أثناء الحذف: ${err.message}`);
    }
}

// Update version status (Admin only)
async function updateVersionStatus(orderId, newStatus) {
    let confirmMsg = `هل أنت متأكد من تغيير حالة هذا الإصدار إلى `;
    if (newStatus === 'published') confirmMsg += "منشور بالمتجر؟ (سيتم إرسال إيميل الدفع للمطور وبدء مهلة الـ 3 أيام)";
    else if (newStatus === 'paid') confirmMsg += "تم سداد قيمته بالكامل؟";
    else if (newStatus === 'deleted') confirmMsg += "معطل ومحذوف؟";

    if (!confirm(confirmMsg)) return;

    try {
        const res = await fetch(`${API_BASE}/api/orders/${orderId}/status`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${userToken}`
            },
            body: JSON.stringify({ status: newStatus })
        });

        if (res.status === 401 || res.status === 403) {
            alert('انتهت صلاحية الجلسة، يرجى إعادة تسجيل الدخول.');
            logout();
            return;
        }
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || `خطأ ${res.status}`);
        }

        alert("تم تحديث حالة الإصدار بنجاح!");
        fetchAppDetails();
    } catch (err) {
        console.error(err);
        alert("حدث خطأ أثناء تحديث الحالة: " + err.message);
    }
}

// Save version notes/feedback (Admin only)
async function saveVersionNotes(orderId) {
    const notesText = document.getElementById(`notes-${orderId}`).value;

    try {
        const res = await fetch(`${API_BASE}/api/orders/${orderId}/notes`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${userToken}`
            },
            body: JSON.stringify({ notes: notesText })
        });

        if (res.status === 401 || res.status === 403) {
            alert('انتهت صلاحية الجلسة، يرجى إعادة تسجيل الدخول.');
            logout();
            return;
        }
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || `خطأ ${res.status}`);
        }

        alert("تم حفظ الملاحظة الفنية وإرسالها للمطور بنجاح.");
        fetchAppDetails();
    } catch (err) {
        console.error(err);
        alert("حدث خطأ أثناء حفظ الملاحظة: " + err.message);
    }
}

// Edit App Metadata (Details tab form submit)
async function handleUpdateApp(event) {
    event.preventDefault();
    
    const submitBtn = document.getElementById('btnUpdateApp');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'جاري حفظ التعديلات...';
    submitBtn.disabled = true;

    // Show progress overlay
    const progressModal = document.getElementById('uploadProgressModal');
    if (progressModal) progressModal.style.display = 'flex';

    const formData = new FormData();
    formData.append('title', document.getElementById('txtTitle').value.trim());
    formData.append('category', document.getElementById('txtCategory').value);
    formData.append('short_desc', document.getElementById('txtShortDesc').value.trim());
    formData.append('long_desc', document.getElementById('txtLongDesc').value.trim());
    formData.append('privacy_link', document.getElementById('txtPrivacyLink').value.trim());

    if (fileState.icon) {
        formData.append('file_icon', fileState.icon);
    }
    if (fileState.feature) {
        formData.append('file_feature', fileState.feature);
    }
    if (fileState.screenshots && fileState.screenshots.length > 0) {
        fileState.screenshots.forEach(file => {
            formData.append('file_screenshots', file);
        });
    }

    try {
        const res = await fetch(`${API_BASE}/api/apps/${appId}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${userToken}` },
            body: formData
        });

        if (!res.ok) throw new Error("فشل حفظ التعديلات على الخادم");
        
        alert("تم حفظ وتحديث بيانات التطبيق والأصول بنجاح!");
        
        // Reset file selections
        fileState.icon = null;
        fileState.feature = null;
        fileState.screenshots = [];
        
        fetchAppDetails();
        
    } catch (err) {
        console.error(err);
        alert("حدث خطأ أثناء تحديث البيانات: " + err.message);
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        if (progressModal) progressModal.style.display = 'none';
    }
}

// Create new version update (Upload version form submit)
async function handleUploadVersion(event) {
    event.preventDefault();

    if (!fileState.aab) {
        alert("يرجى اختيار ملف حزمة التطبيق (.aab) الجديد أولاً للرفع.");
        return;
    }

    const submitBtn = document.getElementById('btnSubmitVersion');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'جاري رفع ونقل الملف...';
    submitBtn.disabled = true;

    const progressModal = document.getElementById('uploadProgressModal');
    const statusTextEl = document.getElementById('uploadStatusText');
    if (progressModal) progressModal.style.display = 'flex';
    
    const messages = [
        "جاري إرسال حزمة التطبيق الجديدة (AAB)... ⚙️",
        "تجهيز النقل والاتصال بسحابة التخزين Cloudflare R2... 🛡️",
        "تسليم الإصدار لخط المراجعة والتحقق... 🚚",
        "ثوانٍ ويكتمل الرفع... 🌟"
    ];
    let msgIndex = 0;
    const interval = setInterval(() => {
        msgIndex = (msgIndex + 1) % messages.length;
        if (statusTextEl) statusTextEl.textContent = messages[msgIndex];
    }, 2500);

    const formData = new FormData();
    formData.append('app_version', document.getElementById('txtAppVersion').value.trim());
    formData.append('changelog', document.getElementById('txtChangelog').value.trim());
    formData.append('file_aab', fileState.aab);

    try {
        const res = await fetch(`${API_BASE}/api/apps/${appId}/versions`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${userToken}` },
            body: formData
        });

        if (!res.ok) throw new Error("فشل رفع الإصدار الجديد");

        alert("تم رفع طلب الإصدار الجديد للتطبيق بنجاح! تم وضعه قيد المراجعة الفورية.");
        
        // Reset form
        document.getElementById('frmUploadVersion').reset();
        fileState.aab = null;
        document.getElementById('previewAAB').innerHTML = '';
        document.getElementById('txtAabDropzone').textContent = 'اسحب وأسقط ملف الـ AAB الجديد هنا';

        fetchAppDetails();

    } catch (err) {
        console.error(err);
        alert("حدث خطأ أثناء رفع التحديث: " + err.message);
    } finally {
        clearInterval(interval);
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        if (progressModal) progressModal.style.display = 'none';
    }
}

// ------------------ DROPZONE AND PREVIEWS LOGIC ------------------

function setupDropzone(zoneId, inputId, key, isMultiple, previewId) {
    const zone = document.getElementById(zoneId);
    const input = document.getElementById(inputId);
    const container = document.getElementById(previewId);

    if (!zone || !input) return;

    zone.addEventListener('click', (e) => {
        if (e.target.tagName !== 'INPUT' && e.target.className !== 'btn-remove-preview') {
            input.click();
        }
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        zone.addEventListener(eventName, (e) => {
            e.preventDefault();
            zone.style.background = '#f1f5f9';
        });
    });

    ['dragleave', 'drop'].forEach(eventName => {
        zone.addEventListener(eventName, (e) => {
            e.preventDefault();
            zone.style.background = '#f8fafc';
        });
    });

    zone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        handleFiles(dt.files, key, isMultiple, container, zoneId);
    });

    input.addEventListener('change', (e) => {
        handleFiles(e.target.files, key, isMultiple, container, zoneId);
    });
}

function handleFiles(files, key, isMultiple, container, zoneId) {
    if (!files.length) return;

    if (isMultiple) {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.type.startsWith('image/')) {
                fileState[key].push(file);
                renderImagePreview(file, key, container, true);
            }
        }
    } else {
        const file = files[0];
        if (key === 'aab') {
            if (!file.name.endsWith('.aab')) {
                alert('يرجى اختيار ملف صحيح بصيغة AAB فقط.');
                return;
            }
            fileState[key] = file;
            renderAABPreview(file, container, zoneId);
        } else {
            if (file.type.startsWith('image/')) {
                fileState[key] = file;
                renderImagePreview(file, key, container, false);
            }
        }
    }
}

function renderImagePreview(file, key, container, isMultiple) {
    const reader = new FileReader();
    reader.onload = (e) => {
        if (!isMultiple) container.innerHTML = '';

        const previewItem = document.createElement('div');
        previewItem.className = 'preview-item';
        
        const img = document.createElement('img');
        img.src = e.target.result;
        
        const info = document.createElement('div');
        info.className = 'preview-info';
        info.textContent = file.name;

        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn-remove-preview';
        removeBtn.innerHTML = '✕';
        removeBtn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            previewItem.remove();
            if (isMultiple) {
                fileState[key] = fileState[key].filter(f => f !== file);
            } else {
                fileState[key] = null;
            }
        });

        previewItem.appendChild(img);
        previewItem.appendChild(info);
        previewItem.appendChild(removeBtn);
        container.appendChild(previewItem);
    };
    reader.readAsDataURL(file);
}

function renderAABPreview(file, container, zoneId) {
    container.innerHTML = '';
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    
    const previewItem = document.createElement('div');
    previewItem.className = 'preview-item';
    previewItem.style.display = 'flex';
    previewItem.style.flexDirection = 'column';
    previewItem.style.alignItems = 'center';
    
    const fileIcon = document.createElement('div');
    fileIcon.style.fontSize = '1.8rem';
    fileIcon.innerHTML = '📦';

    const info = document.createElement('div');
    info.className = 'preview-info';
    info.textContent = `${file.name} (${sizeMB} MB)`;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn-remove-preview';
    removeBtn.innerHTML = '✕';
    removeBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        previewItem.remove();
        fileState.aab = null;
        document.getElementById('txtAabDropzone').textContent = 'اسحب وأسقط ملف الـ AAB الجديد هنا';
    });

    previewItem.appendChild(fileIcon);
    previewItem.appendChild(info);
    previewItem.appendChild(removeBtn);
    container.appendChild(previewItem);
    
    document.getElementById('txtAabDropzone').textContent = `ملف جاهز للرفع: ${file.name}`;
}


// ------------------ SUPPORT CHAT MODULE (Stage 5) ------------------

// Check if there are any unread messages from admin
async function checkUnreadChatAlert(appId) {
    try {
        const res = await fetch(`${API_BASE}/api/apps/${appId}/messages`, {
            headers: { 'Authorization': `Bearer ${userToken}` }
        });
        if (res.ok) {
            const messages = await res.json();
            // Check if any message is sent by admin and is unread
            const hasUnread = messages.some(m => m.sender_role === 'admin' && m.read_by_recipient === false);
            const badge = document.getElementById('unreadBadge');
            if (badge) {
                badge.style.display = hasUnread ? 'inline-block' : 'none';
            }
        }
    } catch (e) {
        console.error(e);
    }
}

// Fetch all support chat messages
async function fetchChatMessages() {
    if (activeTab !== 'chat') return;
    
    const chatContainer = document.getElementById('chatMessages');
    
    try {
        const res = await fetch(`${API_BASE}/api/apps/${appId}/messages`, {
            headers: { 'Authorization': `Bearer ${userToken}` }
        });
        
        if (!res.ok) throw new Error();
        
        const messages = await res.json();
        
        // Hide unread alert badge since user loaded the chat
        const badge = document.getElementById('unreadBadge');
        if (badge) badge.style.display = 'none';

        if (messages.length === 0) {
            chatContainer.innerHTML = `
                <div class="chat-empty">
                    <div class="chat-empty-icon">💬</div>
                    <p>أهلاً بك في الدعم الداخلي للتطبيق.<br>يمكنك الاستفسار عن حالة التطبيق ومراجعة المشرف مباشرة هنا.</p>
                </div>
            `;
            return;
        }

        // Store scroll position to see if user was scrolled to bottom
        const isAtBottom = chatContainer.scrollHeight - chatContainer.clientHeight <= chatContainer.scrollTop + 50;

        chatContainer.innerHTML = '';
        
        let loggedInRole = 'user';
        try {
            const payload = JSON.parse(atob(userToken.split('.')[1]));
            if (payload && payload.role) loggedInRole = payload.role;
        } catch (e) {}

        messages.forEach(msg => {
            const bubble = document.createElement('div');
            // Align sent messages (from current logged-in user/role) left, received right
            const isMyMessage = msg.sender_role === loggedInRole;
            bubble.className = `chat-message-bubble ${isMyMessage ? 'sent' : 'received'}`;
            
            const date = new Date(msg.created_at);
            const timeStr = date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
            
            bubble.innerHTML = `
                <div class="chat-message-content">${msg.content}</div>
                <div class="chat-message-meta">
                    <span class="chat-sender-name">${msg.sender_name}</span>
                    <span>${timeStr}</span>
                </div>
            `;
            
            chatContainer.appendChild(bubble);
        });

        // Auto-scroll if user was already at the bottom or it's the first load
        if (isAtBottom || chatContainer.children.length <= messages.length) {
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }

    } catch (e) {
        console.error("Error loading chat messages:", e);
    }
}

// Send a support chat message
async function handleSendChat(event) {
    event.preventDefault();
    const inputEl = document.getElementById('txtChatInput');
    const content = inputEl.value.trim();
    if (!content) return;

    inputEl.value = '';
    
    try {
        const res = await fetch(`${API_BASE}/api/apps/${appId}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${userToken}`
            },
            body: JSON.stringify({ content: content })
        });
        
        if (!res.ok) throw new Error("فشل إرسال الرسالة");
        
        // Immediately fetch and render chat messages
        fetchChatMessages();
        
    } catch (err) {
        console.error(err);
        alert(err.message);
    }
}
