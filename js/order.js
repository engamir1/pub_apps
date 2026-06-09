// Detect backend URL: use relative path if on localhost, absolute if on Firebase
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? (window.location.port === '8001' ? '' : 'http://localhost:8001')
  : 'http://localhost:8001';

// Redirect to dashboard if not logged in
if (!localStorage.getItem('admin_token')) {
  window.location.href = 'dashboard.html';
}

document.addEventListener('DOMContentLoaded', () => {
  // Wizard Navigation variables
  let currentStep = 1;
  const totalSteps = 5;
  
  const panels = document.querySelectorAll('.wizard-step-panel');
  const progressSteps = document.querySelectorAll('.progress-step');
  const progressLine = document.getElementById('progressLine');
  const btnPrev = document.getElementById('btnPrev');
  const btnNext = document.getElementById('btnNext');
  const wizardFooter = document.getElementById('wizardFooter');
  const successPanel = document.getElementById('successPanel');
  
  // File upload collections
  let uploadedFiles = {
    icon: null,
    feature: null,
    screenshots: [],
    aab: null
  };
  // Pricing Matrix
  const pricingData = {
    basic: { price: 500, name: "الباقة الأساسية", updatePrice: 150 },
    pro: { price: 1500, name: "الباقة الاحترافية", updatePrice: 100 },
    lifetime: { price: 5000, name: "الباقة اللانهائية (مدى الحياة)", updatePrice: 0 }
  };

  let userApps = [];

  // Check URL parameters to pre-fill Plan/App
  const urlParams = new URLSearchParams(window.location.search);
  const planParam = urlParams.get('plan');
  const appParam = urlParams.get('app');

  if (planParam && planParam !== 'update') {
    const planRadio = document.querySelector(`input[name="planSelection"][value="${planParam}"]`);
    if (planRadio) planRadio.checked = true;
  }

  const chkAsoAddon = document.getElementById('chkAsoAddon');
  const chkTransferAddon = document.getElementById('chkTransferAddon');

  function updateAddonStates() {
    const selectedPlanEl = document.querySelector('input[name="planSelection"]:checked');
    if (!selectedPlanEl) return;
    const selectedPlan = selectedPlanEl.value;
    
    if (chkAsoAddon) {
      if (selectedPlan === 'pro' || selectedPlan === 'lifetime') {
        chkAsoAddon.checked = true;
        chkAsoAddon.disabled = true;
      } else {
        chkAsoAddon.disabled = false;
      }
    }
  }

  // Handle plan radio changes
  document.querySelectorAll('input[name="planSelection"]').forEach(radio => {
    radio.addEventListener('change', () => {
      updateAddonStates();
    });
  });

  // Handle order type radio changes
  document.querySelectorAll('input[name="orderType"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      handleOrderTypeChange(e.target.value);
    });
  });

  function handleOrderTypeChange(type) {
    const appSelectGroup = document.getElementById('appSelectGroup');
    const planSelectionGroup = document.getElementById('planSelectionGroup');
    const accountInfoBlock = document.getElementById('accountInfoBlock');
    const addonsGroup = document.getElementById('addonsGroup');
    
    const panelNewAppFields = document.getElementById('panelNewAppFields');
    const panelUpdateAppFields = document.getElementById('panelUpdateAppFields');
    const panelNewAppAssets = document.getElementById('panelNewAppAssets');
    
    // Inputs to toggle required attribute
    const appTitleInput = document.getElementById('appTitle');
    const appCategorySelect = document.getElementById('appCategory');
    const appShortDescInput = document.getElementById('appShortDesc');
    const appLongDescInput = document.getElementById('appLongDesc');
    
    const appVersionInput = document.getElementById('appVersion');
    const changelogInput = document.getElementById('changelog');
    const existingAppSelect = document.getElementById('existingAppSelect');

    if (type === 'update') {
      if (appSelectGroup) appSelectGroup.style.display = 'block';
      if (planSelectionGroup) planSelectionGroup.style.display = 'none';
      if (accountInfoBlock) accountInfoBlock.style.display = 'none';
      if (addonsGroup) addonsGroup.style.display = 'none';
      
      if (panelNewAppFields) panelNewAppFields.style.display = 'none';
      if (panelUpdateAppFields) panelUpdateAppFields.style.display = 'block';
      if (panelNewAppAssets) panelNewAppAssets.style.display = 'none';
      
      // Remove required from new app inputs
      if (appTitleInput) appTitleInput.removeAttribute('required');
      if (appCategorySelect) appCategorySelect.removeAttribute('required');
      if (appShortDescInput) appShortDescInput.removeAttribute('required');
      if (appLongDescInput) appLongDescInput.removeAttribute('required');
      
      // Add required to update inputs
      if (appVersionInput) appVersionInput.setAttribute('required', '');
      if (changelogInput) changelogInput.setAttribute('required', '');
      if (existingAppSelect) existingAppSelect.setAttribute('required', '');
    } else {
      if (appSelectGroup) appSelectGroup.style.display = 'none';
      if (planSelectionGroup) planSelectionGroup.style.display = 'block';
      if (accountInfoBlock) accountInfoBlock.style.display = 'block';
      if (addonsGroup) addonsGroup.style.display = 'block';
      
      if (panelNewAppFields) panelNewAppFields.style.display = 'block';
      if (panelUpdateAppFields) panelUpdateAppFields.style.display = 'none';
      if (panelNewAppAssets) panelNewAppAssets.style.display = 'block';
      
      // Add required to new app inputs
      if (appTitleInput) appTitleInput.setAttribute('required', '');
      if (appCategorySelect) appCategorySelect.setAttribute('required', '');
      if (appShortDescInput) appShortDescInput.setAttribute('required', '');
      if (appLongDescInput) appLongDescInput.setAttribute('required', '');
      
      // Remove required from update inputs
      if (appVersionInput) appVersionInput.removeAttribute('required');
      if (changelogInput) changelogInput.removeAttribute('required');
      if (existingAppSelect) existingAppSelect.removeAttribute('required');
    }
  }

  // Fetch the user's existing applications
  async function fetchUserApps() {
    try {
      const response = await fetch(`${API_BASE}/api/orders`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
        }
      });
      if (response.ok) {
        const orders = await response.json();
        // Extract unique app titles
        const titles = new Set();
        orders.forEach(o => {
          if (o.app_title) titles.add(o.app_title);
        });
        userApps = Array.from(titles);
        populateAppsDropdown();
        
        // Auto pre-fill developer info from latest order
        if (orders.length > 0) {
          const latest = orders[0];
          if (latest.dev_name) document.getElementById('devName').value = latest.dev_name;
          if (latest.dev_phone) document.getElementById('devPhone').value = latest.dev_phone;
          if (latest.dev_email) document.getElementById('devEmail').value = latest.dev_email;
        }

        // If URL query specifies an update flow, activate it now
        if (planParam === 'update') {
          const updateRadio = document.querySelector('input[name="orderType"][value="update"]');
          if (updateRadio) {
            updateRadio.checked = true;
            handleOrderTypeChange('update');
            if (appParam) {
              const select = document.getElementById('existingAppSelect');
              if (select) {
                // Ensure the app option exists before setting
                setTimeout(() => {
                  select.value = appParam;
                }, 100);
              }
            }
          }
        }
      }
    } catch (e) {
      console.error("Error fetching user apps:", e);
    }
  }

  function populateAppsDropdown() {
    const select = document.getElementById('existingAppSelect');
    if (!select) return;
    select.innerHTML = '<option value="" disabled selected>اختر تطبيقك...</option>';
    if (userApps.length === 0) {
      const option = document.createElement('option');
      option.value = "";
      option.disabled = true;
      option.textContent = "لا توجد تطبيقات سابقة لرفع تحديث لها";
      select.appendChild(option);
      return;
    }
    userApps.forEach(app => {
      const option = document.createElement('option');
      option.value = app;
      option.textContent = app;
      select.appendChild(option);
    });
  }

  // Setup file dropzones
  setupDropzone('dropzoneIcon', 'fileIcon', 'icon', false);
  setupDropzone('dropzoneFeature', 'fileFeature', 'feature', false);
  setupDropzone('dropzoneScreenshots', 'fileScreenshots', 'screenshots', true);
  setupDropzone('dropzoneAAB', 'fileAAB', 'aab', false);

  function setupDropzone(zoneId, inputId, key, isMultiple) {
    const zone = document.getElementById(zoneId);
    const input = document.getElementById(inputId);
    const container = document.getElementById(zoneId.replace('dropzone', 'preview'));

    if (!zone || !input) return;

    // Trigger click on input
    zone.addEventListener('click', (e) => {
      if (e.target.tagName !== 'INPUT' && e.target.className !== 'btn-remove-preview') {
        input.click();
      }
    });

    // Drag and drop events
    ['dragenter', 'dragover'].forEach(eventName => {
      zone.addEventListener(eventName, (e) => {
        e.preventDefault();
        zone.classList.add('dragover');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      zone.addEventListener(eventName, (e) => {
        e.preventDefault();
        zone.classList.remove('dragover');
      }, false);
    });

    zone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      handleFiles(files, key, isMultiple, container);
    });

    input.addEventListener('change', (e) => {
      const files = e.target.files;
      handleFiles(files, key, isMultiple, container);
    });
  }

  function handleFiles(files, key, isMultiple, container) {
    if (!files.length) return;

    if (isMultiple) {
      // Handle screenshots multiple files
      for (let i = 0; i < files.length; i++) {
        if (uploadedFiles[key].length >= 8) {
          alert('الحد الأقصى لصور لقطات الشاشة هو 8 صور.');
          break;
        }
        const file = files[i];
        if (file.type.startsWith('image/')) {
          uploadedFiles[key].push(file);
          renderImagePreview(file, key, container, true);
        }
      }
    } else {
      const file = files[0];
      if (key === 'aab') {
        // Handle bundle file
        if (!file.name.endsWith('.aab')) {
          alert('يرجى اختيار ملف صحيح بصيغة AAB (.Android App Bundle) فقط.');
          return;
        }
        uploadedFiles[key] = file;
        renderAABPreview(file, container);
      } else {
        // Handle single image (icon or feature graphic)
        if (file.type.startsWith('image/')) {
          uploadedFiles[key] = file;
          renderImagePreview(file, key, container, false);
        }
      }
    }
  }

  function renderImagePreview(file, key, container, isMultiple) {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (!isMultiple) {
        container.innerHTML = ''; // Clear previous single preview
      }

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
          uploadedFiles[key] = uploadedFiles[key].filter(f => f !== file);
        } else {
          uploadedFiles[key] = null;
        }
      });

      previewItem.appendChild(img);
      previewItem.appendChild(info);
      previewItem.appendChild(removeBtn);
      container.appendChild(previewItem);
    };
    reader.readAsDataURL(file);
  }

  function renderAABPreview(file, container) {
    container.innerHTML = '';
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    
    const previewItem = document.createElement('div');
    previewItem.className = 'preview-item';
    previewItem.style.display = 'flex';
    previewItem.style.flexDirection = 'column';
    previewItem.style.alignItems = 'center';
    previewItem.style.justifyContent = 'center';
    previewItem.style.padding = '10px';
    previewItem.style.textAlign = 'center';

    const fileIcon = document.createElement('div');
    fileIcon.style.fontSize = '2rem';
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
      uploadedFiles.aab = null;
      document.getElementById('txtAabDropzone').textContent = 'اسحب وأسقط ملف التطبيق (.aab) هنا';
    });

    previewItem.appendChild(fileIcon);
    previewItem.appendChild(info);
    previewItem.appendChild(removeBtn);
    container.appendChild(previewItem);
    
    // Update dropzone title text
    document.getElementById('txtAabDropzone').textContent = `ملف جاهز للرفع: ${file.name}`;
  }

  // Validation function for current step
  function validateCurrentStep() {
    let isValid = true;
    const currentPanel = document.querySelector(`.wizard-step-panel[data-step="${currentStep}"]`);
    
    // Find all required fields in the current panel
    const requiredInputs = currentPanel.querySelectorAll('[required]');
    
    requiredInputs.forEach(input => {
      // Checkboxes validation
      if (input.type === 'checkbox') {
        if (!input.checked) {
          isValid = false;
          input.closest('.compliance-check-item').style.border = '2px solid var(--secondary)';
        } else {
          input.closest('.compliance-check-item').style.border = 'none';
        }
      }
      // Radio inputs validation
      else if (input.type === 'radio') {
        const name = input.name;
        const checked = currentPanel.querySelector(`input[name="${name}"]:checked`);
        if (!checked) {
          isValid = false;
        }
      }
      // Text / select / file validation
      else {
        if (!input.value.trim()) {
          isValid = false;
          input.style.borderColor = 'var(--secondary)';
        } else {
          input.style.borderColor = 'var(--border-color)';
        }
      }
    });

    // Custom check for AAB file upload in Step 3
    if (currentStep === 3) {
      if (!uploadedFiles.aab) {
        isValid = false;
        document.getElementById('dropzoneAAB').style.borderColor = 'var(--secondary)';
        alert('ملف حزمة التطبيق (.aab) مطلوب للنشر. يرجى رفعه للمتابعة.');
      } else {
        document.getElementById('dropzoneAAB').style.borderColor = '#cbd5e1';
      }
    }

    if (!isValid && currentStep !== 3) {
      alert('يرجى تعبئة كافة الحقول المطلوبة والموافقة على الشروط للمتابعة.');
    }

    return isValid;
  }

  // Update navigation buttons and UI indicator
  function updateWizardUI() {
    // Update step panel display
    panels.forEach(panel => {
      panel.classList.remove('active');
    });
    document.querySelector(`.wizard-step-panel[data-step="${currentStep}"]`).classList.add('active');

    // Update progress steps visual state
    progressSteps.forEach((step, idx) => {
      const stepNum = idx + 1;
      if (stepNum < currentStep) {
        step.className = 'progress-step completed';
      } else if (stepNum === currentStep) {
        step.className = 'progress-step active';
      } else {
        step.className = 'progress-step';
      }
    });

    // Update connecting line width
    const percentage = ((currentStep - 1) / (totalSteps - 1)) * 100;
    progressLine.style.width = `${percentage}%`;

    // Button states
    if (currentStep === 1) {
      btnPrev.style.visibility = 'hidden';
      btnNext.textContent = 'التالي';
    } else if (currentStep === totalSteps) {
      btnPrev.style.visibility = 'visible';
      btnNext.textContent = 'تأكيد الطلب';
      populateSummary();
    } else {
      btnPrev.style.visibility = 'visible';
      btnNext.textContent = 'التالي';
    }
  }

  // Gather info and compute summary values
  function populateSummary() {
    const orderTypeEl = document.querySelector('input[name="orderType"]:checked');
    const isUpdate = orderTypeEl ? orderTypeEl.value === 'update' : false;
    const nameVal = document.getElementById('devName').value;
    const planRadioEl = document.querySelector('input[name="planSelection"]:checked');
    const planVal = planRadioEl ? planRadioEl.value : 'basic';
    
    let appTitleVal = "";
    let categoryText = "";
    
    if (isUpdate) {
      appTitleVal = document.getElementById('existingAppSelect').value;
      categoryText = "تحديث تطبيق منشور (وراثة الأصول تلقائياً)";
    } else {
      appTitleVal = document.getElementById('appTitle').value;
      const categorySelect = document.getElementById('appCategory');
      categoryText = categorySelect.options[categorySelect.selectedIndex].text;
    }
    
    let price = isUpdate ? 150 : pricingData[planVal].price;
    const planName = isUpdate ? "تحديث تطبيق منشور" : pricingData[planVal].name;
    const updatePrice = isUpdate ? 150 : pricingData[planVal].updatePrice;
    
    let methodText = 'حسابنا الشخصي المعتمد (معفى من شرط الـ 20 مختبراً)';
    
    let asoText = 'غير مشمول (وراثة تلقائية)';
    if (!isUpdate) {
      if (planVal === 'pro' || planVal === 'lifetime') {
        asoText = 'مشمول مجاناً في الباقة';
      } else if (chkAsoAddon && chkAsoAddon.checked) {
        asoText = 'مطلوب (+500 ج.م)';
        price += 500;
      }
    }

    let transferText = 'غير مطلوب';
    if (!isUpdate && chkTransferAddon && chkTransferAddon.checked) {
      transferText = 'مطلوب (+5500 ج.م)';
      price += 5500;
    }

    document.getElementById('sumDevName').textContent = nameVal;
    document.getElementById('sumPlanName').textContent = planName;
    document.getElementById('sumAccountType').textContent = methodText;
    document.getElementById('sumAppTitle').textContent = appTitleVal;
    document.getElementById('sumAppCategory').textContent = categoryText;
    
    const sumAsoAddonEl = document.getElementById('sumAsoAddon');
    if (sumAsoAddonEl) sumAsoAddonEl.textContent = asoText;
    
    const sumTransferAddonEl = document.getElementById('sumTransferAddon');
    if (sumTransferAddonEl) sumTransferAddonEl.textContent = transferText;
    
    document.getElementById('sumTotalPrice').textContent = `${price} ج.م`;

    // Configure success links
    setupDispatchLinks(nameVal, planName, methodText, appTitleVal, categoryText, asoText, transferText, updatePrice, `${price} ج.م`, isUpdate);
  }

  function setupDispatchLinks(devName, planName, methodText, appTitle, appCategory, asoText, transferText, updatePrice, totalPrice, isUpdate) {
    const phone = "201507890092";
    const email = "cedratech1@gmail.com";
    
    let updateText = updatePrice === 0 ? "مجانية بالكامل وللأبد" : `${updatePrice} ج.م للمرة`;

    let orderDetails = "";
    if (isUpdate) {
      const versionVal = document.getElementById('appVersion').value;
      const changelogVal = document.getElementById('changelog').value;
      
      orderDetails = 
`السلام عليكم، أود طلب تحديث تطبيق منشور عبر منصتكم "انشر تطبيقك".

📋 تفاصيل طلب التحديث:
- العميل: ${devName}
- نوع الطلب: تحديث نسخة التطبيق 🚀
- اسم التطبيق: ${appTitle}
- رقم الإصدار الجديد: ${versionVal}
- التغييرات (Changelog): ${changelogVal}
- تكلفة التحديث: ${totalPrice}
- حالة الملفات: تم إرفاق ملف الـ AAB الجديد بنجاح وهو جاهز للمراجعة الفورية.

بانتظار مراجعتكم وتأكيد التفاصيل للبدء والتحويل عبر InstaPay.`;
    } else {
      orderDetails = 
`السلام عليكم، أود طلب خدمة نشر تطبيق جديد عبر منصتكم "انشر تطبيقك".

📋 تفاصيل الطلب:
- العميل: ${devName}
- الباقة المطلوبة: ${planName}
- حساب النشر: ${methodText}
- اسم التطبيق: ${appTitle}
- تصنيف التطبيق: ${appCategory}
- تجهيز أصول التطبيق والـ ASO: ${asoText}
- طلب نقل ملكية التطبيق لاحقاً: ${transferText}
- تكلفة التحديثات اللاحقة: ${updateText}
- إجمالي التكلفة المتوقعة: ${totalPrice}
- حالة الملفات: تم إرفاق ملف الـ AAB والأصول محلياً وجاهزة للإرسال والمراجعة الفورية.

بانتظار مراجعتكم وتأكيد التفاصيل للبدء والتحويل عبر InstaPay.`;
    }

    // WhatsApp url encode
    const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(orderDetails)}`;
    document.getElementById('btnSendWhatsapp').setAttribute('href', whatsappUrl);

    // Email link template
    const emailSubject = isUpdate ? `طلب تحديث تطبيق - ${appTitle}` : `طلب نشر تطبيق جديد - ${appTitle}`;
    const emailUrl = `mailto:${email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(orderDetails)}`;
    document.getElementById('btnSendEmail').setAttribute('href', emailUrl);
  }

  // Submit Form data to FastAPI Backend
  async function submitOrderToServer() {
    // Disable buttons and show loading feedback
    btnNext.disabled = true;
    btnPrev.disabled = true;
    const originalText = btnNext.textContent;
    btnNext.textContent = 'جاري إرسال الطلب والملفات...';

    // Show upload animation modal
    const progressModal = document.getElementById('uploadProgressModal');
    const statusTextEl = document.getElementById('uploadStatusText');
    if (progressModal) {
      progressModal.style.display = 'flex';
    }
    const messages = [
      "جاري تحميل حزمة التطبيق (AAB) وحزم البيانات... ⚙️",
      "جاري تجهيز ونقل الأصول والصور المميزة... 🎨",
      "جاري تهيئة النشر والربط الآمن مع سحابة Cloudflare R2... 🛡️",
      "تأمين تسليم الملفات إلى كونسول النشر... 🚚",
      "ثوانٍ قليلة ويكتمل النقل... 🌟"
    ];
    let msgIndex = 0;
    const statusInterval = setInterval(() => {
      msgIndex = (msgIndex + 1) % messages.length;
      if (statusTextEl) {
        statusTextEl.textContent = messages[msgIndex];
      }
    }, 2500);

    // ⚡ Double-rAF technique: guarantees the browser has painted the modal
    // before any async/network code runs. More reliable than setTimeout.
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    // ⏳ Guarantee animation shows for at LEAST 3 seconds.
    const minimumDisplayDelay = new Promise(r => setTimeout(r, 3000));

    const orderTypeCheckEl = document.querySelector('input[name="orderType"]:checked');
    const isUpdate = orderTypeCheckEl ? orderTypeCheckEl.value === 'update' : false;
    
    // 1. Gather all form inputs
    const devName = document.getElementById('devName').value;
    const devPhone = document.getElementById('devPhone').value;
    const devEmail = document.getElementById('devEmail').value;
    const planSelectionEl = document.querySelector('input[name="planSelection"]:checked');
    const planSelection = isUpdate ? 'update' : (planSelectionEl ? planSelectionEl.value : 'basic');
    const appTitle = isUpdate ? document.getElementById('existingAppSelect').value : document.getElementById('appTitle').value;
    
    let appCategory = "";
    let appShortDesc = "";
    let appLongDesc = "";
    let hasAsoAddon = false;
    let hasTransferAddon = false;
    let privacyLink = "";
    let price = 150;
    let appVersion = "1.0.0";
    let changelog = "";

    if (!isUpdate) {
      const categorySelect = document.getElementById('appCategory');
      appCategory = categorySelect.options[categorySelect.selectedIndex].text;
      appShortDesc = document.getElementById('appShortDesc').value;
      appLongDesc = document.getElementById('appLongDesc').value;
      hasAsoAddon = chkAsoAddon && chkAsoAddon.checked;
      hasTransferAddon = chkTransferAddon && chkTransferAddon.checked;
      privacyLink = document.getElementById('privacyLink').value;
      
      price = pricingData[planSelection].price;
      if (planSelection === 'basic' && hasAsoAddon) {
        price += 500;
      }
      if (hasTransferAddon) {
        price += 5500;
      }
    } else {
      appVersion = document.getElementById('appVersion').value;
      changelog = document.getElementById('changelog').value;
    }

    // 2. Build FormData object
    const formData = new FormData();
    formData.append('dev_name', devName);
    formData.append('dev_phone', devPhone);
    formData.append('dev_email', devEmail);
    formData.append('plan_selection', planSelection);
    formData.append('app_title', appTitle);
    
    if (!isUpdate) {
      formData.append('app_category', appCategory);
      formData.append('app_short_desc', appShortDesc);
      formData.append('app_long_desc', appLongDesc);
      formData.append('has_aso_addon', hasAsoAddon ? 'true' : 'false');
      formData.append('has_transfer_addon', hasTransferAddon ? 'true' : 'false');
      if (privacyLink) {
        formData.append('privacy_link', privacyLink);
      }
    }
    
    formData.append('total_price', price.toString());
    formData.append('app_version', appVersion);
    if (changelog) {
      formData.append('changelog', changelog);
    }

    // 3. Append uploaded files
    if (!isUpdate) {
      if (uploadedFiles.icon) {
        formData.append('file_icon', uploadedFiles.icon);
      }
      if (uploadedFiles.feature) {
        formData.append('file_feature', uploadedFiles.feature);
      }
      if (uploadedFiles.screenshots && uploadedFiles.screenshots.length > 0) {
        uploadedFiles.screenshots.forEach((file) => {
          formData.append('file_screenshots', file);
        });
      }
    }
    if (uploadedFiles.aab) {
      formData.append('file_aab', uploadedFiles.aab);
    }

    // 4. Send request — run fetch and minimum display timer in parallel
    let fetchError = null;
    let fetchSuccess = false;

    const fetchPromise = (async () => {
      const response = await fetch(`${API_BASE}/api/orders`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
        },
        body: formData
      });
      if (!response.ok) {
        throw new Error(`Server returned code ${response.status}`);
      }
      return response;
    })();

    // Wait for BOTH: the server reply AND the 3-second minimum display time
    try {
      await Promise.all([fetchPromise, minimumDisplayDelay]);
      fetchSuccess = true;
    } catch (err) {
      // Still wait for minimum display even on error
      await minimumDisplayDelay.catch(() => {});
      fetchError = err;
    }

    // 5. Clean up animation
    clearInterval(statusInterval);
    if (progressModal) {
      progressModal.style.display = 'none';
    }

    if (fetchError) {
      console.error('Error submitting order:', fetchError);
      alert('حدث خطأ أثناء إرسال طلبك والملفات إلى الخادم. يرجى التحقق من اتصالك بالشبكة والمحاولة مرة أخرى.');
      btnNext.disabled = false;
      btnPrev.disabled = false;
      btnNext.textContent = originalText;
    } else {
      // Order submitted successfully
      showSuccessState();
    }
  }


  // Navigation click listeners
  btnNext.addEventListener('click', () => {
    if (currentStep < totalSteps) {
      if (validateCurrentStep()) {
        currentStep++;
        updateWizardUI();
      }
    } else {
      // Trigger backend submit
      submitOrderToServer();
    }
  });

  btnPrev.addEventListener('click', () => {
    if (currentStep > 1) {
      currentStep--;
      updateWizardUI();
    }
  });

  function showSuccessState() {
    // Hide footer buttons & steps panels
    panels.forEach(p => p.classList.remove('active'));
    wizardFooter.style.display = 'none';
    const progressEl = document.getElementById('wizardProgress');
    if (progressEl) progressEl.style.display = 'none';
    
    // Show success panel
    successPanel.style.display = 'block';
  }

  // Run initializations
  updateAddonStates();
  handleOrderTypeChange('new');
  fetchUserApps();
});
