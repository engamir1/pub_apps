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
    starter: { price: 500, name: "خطة الانطلاق" },
    pro: { price: 1200, name: "خطة النشر الاحترافية" },
    vip: { price: 2500, name: "الخطة الكاملة (VIP)" }
  };

  // Check URL parameters to pre-fill Plan
  const urlParams = new URLSearchParams(window.location.search);
  const planParam = urlParams.get('plan');

  if (planParam) {
    const planRadio = document.querySelector(`input[name="planSelection"][value="${planParam}"]`);
    if (planRadio) planRadio.checked = true;
  }

  // Handle plan radio changes
  document.querySelectorAll('input[name="planSelection"]').forEach(radio => {
    radio.addEventListener('change', () => {
      // Static labels are updated in HTML
    });
  });

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
      btnNext.textContent = 'تأكيد وحفظ الطلب';
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
    
    const price = pricingData[planVal].price;
    const planName = pricingData[planVal].name;
    const methodText = planVal === 'starter' ? 'غير مشمول (ASO وتصميم فقط)' : 'Cedra Tech (حسابنا الرسمي المعتمد)';

    document.getElementById('sumDevName').textContent = nameVal;
    document.getElementById('sumPlanName').textContent = planName;
    document.getElementById('sumAccountType').textContent = methodText;
    document.getElementById('sumAppTitle').textContent = appTitleVal;
    document.getElementById('sumAppCategory').textContent = categoryText;
    document.getElementById('sumTotalPrice').textContent = `${price} ج.م`;

    // Configure success links
    setupDispatchLinks(nameVal, planName, methodText, appTitleVal, categoryText, `${price} ج.م`);
  }

  function setupDispatchLinks(devName, planName, methodText, appTitle, appCategory, totalPrice) {
    const phone = "201507890092";
    const email = "cedratech1@gmail.com";

    // Text summary formatted nicely
    const orderDetails = 
`السلام عليكم، أود طلب خدمة نشر تطبيق عبر منصتكم "انشر تطبيقك".

📋 تفاصيل الطلب:
- العميل: ${devName}
- الباقة: ${planName}
- حساب النشر: ${methodText}
- اسم التطبيق: ${appTitle}
- تصنيف التطبيق: ${appCategory}
- إجمالي التكلفة المتوقعة: ${totalPrice}
- التحديثات اللاحقة: تبدأ من 3 دولار (150 ج.م) للمرة الواحدة.
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

  // Navigation click listeners
  btnNext.addEventListener('click', () => {
    if (currentStep < totalSteps) {
      if (validateCurrentStep()) {
        currentStep++;
        updateWizardUI();
      }
    } else {
      // Trigger checkout / success state
      showSuccessState();
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
