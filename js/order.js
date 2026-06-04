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

  // Check URL parameters to pre-fill Plan
  const urlParams = new URLSearchParams(window.location.search);
  const planParam = urlParams.get('plan');

  if (planParam) {
    const planRadio = document.querySelector(`input[name="planSelection"][value="${planParam}"]`);
    if (planRadio) planRadio.checked = true;
  }

  const chkAsoAddon = document.getElementById('chkAsoAddon');
  const chkTransferAddon = document.getElementById('chkTransferAddon');

  function updateAddonStates() {
    const selectedPlan = document.querySelector('input[name="planSelection"]:checked').value;
    
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

  // Run initial state update
  updateAddonStates();
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
    const nameVal = document.getElementById('devName').value;
    const planVal = document.querySelector('input[name="planSelection"]:checked').value;
    const appTitleVal = document.getElementById('appTitle').value;
    const categorySelect = document.getElementById('appCategory');
    const categoryText = categorySelect.options[categorySelect.selectedIndex].text;
    
    let price = pricingData[planVal].price;
    const planName = pricingData[planVal].name;
    const updatePrice = pricingData[planVal].updatePrice;
    
    let methodText = 'Cedra Tech (حسابنا الرسمي المعتمد)';
    
    let asoText = 'غير مشمول';
    if (planVal === 'pro' || planVal === 'lifetime') {
      asoText = 'مشمول مجاناً في الباقة';
    } else if (chkAsoAddon && chkAsoAddon.checked) {
      asoText = 'مطلوب (+500 ج.م)';
      price += 500;
    }

    let transferText = 'غير مطلوب';
    if (chkTransferAddon && chkTransferAddon.checked) {
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
    setupDispatchLinks(nameVal, planName, methodText, appTitleVal, categoryText, asoText, transferText, updatePrice, `${price} ج.م`);
  }

  function setupDispatchLinks(devName, planName, methodText, appTitle, appCategory, asoText, transferText, updatePrice, totalPrice) {
    const phone = "201507890092";
    const email = "cedratech1@gmail.com";
    
    let updateText = updatePrice === 0 ? "مجانية بالكامل وللأبد" : `${updatePrice} ج.م للمرة`;

    // Text summary formatted nicely
    const orderDetails = 
`السلام عليكم، أود طلب خدمة نشر تطبيق عبر منصتكم "انشر تطبيقك".

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

    // WhatsApp url encode
    const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(orderDetails)}`;
    document.getElementById('btnSendWhatsapp').setAttribute('href', whatsappUrl);

    // Email link template
    const emailSubject = `طلب نشر تطبيق جديد - ${appTitle}`;
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

    // 1. Gather all form inputs
    const devName = document.getElementById('devName').value;
    const devPhone = document.getElementById('devPhone').value;
    const devEmail = document.getElementById('devEmail').value;
    const planSelection = document.querySelector('input[name="planSelection"]:checked').value;
    const appTitle = document.getElementById('appTitle').value;
    
    const categorySelect = document.getElementById('appCategory');
    const appCategory = categorySelect.options[categorySelect.selectedIndex].text;
    
    const appShortDesc = document.getElementById('appShortDesc').value;
    const appLongDesc = document.getElementById('appLongDesc').value;
    
    const hasAsoAddon = chkAsoAddon && chkAsoAddon.checked;
    const hasTransferAddon = chkTransferAddon && chkTransferAddon.checked;
    const privacyLink = document.getElementById('privacyLink').value;
    
    // Calculate total price same as populateSummary
    let price = pricingData[planSelection].price;
    if (planSelection === 'basic' && hasAsoAddon) {
      price += 500;
    }
    if (hasTransferAddon) {
      price += 5500;
    }

    // 2. Build FormData object
    const formData = new FormData();
    formData.append('dev_name', devName);
    formData.append('dev_phone', devPhone);
    formData.append('dev_email', devEmail);
    formData.append('plan_selection', planSelection);
    formData.append('app_title', appTitle);
    formData.append('app_category', appCategory);
    formData.append('app_short_desc', appShortDesc);
    formData.append('app_long_desc', appLongDesc);
    formData.append('has_aso_addon', hasAsoAddon ? 'true' : 'false');
    formData.append('has_transfer_addon', hasTransferAddon ? 'true' : 'false');
    if (privacyLink) {
      formData.append('privacy_link', privacyLink);
    }
    formData.append('total_price', price.toString());

    // 3. Append uploaded files
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
    if (uploadedFiles.aab) {
      formData.append('file_aab', uploadedFiles.aab);
    }

    // 4. Send request to FastAPI backend
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Server returned code ${response.status}`);
      }

      // Order submitted successfully, show success panel
      showSuccessState();
    } catch (err) {
      console.error('Error submitting order:', err);
      alert('حدث خطأ أثناء إرسال طلبك والملفات إلى الخادم. يرجى التحقق من اتصالك بالشبكة والمحاولة مرة أخرى.');
      
      // Restore button states
      btnNext.disabled = false;
      btnPrev.disabled = false;
      btnNext.textContent = originalText;
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
    document.getElementById('wizardProgress').style.display = 'none';
    
    // Show success panel
    successPanel.style.display = 'block';
  }
});
