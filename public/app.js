(function () {
  const STORAGE_KEYS = {
    lang: 'fixlyLanguage',
    token: 'fixlyAuthToken',
    session: 'fixlySession',
    activeTechId: 'fixlyActiveTechId'
  };

  const DEFAULT_TECH_ID = 'tech-ali-ben-salah';
  const API_BASE = '/api';
  const pageName = normalizePageName(location.pathname.split('/').pop() || 'index.html');

  document.addEventListener('DOMContentLoaded', () => {
    injectResponsiveFixes();
    initLanguage();
    initSessionUi();
    initNativeValidation();
    initRegisterPages();
    initLoginPages();
    initPostPage();
    initProfilePage();
    initTechPage();
    initIndexPage();
    initTopRatedPage();
    initNotificationsPage();
    initGlobalActions();
  });

  function normalizePageName(name) {
    return String(name || '').replace(/\(\d+\)/g, '').toLowerCase();
  }

  function currentLang() {
    return localStorage.getItem(STORAGE_KEYS.lang) || 'fr';
  }

  function setSession(data) {
    if (!data) {
      localStorage.removeItem(STORAGE_KEYS.session);
      return;
    }
    localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(data));
  }

  function getSession() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.session) || 'null');
  }

  function setToken(token) {
    if (!token) {
      localStorage.removeItem(STORAGE_KEYS.token);
      return;
    }
    localStorage.setItem(STORAGE_KEYS.token, token);
  }

  function getToken() {
    return localStorage.getItem(STORAGE_KEYS.token) || '';
  }

  function clearAuth() {
    setToken('');
    setSession(null);
  }

  async function apiFetch(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
    let data = {};
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) {
      if (response.status === 401) {
        clearAuth();
        renderSessionUi();
      }
      throw new Error(data.error || 'Request failed');
    }
    return data;
  }


  function initSessionUi() {
    renderSessionUi();
    const token = getToken();
    if (!token) return;
    apiFetch('/me').then(result => {
      setSession({ ...(getSession() || {}), ...(result.session || {}) });
      renderSessionUi();
    }).catch(() => {
      clearAuth();
      renderSessionUi();
    });
  }

  function renderSessionUi() {
    const host = document.querySelector('.navbar .ms-auto');
    if (!host) return;
    let wrap = document.querySelector('#fixlySessionActions');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'fixlySessionActions';
      wrap.className = 'd-flex align-items-center gap-2';
      host.insertBefore(wrap, host.firstChild);
    }
    const session = getSession();
    if (!session) {
      wrap.innerHTML = '';
      return;
    }
    const expires = session.expiresAt ? new Date(session.expiresAt).toLocaleString() : '';
    wrap.innerHTML = `<span class="badge text-bg-light" style="border-radius:999px;padding:10px 14px;">${escapeHtml(session.fullName || session.email || '')}</span><button type="button" id="fixlyLogoutBtn" class="btn btn-sm btn-outline-dark" style="border-radius:999px;">${escapeHtml(getText('common.logout') || 'Logout')}</button>`;
    const btn = wrap.querySelector('#fixlyLogoutBtn');
    if (btn) {
      btn.title = expires ? `${getText('common.sessionUntil') || 'Session until'} ${expires}` : '';
      btn.onclick = async () => {
        try { await apiFetch('/logout', { method: 'POST' }); } catch (_) {}
        clearAuth();
        renderSessionUi();
        if (['post.html','tech.html','profile.html'].includes(pageName)) location.href = 'index.html';
      };
    }
  }

  function showMessage(container, message, type) {
    if (!container) return;
    container.innerHTML = `<div class="alert alert-${type === 'success' ? 'success' : 'danger'} mb-3" role="alert">${escapeHtml(message)}</div>`;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
  }

  function isValidPhone(value) {
    return /^\d{8,15}$/.test(String(value).trim());
  }

  function getPasswordErrors(value) {
    const password = String(value || '');
    const errors = [];
    if (password.length < 8) errors.push(getText('common.passwordMin'));
    if (!/[a-z]/.test(password)) errors.push(getText('common.passwordLower'));
    if (!/[A-Z]/.test(password)) errors.push(getText('common.passwordUpper'));
    if (!/\d/.test(password)) errors.push(getText('common.passwordDigit'));
    if (!/[^A-Za-z0-9]/.test(password)) errors.push(getText('common.passwordSpecial'));
    return errors;
  }

  function brandName() {
    return 'TUNIFIX';
  }

  function initGlobalActions() {
    // Make decorative mini-badges clickable when they represent a navigation action
    const actionMap = {
      badgeFindTech: 'post.html#directorySection',
      badgeFindJob: 'login-technician.html',
      badgePostNeed: 'post.html#requestFormSection',
      badgeReceiveJobs: 'register-technician.html'
    };
    Object.entries(actionMap).forEach(([id, href]) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.style.cursor = 'pointer';
      el.setAttribute('role', 'link');
      el.tabIndex = 0;
      const go = () => location.href = href;
      el.addEventListener('click', go);
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });

    // Generic signup chooser page
    const registerBoxClient = document.querySelector('#registerChooseClient');
    const registerBoxTechnician = document.querySelector('#registerChooseTechnician');
    const registerContinueBtn = document.querySelector('#registerContinueBtn');
    if (registerContinueBtn && registerBoxClient && registerBoxTechnician) {
      let selected = 'client';
      const sync = () => {
        registerBoxClient.classList.toggle('active', selected === 'client');
        registerBoxTechnician.classList.toggle('active', selected === 'technician');
      };
      registerBoxClient.style.cursor = 'pointer';
      registerBoxTechnician.style.cursor = 'pointer';
      registerBoxClient.addEventListener('click', () => { selected = 'client'; sync(); });
      registerBoxTechnician.addEventListener('click', () => { selected = 'technician'; sync(); });
      registerContinueBtn.addEventListener('click', () => {
        location.href = selected === 'client' ? 'register-client.html' : 'register-technician.html';
      });
      sync();
    }

    // Optional placeholder links that should not be dead
    document.querySelectorAll('a[data-placeholder-link="true"]').forEach(link => {
      if (!link.getAttribute('href') || link.getAttribute('href') === '#') {
        link.href = 'index.html';
      }
    });
  }

  function initLanguage() {
    const selectors = document.querySelectorAll('.lang-select');
    selectors.forEach(select => {
      select.innerHTML = [
        '<option value="fr">Français</option>',
        '<option value="en">English</option>',
        '<option value="ar">العربية</option>'
      ].join('');
      select.value = currentLang();
      select.addEventListener('change', () => {
        localStorage.setItem(STORAGE_KEYS.lang, select.value);
        selectors.forEach(other => other.value = select.value);
        applyTranslations(select.value);
      });
    });
    applyTranslations(currentLang());
  }

  function setText(selector, value) {
    const el = document.querySelector(selector);
    if (el) el.innerHTML = value;
  }

  function setPlaceholder(selector, value) {
    const el = document.querySelector(selector);
    if (el) el.placeholder = value;
  }

  function setValue(selector, value) {
    const el = document.querySelector(selector);
    if (el) el.value = value;
  }

  function applyTranslations(lang) {
    document.documentElement.lang = lang;
    document.body.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.body.classList.toggle('rtl-layout', lang === 'ar');

    document.querySelectorAll('.lang-select').forEach(select => {
      const options = select.querySelectorAll('option');
      if (options[0]) options[0].textContent = getText('lang.fr');
      if (options[1]) options[1].textContent = getText('lang.en');
      if (options[2]) options[2].textContent = getText('lang.ar');
    });

    document.querySelectorAll('[data-i18n]').forEach(el => {
      const value = getText(el.getAttribute('data-i18n'));
      if (value && value !== el.getAttribute('data-i18n')) el.innerHTML = value;
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const value = getText(el.getAttribute('data-i18n-placeholder'));
      if (value && value !== el.getAttribute('data-i18n-placeholder')) el.placeholder = value;
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const value = getText(el.getAttribute('data-i18n-title'));
      if (value && value !== el.getAttribute('data-i18n-title')) el.title = value;
    });

    const pageTitleKey = pageTitleMap[pageName];
    if (pageTitleKey) document.title = getText(pageTitleKey);

    const p = pageTranslations[pageName];
    if (!p) return;
    document.title = p.title?.[lang] || p.title?.fr || document.title;

    Object.entries(p.text || {}).forEach(([selector, values]) => {
      setText(selector, values[lang] || values.fr || '');
    });

    Object.entries(p.placeholders || {}).forEach(([selector, values]) => {
      setPlaceholder(selector, values[lang] || values.fr || '');
    });

    Object.entries(p.values || {}).forEach(([selector, values]) => {
      setValue(selector, values[lang] || values.fr || '');
    });
    renderSessionUi();
  }

  function initNativeValidation() {
    document.querySelectorAll('input[type="email"], input[name="email"]').forEach(input => {
      input.setAttribute('type', 'email');
      input.setAttribute('required', 'required');
      input.setAttribute('autocomplete', 'email');
      input.setAttribute('inputmode', 'email');
      input.setAttribute('pattern', "^[^\s@]+@[^\s@]+\.[^\s@]+$");
    });

    document.querySelectorAll('input[name="phone"]').forEach(input => {
      input.setAttribute('required', 'required');
      input.setAttribute('inputmode', 'numeric');
      input.setAttribute('pattern', "^\d{8,15}$");
      input.setAttribute('minlength', '8');
      input.setAttribute('maxlength', '15');
      input.setAttribute('autocomplete', 'tel');
    });

    document.querySelectorAll('input[name="password"]').forEach(input => {
      input.setAttribute('required', 'required');
      input.setAttribute('minlength', '8');
      input.setAttribute('autocomplete', 'new-password');
      input.setAttribute('pattern', "^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$");
    });

    document.querySelectorAll('input[name="confirmPassword"]').forEach(input => {
      input.setAttribute('required', 'required');
      input.setAttribute('minlength', '8');
      input.setAttribute('autocomplete', 'new-password');
    });
  }

  function initRegisterPages() {
    initClientRegister();
    initTechRegister();
  }

  function initClientRegister() {
    const form = document.querySelector('#clientRegisterForm');
    if (!form) return;

    const phoneInput = form.querySelector('[name="phone"]');
    const passwordInput = form.querySelector('[name="password"]');
    const emailInput = form.querySelector('[name="email"]');

    if (phoneInput) {
      phoneInput.addEventListener('input', () => {
        phoneInput.value = phoneInput.value.replace(/\D+/g, '');
      });
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const feedback = form.querySelector('.form-feedback');
      const fullName = form.querySelector('[name="fullName"]').value.trim();
      const email = emailInput.value.trim().toLowerCase();
      const phone = phoneInput.value.trim();
      const city = form.querySelector('[name="city"]').value.trim();
      const password = passwordInput.value;
      const confirmPassword = form.querySelector('[name="confirmPassword"]').value;

      if (fullName.length < 3) return showMessage(feedback, getText('clientRegister.nameError'), 'error');
      if (!isValidEmail(email)) return showMessage(feedback, getText('common.emailError'), 'error');
      if (!isValidPhone(phone)) return showMessage(feedback, getText('common.phoneError'), 'error');
      if (city.length < 2) return showMessage(feedback, getText('clientRegister.cityError'), 'error');
      const passwordErrors = getPasswordErrors(password);
      if (passwordErrors.length) return showMessage(feedback, passwordErrors.join(' '), 'error');
      if (password !== confirmPassword) return showMessage(feedback, getText('common.confirmPasswordError'), 'error');

      try {
        const result = await apiFetch('/register/client', {
          method: 'POST',
          body: JSON.stringify({ fullName, email, phone, city, password })
        });
        setToken(result.token);
        setSession({ ...result.user, ...(result.session || {}) });
        showMessage(feedback, getText('clientRegister.success'), 'success');
        setTimeout(() => location.href = 'post.html', 700);
      } catch (error) {
        showMessage(feedback, mapServerError(error.message), 'error');
      }
    });
  }

  function initTechRegister() {
    const form = document.querySelector('#technicianRegisterForm');
    if (!form) return;

    const phoneInput = form.querySelector('[name="phone"]');
    const emailInput = form.querySelector('[name="email"]');
    const passwordInput = form.querySelector('[name="password"]');
    const profileImageInput = form.querySelector('[name="profileImage"]');
    const profileImagePreview = form.querySelector('#technicianProfileImagePreview');

    if (phoneInput) {
      phoneInput.addEventListener('input', () => {
        phoneInput.value = phoneInput.value.replace(/\D+/g, '');
      });
    }
    if (profileImageInput && profileImagePreview) {
      profileImageInput.addEventListener('change', async () => {
        const images = await readFilesAsDataUrls(profileImageInput.files || []);
        profileImagePreview.innerHTML = images[0]
          ? `<img src="${images[0]}" alt="preview" style="width:110px;height:110px;object-fit:cover;border-radius:50%;border:3px solid #f3a8c3;box-shadow:0 10px 24px rgba(8,61,60,.10);">`
          : '';
      });
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const feedback = form.querySelector('.form-feedback');
      const payload = {
        fullName: form.querySelector('[name="fullName"]').value.trim(),
        email: emailInput.value.trim().toLowerCase(),
        phone: phoneInput.value.trim(),
        city: form.querySelector('[name="city"]').value.trim(),
        specialty: form.querySelector('[name="specialty"]').value.trim(),
        experience: form.querySelector('[name="experience"]').value.trim(),
        password: passwordInput.value,
        profileImage: ''
      };
      const confirmPassword = form.querySelector('[name="confirmPassword"]').value;
      if (profileImageInput?.files?.length) {
        const images = await readFilesAsDataUrls(profileImageInput.files || []);
        payload.profileImage = images[0] || '';
      }

      if (payload.fullName.length < 3) return showMessage(feedback, getText('techRegister.nameError'), 'error');
      if (!isValidEmail(payload.email)) return showMessage(feedback, getText('common.emailError'), 'error');
      if (!isValidPhone(payload.phone)) return showMessage(feedback, getText('common.phoneError'), 'error');
      if (payload.city.length < 2) return showMessage(feedback, getText('techRegister.cityError'), 'error');
      if (payload.specialty.length < 2) return showMessage(feedback, getText('techRegister.specialtyError'), 'error');
      if (!payload.experience) return showMessage(feedback, getText('techRegister.experienceError'), 'error');
      const passwordErrors = getPasswordErrors(payload.password);
      if (passwordErrors.length) return showMessage(feedback, passwordErrors.join(' '), 'error');
      if (payload.password !== confirmPassword) return showMessage(feedback, getText('common.confirmPasswordError'), 'error');

      try {
        const result = await apiFetch('/register/technician', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        setToken(result.token);
        setSession({ ...result.user, ...(result.session || {}) });
        localStorage.setItem(STORAGE_KEYS.activeTechId, result.user.id);
        showMessage(feedback, getText('techRegister.success'), 'success');
        setTimeout(() => location.href = 'tech.html', 700);
      } catch (error) {
        showMessage(feedback, mapServerError(error.message), 'error');
      }
    });
  }

  function initLoginPages() {
    initClientLogin();
    initTechLogin();
  }

  function initClientLogin() {
    const form = document.querySelector('#clientLoginForm');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = form.querySelector('[name="email"]').value.trim().toLowerCase();
      const password = form.querySelector('[name="password"]').value;
      const feedback = form.querySelector('.form-feedback');

      if (!isValidEmail(email)) return showMessage(feedback, getText('common.emailError'), 'error');
      if (!password) return showMessage(feedback, getText('common.loginPasswordRequired'), 'error');

      try {
        const result = await apiFetch('/login/client', {
          method: 'POST',
          body: JSON.stringify({ email, password })
        });
        setToken(result.token);
        setSession({ ...result.user, ...(result.session || {}) });
        showMessage(feedback, getText('clientLogin.success'), 'success');
        setTimeout(() => location.href = 'post.html', 500);
      } catch (error) {
        showMessage(feedback, mapServerError(error.message), 'error');
      }
    });
  }

  function initTechLogin() {
    const form = document.querySelector('#technicianLoginForm');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = form.querySelector('[name="email"]').value.trim().toLowerCase();
      const password = form.querySelector('[name="password"]').value;
      const feedback = form.querySelector('.form-feedback');

      if (!isValidEmail(email)) return showMessage(feedback, getText('common.emailError'), 'error');
      if (!password) return showMessage(feedback, getText('common.loginPasswordRequired'), 'error');

      try {
        const result = await apiFetch('/login/technician', {
          method: 'POST',
          body: JSON.stringify({ email, password })
        });
        setToken(result.token);
        setSession({ ...result.user, ...(result.session || {}) });
        localStorage.setItem(STORAGE_KEYS.activeTechId, result.user.id);
        showMessage(feedback, getText('techLogin.success'), 'success');
        setTimeout(() => location.href = 'tech.html', 500);
      } catch (error) {
        showMessage(feedback, mapServerError(error.message), 'error');
      }
    });
  }

  function initPostPage() {
    const form = document.querySelector('#requestForm');
    if (!form) return;

    let editingRequestId = null;
    const feedback = form.querySelector('.form-feedback');
    const imageInput = document.querySelector('#requestImages');
    const preview = document.querySelector('#requestImagePreview');
    const submitBtn = document.querySelector('#requestSubmit');

    const phoneInput = form.querySelector('[name="phone"]');
    if (phoneInput) {
      phoneInput.addEventListener('input', () => {
        phoneInput.value = phoneInput.value.replace(/\D+/g, '');
      });
    }

    if (imageInput) {
      imageInput.addEventListener('change', async () => {
        renderImagePreview(await readFilesAsDataUrls(imageInput.files || []));
      });
    }

    hydrateFromSession();
    loadClientDashboard();
    loadTechnicianDirectory();
    enforceClientPageAccess();

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const payload = await collectRequestPayload(editingRequestId);
        if (editingRequestId) {
          await apiFetch(`/requests/${editingRequestId}`, { method: 'PUT', body: JSON.stringify(payload) });
          showMessage(feedback, getText('post.updatedSuccess') || 'Demande mise à jour avec succès.', 'success');
        } else {
          await apiFetch('/requests', { method: 'POST', body: JSON.stringify(payload) });
          showMessage(feedback, getText('post.success'), 'success');
        }
        resetRequestForm();
        await loadClientDashboard();
      } catch (error) {
        showMessage(feedback, mapServerError(error.message), 'error');
      }
    });

    function hydrateFromSession() {
      const session = getSession();
      if (session?.role === 'client') {
        setValue('#requestFullName', session.fullName || '');
        setValue('#requestEmail', session.email || '');
      }
    }

    function enforceClientPageAccess() {
      const session = getSession();
      if (!session) {
        showMessage(feedback, getText('common.clientLoginRequired') || 'Connexion client requise.', 'error');
        disableRequestForm();
        return;
      }
      if (session.role !== 'client') {
        showMessage(feedback, getText('common.clientLoginRequired') || 'Connexion client requise.', 'error');
        disableRequestForm();
        setTimeout(() => { location.href = session.role === 'technician' ? 'tech.html' : 'login-client.html'; }, 1200);
      }
    }

    function disableRequestForm() {
      form.querySelectorAll('input, select, textarea, button').forEach(el => {
        if (el.id === 'requestSubmit') {
          el.disabled = true;
          return;
        }
        if (!['button', 'submit'].includes((el.type || '').toLowerCase())) el.disabled = true;
      });
    }

    async function collectRequestPayload(currentId) {
      const data = Object.fromEntries(new FormData(form).entries());
      Object.keys(data).forEach(key => data[key] = String(data[key]).trim());
      if (data.fullName.length < 3) throw new Error(getText('post.nameError'));
      if (!isValidEmail(data.email)) throw new Error(getText('common.emailError'));
      if (!isValidPhone(data.phone)) throw new Error(getText('common.phoneError'));
      if (data.city.length < 2) throw new Error(getText('post.cityError'));
      if (data.title.length < 5) throw new Error(getText('post.titleError'));
      if (data.description.length < 10) throw new Error(getText('post.descriptionError'));
      const selectedImages = await readFilesAsDataUrls(imageInput?.files || []);
      if (selectedImages.length) data.images = selectedImages;
      else if (currentId) {
        const current = (window.__fixlyClientRequests || []).find(item => item.id === currentId);
        data.images = current?.images || [];
      } else data.images = [];
      return data;
    }

    async function loadClientDashboard() {
      const list = document.querySelector('#clientRequestsList');
      const stats = document.querySelector('#clientStats');
      const session = getSession();
      if (!list || !stats) return;
      if (!session || session.role !== 'client') {
        stats.innerHTML = '';
        list.innerHTML = `<div class="alert alert-secondary">${escapeHtml(getText('dashboard.loginNeeded') || 'Connectez-vous comme client pour gérer vos demandes.')}</div>`;
        return;
      }
      try {
        const result = await apiFetch('/requests');
        const requests = result.requests || [];
        window.__fixlyClientRequests = requests;
        const open = requests.filter(r => r.status === 'open').length;
        const assigned = requests.filter(r => r.status === 'assigned').length;
        const completed = requests.filter(r => r.status === 'completed').length;
        stats.innerHTML = [
          statBadge(`${requests.length} ${getText('dashboard.totalRequests') || 'demandes'}`),
          statBadge(`${open} ${getText('dashboard.open') || 'ouvertes'}`),
          statBadge(`${assigned} ${getText('dashboard.assigned') || 'assignées'}`),
          statBadge(`${completed} ${getText('dashboard.completed') || 'terminées'}`)
        ].join('');
        if (!requests.length) {
          list.innerHTML = `<div class="alert alert-secondary">${escapeHtml(getText('dashboard.noRequests') || 'Aucune demande pour le moment.')}</div>`;
          return;
        }
        list.innerHTML = requests.map(request => `
          <div class="card mb-3" style="border:none;border-radius:22px;box-shadow:0 8px 24px rgba(8,61,60,.08);">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-start gap-2 flex-wrap mb-2">
                <div>
                  <h5 style="font-weight:800;margin-bottom:6px;">${escapeHtml(request.title)}</h5>
                  <div class="text-muted">${escapeHtml(request.city)} • ${escapeHtml(request.service)} • ${escapeHtml(request.urgency)}</div>
                </div>
                <span class="badge text-bg-${request.status === 'completed' ? 'success' : request.status === 'assigned' ? 'warning' : 'secondary'}">${escapeHtml(statusLabel(request.status))}</span>
              </div>
              <p class="mb-2">${escapeHtml(request.description)}</p>
              ${renderSmallImages(request.images || [])}
              <div class="d-flex gap-2 flex-wrap mt-3">
                ${request.status === 'open' ? `<button type="button" class="btn btn-sm btn-outline-dark request-edit-btn" data-id="${escapeHtml(request.id)}">${escapeHtml(getText('dashboard.editBtn') || 'Modifier')}</button><button type="button" class="btn btn-sm btn-outline-danger request-delete-btn" data-id="${escapeHtml(request.id)}">${escapeHtml(getText('dashboard.deleteBtn') || 'Supprimer')}</button>` : ''}
                <span class="badge text-bg-light">${request.reviewByClientId ? (getText('dashboard.reviewed') || 'Avis laissé') : (request.status === 'completed' ? (getText('dashboard.notReviewed') || 'Avis non laissé') : (getText('dashboard.awaitingReview') || 'En attente'))}</span>
              </div>
            </div>
          </div>
        `).join('');
        list.querySelectorAll('.request-edit-btn').forEach(btn => btn.addEventListener('click', () => startEdit(btn.dataset.id)));
        list.querySelectorAll('.request-delete-btn').forEach(btn => btn.addEventListener('click', () => deleteRequest(btn.dataset.id)));
      } catch (error) {
        list.innerHTML = `<div class="alert alert-danger">${escapeHtml(mapServerError(error.message))}</div>`;
      }
    }

    function startEdit(requestId) {
      const request = (window.__fixlyClientRequests || []).find(item => item.id === requestId);
      if (!request) return;
      editingRequestId = requestId;
      setValue('#requestFullName', request.fullName || '');
      setValue('#requestEmail', request.email || '');
      setValue('#requestPhone', request.phone || '');
      setValue('#requestService', request.service || '');
      setValue('#requestUrgency', request.urgency || '');
      setValue('#requestCity', request.city || '');
      setValue('#requestTitle', request.title || '');
      setValue('#requestDescription', request.description || '');
      submitBtn.textContent = getText('dashboard.saveEdit') || 'Enregistrer les modifications';
      renderImagePreview(request.images || []);
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    async function deleteRequest(requestId) {
      if (!confirm(getText('dashboard.confirmDelete') || 'Supprimer cette demande ?')) return;
      try {
        await apiFetch(`/requests/${requestId}`, { method: 'DELETE' });
        if (editingRequestId === requestId) resetRequestForm();
        await loadClientDashboard();
      } catch (error) {
        showMessage(feedback, mapServerError(error.message), 'error');
      }
    }

    function resetRequestForm() {
      editingRequestId = null;
      form.reset();
      hydrateFromSession();
      submitBtn.textContent = getText('post.submit') || 'Envoyer le problème';
      renderImagePreview([]);
    }

    async function loadTechnicianDirectory() {
      const container = document.querySelector('#technicianDirectory');
      if (!container) return;
      try {
        const result = await apiFetch('/technicians');
        const technicians = result.technicians || [];
        if (!technicians.length) {
          container.innerHTML = `<div class="alert alert-secondary">${escapeHtml(getText('directory.empty') || 'Aucun technicien pour le moment.')}</div>`;
          return;
        }
        container.innerHTML = technicians.map(tech => `
          <div class="col-md-6">
            <div class="card h-100" style="border:none;border-radius:26px;box-shadow:0 10px 28px rgba(8,61,60,.08);">
              <div class="card-body">
                <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
                  <div>
                    <h5 style="font-weight:900;">${escapeHtml(tech.fullName)}</h5>
                    <p class="mb-1">${escapeHtml(tech.specialty || '')}</p>
                    <p class="mb-2">${escapeHtml(tech.city || '')}</p>
                  </div>
                  <span class="badge text-bg-light">⭐ ${Number(tech.averageRating || 0).toFixed(1)} (${tech.reviewCount || 0})</span>
                </div>
                <a href="profile.html" class="btn btn-main choose-tech-btn" data-tech-id="${escapeHtml(tech.id)}">${escapeHtml(getText('directory.viewProfile') || 'Voir le profil')}</a>
              </div>
            </div>
          </div>
        `).join('');
        container.querySelectorAll('.choose-tech-btn').forEach(btn => btn.addEventListener('click', () => localStorage.setItem(STORAGE_KEYS.activeTechId, btn.dataset.techId)));
      } catch (error) {
        container.innerHTML = `<div class="alert alert-danger">${escapeHtml(mapServerError(error.message))}</div>`;
      }
    }

    function renderImagePreview(images) {
      if (!preview) return;
      preview.innerHTML = (images || []).map(src => `<img src="${src}" alt="preview" style="width:88px;height:88px;object-fit:cover;border-radius:14px;border:1px solid #e4eceb;">`).join('');
    }
  }

  async function readFilesAsDataUrls(fileList) {
    const files = Array.from(fileList || []).slice(0, 4);
    return Promise.all(files.map(file => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    })));
  }

  function statBadge(text) {
    return `<span class="badge text-bg-light" style="border-radius:999px;padding:10px 14px;">${escapeHtml(text)}</span>`;
  }

  function statusLabel(status) {
    return ({ open: getText('dashboard.open') || 'Ouverte', assigned: getText('dashboard.assigned') || 'Assignée', completed: getText('dashboard.completed') || 'Terminée' })[status] || status;
  }

  function renderSmallImages(images) {
    if (!images || !images.length) return '';
    return `<div class="d-flex gap-2 flex-wrap">${images.map(src => `<img src="${src}" alt="image" style="width:62px;height:62px;object-fit:cover;border-radius:12px;border:1px solid #e4eceb;">`).join('')}</div>`;
  }

  function initTechPage() {
    if (pageName !== 'tech.html') return;
    const viewProfileBtn = document.querySelector('#viewProfileBtn');
    if (viewProfileBtn) {
      viewProfileBtn.addEventListener('click', () => {
        const session = getSession();
        const techId = session?.role === 'technician' ? session.id : (localStorage.getItem(STORAGE_KEYS.activeTechId) || DEFAULT_TECH_ID);
        localStorage.setItem(STORAGE_KEYS.activeTechId, techId);
      });
    }
    loadTechDashboard();
  }

  async function loadTechDashboard() {
    try {
      const techId = getSession()?.role === 'technician' ? getSession().id : (localStorage.getItem(STORAGE_KEYS.activeTechId) || DEFAULT_TECH_ID);
      const techData = await apiFetch(`/technicians/${techId}`);
      setValue('#techProfileName', techData.technician.fullName || '');
      setValue('#techProfileSpecialty', techData.technician.specialty || '');
      setValue('#techProfileCity', techData.technician.city || '');
      const requestsData = await apiFetch('/requests');
      renderRequests(requestsData.requests || []);
    } catch (error) {
      renderJobsMessage(mapServerError(error.message));
    }
  }

  function renderJobsMessage(message) {
    const container = document.querySelector('#jobsList');
    if (container) container.innerHTML = `<div class="alert alert-danger">${escapeHtml(message)}</div>`;
  }

  function renderRequests(requests) {
    const container = document.querySelector('#jobsList');
    if (!container) return;
    const session = getSession();
    const activeTechId = session?.role === 'technician' ? session.id : (localStorage.getItem(STORAGE_KEYS.activeTechId) || DEFAULT_TECH_ID);
    if (!requests.length) {
      container.innerHTML = `<div class="alert alert-secondary">${escapeHtml(getText('tech.noJobs'))}</div>`;
      return;
    }

    container.innerHTML = requests.map((request, index) => {
      let actionHtml = '';
      if (request.status === 'open') {
        actionHtml = `<button class="btn btn-main accept-job-btn" data-id="${escapeHtml(request.id)}" type="button">${escapeHtml(getText('tech.acceptMission'))}</button>`;
      } else if (request.status === 'assigned' && request.assignedTechnicianId === activeTechId) {
        actionHtml = `<button class="btn btn-main complete-job-btn" data-id="${escapeHtml(request.id)}" type="button">${escapeHtml(getText('tech.completeMission') || 'Marquer comme terminée')}</button>`;
      } else if (request.status === 'assigned') {
        actionHtml = `<span class="badge text-bg-warning">${escapeHtml(getText('tech.alreadyAssigned') || 'Déjà assignée')}</span>`;
      } else if (request.status === 'completed') {
        actionHtml = `<span class="badge text-bg-success">${escapeHtml(getText('tech.completedMission') || 'Mission terminée')}</span>`;
      }
      return `
        <div class="card job-card ${index < requests.length - 1 ? 'mb-3' : ''}">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start gap-2 flex-wrap">
              <div>
                <h5>${escapeHtml(request.title)}</h5>
                <p>${escapeHtml(request.description)}</p>
                <p class="mb-3"><strong>${escapeHtml(request.city)}</strong> • ${escapeHtml(request.service)} • ${escapeHtml(request.urgency)}</p>
              </div>
              <span class="badge text-bg-${request.status === 'completed' ? 'success' : request.status === 'assigned' ? 'warning' : 'secondary'}">${escapeHtml(statusLabel(request.status))}</span>
            </div>
            ${renderSmallImages(request.images || [])}
            <div class="mt-3 d-flex gap-2 flex-wrap">${actionHtml}</div>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.accept-job-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await apiFetch(`/requests/${btn.dataset.id}/accept`, { method: 'POST' });
          await loadTechDashboard();
        } catch (error) {
          renderJobsMessage(mapServerError(error.message));
        }
      });
    });

    container.querySelectorAll('.complete-job-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await apiFetch(`/requests/${btn.dataset.id}/complete`, { method: 'POST' });
          await loadTechDashboard();
        } catch (error) {
          renderJobsMessage(mapServerError(error.message));
        }
      });
    });
  }

  function initProfilePage() {
    if (pageName !== 'profile.html') return;
    loadProfile();
  }

  async function loadProfile() {
    try {
      const queryTechId = new URLSearchParams(location.search).get('id');
      const techId = getSession()?.role === 'technician' ? getSession().id : (queryTechId || localStorage.getItem(STORAGE_KEYS.activeTechId) || DEFAULT_TECH_ID);
      localStorage.setItem(STORAGE_KEYS.activeTechId, techId);
      const [techData, reviewsData] = await Promise.all([
        apiFetch(`/technicians/${techId}`),
        apiFetch(`/technicians/${techId}/reviews`)
      ]);
      const tech = techData.technician;
      setText('#profileName', escapeHtml(tech.fullName));
      const profilePhoto = document.querySelector('#profilePhoto');
      if (profilePhoto && tech.profileImage) profilePhoto.src = tech.profileImage;
      setText('#profileSpecialty', escapeHtml(tech.specialty || 'Technician'));
      setText('#profileCity', escapeHtml(tech.city || 'Tunisie'));
      setText('#profileExperience', `${escapeHtml(getText('profile.experienceLabel'))} : ${escapeHtml(tech.experience || '-')}`);
      setText('#profileRating', `${escapeHtml(getText('profile.ratingLabel'))} : ⭐ ${tech.averageRating || 0} / 5`);
      setText('#profileStars', starString(Math.round(tech.averageRating || 0)));
      const contactBtn = document.querySelector('#contactTechBtn');
      if (contactBtn) {
        contactBtn.onclick = () => {
          const subject = encodeURIComponent(`Contact TUNIFIX - ${tech.fullName || ''}`);
          const body = encodeURIComponent(`Bonjour ${tech.fullName || ''},%0D%0A%0D%0AJe vous contacte depuis TUNIFIX à propos d'une intervention.%0D%0A`);
          if (tech.email) {
            location.href = `mailto:${tech.email}?subject=${subject}&body=${body}`;
          } else if (tech.phone) {
            location.href = `tel:${tech.phone}`;
          } else {
            alert(getText('profile.noContact') || 'Aucun contact disponible pour ce technicien.');
          }
        };
      }
      window.__fixlyProfileReviews = reviewsData.reviews || [];
      renderReviews(window.__fixlyProfileReviews);
      initReviewForm(techId);
    } catch (error) {
      const list = document.querySelector('#reviewsList');
      if (list) list.innerHTML = `<div class="alert alert-danger">${escapeHtml(mapServerError(error.message))}</div>`;
    }
  }

  function renderReviews(reviews) {
    const list = document.querySelector('#reviewsList');
    if (!list) return;
    if (!reviews.length) {
      list.innerHTML = `<div class="alert alert-secondary">${escapeHtml(getText('profile.noReviews'))}</div>`;
      return;
    }
    list.innerHTML = reviews.map(review => `
      <div class="card review-card mb-3">
        <div class="card-body">
          <h5 style="font-weight:800;">${escapeHtml(review.name)}</h5>
          <p class="mb-2">${starString(review.rating)}</p>
          <p style="margin-bottom:0;color:#5f7a79;">${escapeHtml(review.comment)}</p>
        </div>
      </div>
    `).join('');
  }

  function initReviewForm(techId) {
    const form = document.querySelector('#reviewForm');
    if (!form || form.dataset.bound === 'true') return;
    form.dataset.bound = 'true';
    const starButtons = form.querySelectorAll('[data-rating]');
    const hidden = form.querySelector('[name="rating"]');
    starButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        hidden.value = btn.dataset.rating;
        starButtons.forEach(b => b.classList.toggle('active', Number(b.dataset.rating) <= Number(hidden.value)));
      });
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const feedback = form.querySelector('.form-feedback');
      const payload = {
        name: form.querySelector('[name="reviewerName"]').value.trim(),
        rating: Number(form.querySelector('[name="rating"]').value || 0),
        comment: form.querySelector('[name="comment"]').value.trim()
      };

      if (payload.name.length < 2) return showMessage(feedback, getText('profile.reviewNameError'), 'error');
      if (payload.rating < 1 || payload.rating > 5) return showMessage(feedback, getText('profile.reviewRatingError'), 'error');
      if (payload.comment.length < 6) return showMessage(feedback, getText('profile.reviewCommentError'), 'error');

      try {
        await apiFetch(`/technicians/${techId}/reviews`, { method: 'POST', body: JSON.stringify(payload) });
        form.reset();
        hidden.value = '0';
        starButtons.forEach(b => b.classList.remove('active'));
        showMessage(feedback, getText('profile.reviewSuccess'), 'success');
        loadProfile();
      } catch (error) {
        showMessage(feedback, mapServerError(error.message), 'error');
      }
    });
  }

  function initIndexPage() {
    if (pageName !== 'index.html') return;
    document.querySelectorAll('a[href="profile.html"]').forEach(link => {
      link.addEventListener('click', () => {
        localStorage.setItem(STORAGE_KEYS.activeTechId, DEFAULT_TECH_ID);
      });
    });
  }

  function starString(count) {
    const safe = Math.max(0, Math.min(5, Number(count) || 0));
    return '★'.repeat(safe) + '☆'.repeat(5 - safe);
  }

  function mapServerError(message) {
    const key = String(message || '').toLowerCase();
    if (key.includes('email already exists')) return getText('common.emailExists');
    if (key.includes('invalid email')) return getText('common.emailError');
    if (key.includes('phone must contain digits only')) return getText('common.phoneError');
    if (key.includes('password is not strong enough')) return getText('common.strongPasswordError');
    if (key.includes('incorrect email or password')) return getText('common.badLogin');
    if (key.includes('session expired')) return getText('common.sessionExpired') || 'Session expirée. Connectez-vous de nouveau.';
    if (key.includes('common.clientloginrequired') || key.includes('client login required')) return getText('common.clientLoginRequired') || 'Connexion client requise.';
    if (key.includes('common.techloginrequired') || key.includes('tech login required')) return getText('common.techLoginRequired') || 'Connexion technicien requise.';
    if (key == 'unauthorized' || key.includes('unauthorized')) return getText('common.loginRequired') || 'Connexion requise.';
    if (key.includes('only open requests can be edited')) return getText('dashboard.onlyOpenEditable') || 'Seules les demandes ouvertes peuvent être modifiées.';
    if (key.includes('only open requests can be deleted')) return getText('dashboard.onlyOpenDeletable') || 'Seules les demandes ouvertes peuvent être supprimées.';
    if (key.includes('you can only edit your own requests')) return getText('dashboard.ownRequestOnly') || 'Vous pouvez seulement modifier vos propres demandes.';
    if (key.includes('you can only delete your own requests')) return getText('dashboard.ownRequestOnly') || 'Vous pouvez seulement modifier vos propres demandes.';
    if (key.includes('failed to fetch')) return getText('common.backendOffline');
    return message || getText('common.genericError');
  }


  /* ===== Enhanced static-mode backend, notifications, forgot password, rating flow, and top-rated page ===== */

  function apiFetch(path, options = {}) {
    return enhancedApiFetch(path, options);
  }

  async function enhancedApiFetch(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    try {
      const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
      let data = {};
      try { data = await response.json(); } catch (_) {}
      if (!response.ok) {
        if (response.status === 404 || response.status === 405) {
          return await mockApiFetch(path, options);
        }
        if (response.status === 401) {
          clearAuth();
          renderSessionUi();
        }
        throw new Error(data.error || 'Request failed');
      }
      return data;
    } catch (error) {
      return await mockApiFetch(path, options);
    }
  }

  function renderSessionUi() {
    const host = document.querySelector('.navbar .ms-auto');
    if (!host) return;
    let wrap = document.querySelector('#fixlySessionActions');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'fixlySessionActions';
      wrap.className = 'd-flex align-items-center gap-2 flex-wrap';
      host.insertBefore(wrap, host.firstChild);
    }
    const session = getSession();
    const notificationsBtn = `<a href="notifications.html" class="btn btn-sm btn-outline-dark" style="border-radius:999px;">${escapeHtml(getText('common.notifications') || 'Emails')}</a>`;
    const topRatedBtn = `<a href="top-rated-technicians.html" class="btn btn-sm btn-outline-dark" style="border-radius:999px;">${escapeHtml(getText('common.topRated') || 'Top rated')}</a>`;
    if (!session) {
      wrap.innerHTML = `${topRatedBtn}`;
      return;
    }
    const expires = session.expiresAt ? new Date(session.expiresAt).toLocaleString() : '';
    wrap.innerHTML = `
      <span class="badge text-bg-light" style="border-radius:999px;padding:10px 14px;">${escapeHtml(session.fullName || session.email || '')}</span>
      ${notificationsBtn}
      ${topRatedBtn}
      <button type="button" id="fixlyLogoutBtn" class="btn btn-sm btn-outline-dark" style="border-radius:999px;">${escapeHtml(getText('common.logout') || 'Logout')}</button>
    `;
    const btn = wrap.querySelector('#fixlyLogoutBtn');
    if (btn) {
      btn.title = expires ? `${getText('common.sessionUntil') || 'Session until'} ${expires}` : '';
      btn.onclick = async () => {
        try { await apiFetch('/logout', { method: 'POST' }); } catch (_) {}
        clearAuth();
        renderSessionUi();
        if (['post.html','tech.html','profile.html','notifications.html'].includes(pageName)) location.href = 'index.html';
      };
    }
  }

  function initLoginPages() {
    initClientLogin();
    initTechLogin();
    injectForgotPasswordUi('#clientLoginForm', 'client');
    injectForgotPasswordUi('#technicianLoginForm', 'technician');
  }

  function injectForgotPasswordUi(formSelector, role) {
    const form = document.querySelector(formSelector);
    if (!form || form.dataset.forgotBound === 'true') return;
    form.dataset.forgotBound = 'true';
    const submitBlock = form.querySelector('button[type="submit"]')?.closest('.d-grid') || form;
    const box = document.createElement('div');
    box.className = 'mt-3';
    box.innerHTML = `
      <button type="button" class="btn btn-link p-0 forgot-password-toggle">${escapeHtml(getText('common.forgotPassword') || 'Mot de passe oublié ?')}</button>
      <div class="forgot-password-panel mt-3" style="display:none;">
        <div class="p-3" style="border:1px solid #e5ecec;border-radius:18px;background:#fbfdfd;">
          <label class="form-label">${escapeHtml(getText('common.resetByEmail') || 'Reset by email')}</label>
          <div class="d-flex gap-2 flex-wrap">
            <input type="email" class="form-control forgot-password-email" style="max-width:340px;" placeholder="${escapeHtml(getText('common.emailAddress') || 'Email')}" />
            <button type="button" class="btn btn-main forgot-password-send">${escapeHtml(getText('common.sendResetLink') || 'Envoyer le lien')}</button>
          </div>
          <div class="form-feedback mt-3"></div>
        </div>
      </div>`;
    submitBlock.insertAdjacentElement('afterend', box);
    const toggle = box.querySelector('.forgot-password-toggle');
    const panel = box.querySelector('.forgot-password-panel');
    const emailInput = box.querySelector('.forgot-password-email');
    const sendBtn = box.querySelector('.forgot-password-send');
    const feedback = box.querySelector('.form-feedback');
    toggle.addEventListener('click', () => {
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
      const existingEmail = form.querySelector('input[name="email"]')?.value?.trim();
      if (existingEmail && !emailInput.value) emailInput.value = existingEmail;
    });
    sendBtn.addEventListener('click', async () => {
      const email = String(emailInput.value || '').trim().toLowerCase();
      if (!isValidEmail(email)) return showMessage(feedback, getText('common.emailError'), 'error');
      try {
        await apiFetch('/password/forgot', { method: 'POST', body: JSON.stringify({ email, role }) });
        showMessage(feedback, getText('common.resetSent') || 'Un email de réinitialisation a été généré.', 'success');
      } catch (error) {
        showMessage(feedback, mapServerError(error.message), 'error');
      }
    });
  }

  async function loadClientDashboard() {
    const list = document.querySelector('#clientRequestsList');
    const stats = document.querySelector('#clientStats');
    const session = getSession();
    if (!list || !stats) return;
    if (!session || session.role !== 'client') {
      stats.innerHTML = '';
      list.innerHTML = `<div class="alert alert-secondary">${escapeHtml(getText('dashboard.loginNeeded') || 'Connectez-vous comme client pour gérer vos demandes.')}</div>`;
      return;
    }
    try {
      const result = await apiFetch('/requests');
      const requests = result.requests || [];
      window.__fixlyClientRequests = requests;
      const open = requests.filter(r => r.status === 'open').length;
      const assigned = requests.filter(r => r.status === 'assigned').length;
      const completed = requests.filter(r => r.status === 'completed').length;
      stats.innerHTML = [
        statBadge(`${requests.length} ${getText('dashboard.totalRequests') || 'demandes'}`),
        statBadge(`${open} ${getText('dashboard.open') || 'ouvertes'}`),
        statBadge(`${assigned} ${getText('dashboard.assigned') || 'assignées'}`),
        statBadge(`${completed} ${getText('dashboard.completed') || 'terminées'}`)
      ].join('');
      if (!requests.length) {
        list.innerHTML = `<div class="alert alert-secondary">${escapeHtml(getText('dashboard.noRequests') || 'Aucune demande pour le moment.')}</div>`;
        return;
      }
      list.innerHTML = requests.map(request => {
        const canRate = request.status === 'completed' && request.assignedTechnicianId && !request.reviewByClientId;
        const ratingButton = canRate ? `<button type="button" class="btn btn-sm btn-main rate-tech-btn" data-id="${escapeHtml(request.id)}" data-tech-id="${escapeHtml(request.assignedTechnicianId)}">${escapeHtml(getText('dashboard.rateTechnician') || 'Noter le technicien')}</button>` : '';
        const techBadge = request.assignedTechnicianName ? `<span class="badge text-bg-light">${escapeHtml(request.assignedTechnicianName)}</span>` : '';
        return `
          <div class="card mb-3" style="border:none;border-radius:22px;box-shadow:0 8px 24px rgba(8,61,60,.08);">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-start gap-2 flex-wrap mb-2">
                <div>
                  <h5 style="font-weight:800;margin-bottom:6px;">${escapeHtml(request.title)}</h5>
                  <div class="text-muted">${escapeHtml(request.city)} • ${escapeHtml(request.service)} • ${escapeHtml(request.urgency)}</div>
                </div>
                <span class="badge text-bg-${request.status === 'completed' ? 'success' : request.status === 'assigned' ? 'warning' : 'secondary'}">${escapeHtml(statusLabel(request.status))}</span>
              </div>
              <p class="mb-2">${escapeHtml(request.description)}</p>
              ${renderSmallImages(request.images || [])}
              <div class="d-flex gap-2 flex-wrap mt-3">
                ${request.status === 'open' ? `<button type="button" class="btn btn-sm btn-outline-dark request-edit-btn" data-id="${escapeHtml(request.id)}">${escapeHtml(getText('dashboard.editBtn') || 'Modifier')}</button><button type="button" class="btn btn-sm btn-outline-danger request-delete-btn" data-id="${escapeHtml(request.id)}">${escapeHtml(getText('dashboard.deleteBtn') || 'Supprimer')}</button>` : ''}
                ${ratingButton}
                ${techBadge}
                <span class="badge text-bg-light">${request.reviewByClientId ? (getText('dashboard.reviewed') || 'Avis laissé') : (request.status === 'completed' ? (getText('dashboard.notReviewed') || 'Avis non laissé') : (getText('dashboard.awaitingReview') || 'En attente'))}</span>
              </div>
            </div>
          </div>`;
      }).join('');
      list.querySelectorAll('.request-edit-btn').forEach(btn => btn.addEventListener('click', () => startEdit(btn.dataset.id)));
      list.querySelectorAll('.request-delete-btn').forEach(btn => btn.addEventListener('click', () => deleteRequest(btn.dataset.id)));
      list.querySelectorAll('.rate-tech-btn').forEach(btn => btn.addEventListener('click', () => {
        savePendingReview({ requestId: btn.dataset.id, techId: btn.dataset.techId });
        localStorage.setItem(STORAGE_KEYS.activeTechId, btn.dataset.techId);
        location.href = 'profile.html';
      }));
    } catch (error) {
      list.innerHTML = `<div class="alert alert-danger">${escapeHtml(mapServerError(error.message))}</div>`;
    }
  }

  async function loadProfile() {
    try {
      const queryTechId = new URLSearchParams(location.search).get('id');
      const techId = getSession()?.role === 'technician' ? getSession().id : (queryTechId || localStorage.getItem(STORAGE_KEYS.activeTechId) || DEFAULT_TECH_ID);
      localStorage.setItem(STORAGE_KEYS.activeTechId, techId);
      const [techData, reviewsData] = await Promise.all([
        apiFetch(`/technicians/${techId}`),
        apiFetch(`/technicians/${techId}/reviews`)
      ]);
      const tech = techData.technician;
      setText('#profileName', escapeHtml(tech.fullName));
      const profilePhoto = document.querySelector('#profilePhoto');
      if (profilePhoto && tech.profileImage) profilePhoto.src = tech.profileImage;
      setText('#profileSpecialty', escapeHtml(tech.specialty || 'Technician'));
      setText('#profileCity', escapeHtml(tech.city || 'Tunisie'));
      setText('#profileExperience', `${escapeHtml(getText('profile.experienceLabel'))} : ${escapeHtml(tech.experience || '-')}`);
      setText('#profileRating', `${escapeHtml(getText('profile.ratingLabel'))} : ⭐ ${Number(tech.averageRating || 0).toFixed(1)} / 5`);
      setText('#profileStars', starString(Math.round(tech.averageRating || 0)));
      const contactBtn = document.querySelector('#contactTechBtn');
      if (contactBtn) {
        contactBtn.onclick = () => {
          const subject = encodeURIComponent(`Contact TUNIFIX - ${tech.fullName || ''}`);
          const body = encodeURIComponent(`Bonjour ${tech.fullName || ''},%0D%0A%0D%0AJe vous contacte depuis TUNIFIX à propos d'une intervention.%0D%0A`);
          if (tech.email) location.href = `mailto:${tech.email}?subject=${subject}&body=${body}`;
          else if (tech.phone) location.href = `tel:${tech.phone}`;
          else alert(getText('profile.noContact') || 'Aucun contact disponible pour ce technicien.');
        };
      }
      window.__fixlyProfileReviews = reviewsData.reviews || [];
      renderReviews(window.__fixlyProfileReviews);
      await renderReviewEligibility(techId, tech.fullName);
      initReviewForm(techId);
    } catch (error) {
      const list = document.querySelector('#reviewsList');
      if (list) list.innerHTML = `<div class="alert alert-danger">${escapeHtml(mapServerError(error.message))}</div>`;
    }
  }

  async function renderReviewEligibility(techId, techName) {
    const form = document.querySelector('#reviewForm');
    if (!form) return;
    let info = document.querySelector('#reviewEligibilityInfo');
    if (!info) {
      info = document.createElement('div');
      info.id = 'reviewEligibilityInfo';
      info.className = 'mb-3';
      form.insertAdjacentElement('afterbegin', info);
    }
    let pickerWrap = document.querySelector('#reviewRequestPickerWrap');
    if (!pickerWrap) {
      pickerWrap = document.createElement('div');
      pickerWrap.id = 'reviewRequestPickerWrap';
      pickerWrap.className = 'mb-3';
      info.insertAdjacentElement('afterend', pickerWrap);
    }
    const session = getSession();
    let ctx = getPendingReview();
    form.querySelectorAll('input,textarea,button').forEach(el => el.disabled = false);
    form.querySelectorAll('[data-rating]').forEach(el => el.disabled = false);
    pickerWrap.innerHTML = '';
    if (session?.role === 'technician') {
      info.innerHTML = `<div class="alert alert-secondary mb-0">${escapeHtml(getText('profile.techCannotReview') || 'Le technicien ne peut pas noter son propre profil.')}</div>`;
      form.querySelectorAll('input,textarea,button').forEach(el => { if (el.id !== 'contactTechBtn') el.disabled = true; });
      return;
    }
    if (!session || session.role !== 'client') {
      info.innerHTML = `<div class="alert alert-secondary mb-0">${escapeHtml(getText('profile.clientLoginToReview') || 'Connectez-vous comme client puis ouvrez une mission terminée pour laisser une note.')}</div>`;
      return;
    }

    let eligible = [];
    try {
      const result = await apiFetch('/requests');
      const requests = result.requests || [];
      window.__fixlyClientRequests = requests;
      eligible = requests.filter(request => request.status === 'completed' && request.assignedTechnicianId === techId && !request.reviewByClientId);
    } catch (_) {}

    if ((!ctx || ctx.techId !== techId || !ctx.requestId) && eligible.length) {
      ctx = { techId, requestId: eligible[0].id };
      savePendingReview(ctx);
    }

    if (eligible.length > 1) {
      const options = eligible.map(request => `<option value="${escapeHtml(request.id)}" ${ctx?.requestId === request.id ? 'selected' : ''}>${escapeHtml(request.title)} — ${escapeHtml(request.city || '')}</option>`).join('');
      pickerWrap.innerHTML = `
        <label class="form-label" style="font-weight:700;">${escapeHtml(getText('profile.selectCompletedJob') || 'Choisissez la mission terminée à noter')}</label>
        <select id="reviewRequestPicker" class="form-select" style="border-radius:18px;padding:13px 15px;">
          ${options}
        </select>`;
      const picker = pickerWrap.querySelector('#reviewRequestPicker');
      if (picker) picker.addEventListener('change', () => savePendingReview({ techId, requestId: picker.value }));
    } else if (eligible.length === 1) {
      const request = eligible[0];
      pickerWrap.innerHTML = `<div class="alert alert-light border mb-0">${escapeHtml(getText('profile.selectedCompletedJob') || 'Mission prête pour l’avis')} : <strong>${escapeHtml(request.title)}</strong></div>`;
    }

    if ((!ctx || ctx.techId !== techId) && !eligible.length) {
      info.innerHTML = `<div class="alert alert-secondary mb-0">${escapeHtml(getText('profile.reviewRequiresCompletedJob') || 'Pour noter ce technicien, ouvrez une mission terminée depuis votre tableau de bord puis cliquez sur Noter le technicien.')}</div>`;
      form.querySelectorAll('textarea,button,[data-rating]').forEach(el => el.disabled = true);
      const reviewerOnly = form.querySelector('[name="reviewerName"]');
      if (reviewerOnly) reviewerOnly.disabled = true;
      return;
    }

    const activeRequest = eligible.find(request => request.id === (getPendingReview() || {}).requestId) || eligible[0] || null;
    if (activeRequest && (!getPendingReview() || (getPendingReview() || {}).requestId !== activeRequest.id || (getPendingReview() || {}).techId !== techId)) {
      savePendingReview({ techId, requestId: activeRequest.id });
    }
    const reviewer = form.querySelector('[name="reviewerName"]');
    if (reviewer) reviewer.value = session.fullName || '';
    info.innerHTML = `<div class="alert alert-success mb-0">${escapeHtml(getText('profile.readyToReview') || 'Mission terminée détectée. Vous pouvez maintenant noter ce technicien.')} ${escapeHtml(techName || '')}</div>`;
  }

  function initReviewForm(techId) {
    const form = document.querySelector('#reviewForm');
    if (!form || form.dataset.bound === 'true') return;
    form.dataset.bound = 'true';
    const starButtons = form.querySelectorAll('[data-rating]');
    const hidden = form.querySelector('[name="rating"]');
    starButtons.forEach(btn => btn.addEventListener('click', () => {
      hidden.value = btn.dataset.rating;
      starButtons.forEach(b => b.classList.toggle('active', Number(b.dataset.rating) <= Number(hidden.value)));
    }));

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const feedback = form.querySelector('.form-feedback');
      const ctx = getPendingReview();
      const session = getSession();
      if (!session || session.role !== 'client') return showMessage(feedback, getText('profile.clientLoginToReview') || 'Connectez-vous comme client.', 'error');
      if (!ctx || ctx.techId !== techId) return showMessage(feedback, getText('profile.reviewRequiresCompletedJob') || 'Sélectionnez une mission terminée à noter depuis le tableau de bord.', 'error');
      const payload = {
        name: form.querySelector('[name="reviewerName"]').value.trim(),
        rating: Number(form.querySelector('[name="rating"]').value || 0),
        comment: form.querySelector('[name="comment"]').value.trim(),
        requestId: ctx.requestId
      };
      if (payload.name.length < 2) return showMessage(feedback, getText('profile.reviewNameError'), 'error');
      if (payload.rating < 1 || payload.rating > 5) return showMessage(feedback, getText('profile.reviewRatingError'), 'error');
      if (payload.comment.length < 6) return showMessage(feedback, getText('profile.reviewCommentError'), 'error');
      try {
        const result = await apiFetch(`/technicians/${techId}/reviews`, { method: 'POST', body: JSON.stringify(payload) });
        form.reset();
        hidden.value = '0';
        starButtons.forEach(b => b.classList.remove('active'));
        clearPendingReview();
        showMessage(feedback, getText('profile.reviewSuccess'), 'success');
        if (result?.review) {
          const currentReviews = Array.isArray(window.__fixlyProfileReviews) ? window.__fixlyProfileReviews : [];
          window.__fixlyProfileReviews = [result.review, ...currentReviews];
          renderReviews(window.__fixlyProfileReviews);
        }
        if (result?.technician) {
          const tech = result.technician;
          setText('#profileRating', `${escapeHtml(getText('profile.ratingLabel'))} : ⭐ ${Number(tech.averageRating || 0).toFixed(1)} / 5`);
          setText('#profileStars', starString(Math.round(tech.averageRating || 0)));
        }
        setTimeout(() => loadProfile(), 250);
      } catch (error) {
        showMessage(feedback, mapServerError(error.message), 'error');
      }
    });
  }

  function initIndexPage() {
    if (pageName !== 'index.html') return;
    document.querySelectorAll('a[href="profile.html"]').forEach(link => {
      link.addEventListener('click', () => localStorage.setItem(STORAGE_KEYS.activeTechId, DEFAULT_TECH_ID));
    });
    injectTopRatedLinks();
  }

  function initTopRatedPage() {
    if (pageName !== 'top-rated-technicians.html') return;
    const container = document.querySelector('#topRatedTechnicians');
    if (!container) return;
    apiFetch('/technicians/top').then(result => {
      const technicians = result.technicians || [];
      if (!technicians.length) {
        container.innerHTML = `<div class="alert alert-secondary">Aucun technicien pour le moment.</div>`;
        return;
      }
      container.innerHTML = technicians.map((tech, index) => `
        <div class="col-lg-4 col-md-6">
          <div class="card h-100" style="border:none;border-radius:28px;box-shadow:0 12px 32px rgba(8,61,60,.08);">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-start gap-2 mb-3">
                <span class="badge text-bg-dark">#${index + 1}</span>
                <span class="badge text-bg-light">⭐ ${Number(tech.averageRating || 0).toFixed(1)} • ${tech.reviewCount || 0}</span>
              </div>
              <h4 style="font-weight:900;color:#083d3c;">${escapeHtml(tech.fullName)}</h4>
              <p class="mb-1">${escapeHtml(tech.specialty || '')}</p>
              <p class="mb-3 text-muted">${escapeHtml(tech.city || '')}</p>
              <p class="mb-3">${escapeHtml(tech.experience || '')}</p>
              <a href="profile.html" class="btn btn-main choose-tech-btn" data-tech-id="${escapeHtml(tech.id)}">${escapeHtml(getText('directory.viewProfile') || 'Voir le profil')}</a>
            </div>
          </div>
        </div>`).join('');
      container.querySelectorAll('.choose-tech-btn').forEach(btn => btn.addEventListener('click', () => localStorage.setItem(STORAGE_KEYS.activeTechId, btn.dataset.techId)));
    }).catch(error => {
      container.innerHTML = `<div class="alert alert-danger">${escapeHtml(mapServerError(error.message))}</div>`;
    });
  }

  function initNotificationsPage() {
    if (pageName !== 'notifications.html') return;
    const list = document.querySelector('#notificationsList');
    if (!list) return;
    apiFetch('/notifications').then(result => {
      const notifications = result.notifications || [];
      if (!notifications.length) {
        list.innerHTML = `<div class="alert alert-secondary">${escapeHtml(getText('notifications.empty') || 'Aucune notification pour le moment.')}</div>`;
        return;
      }
      list.innerHTML = notifications.map(item => `
        <div class="card mb-3" style="border:none;border-radius:24px;box-shadow:0 10px 28px rgba(8,61,60,.08);">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start gap-2 flex-wrap mb-2">
              <div>
                <div class="badge text-bg-light mb-2">${escapeHtml(item.email || '')}</div>
                <h5 style="font-weight:800;">${escapeHtml(item.subject || '')}</h5>
              </div>
              <small class="text-muted">${escapeHtml(new Date(item.createdAt).toLocaleString())}</small>
            </div>
            <p class="mb-0" style="white-space:pre-wrap;">${escapeHtml(item.message || '')}</p>
          </div>
        </div>`).join('');
    }).catch(error => {
      list.innerHTML = `<div class="alert alert-danger">${escapeHtml(mapServerError(error.message))}</div>`;
    });
  }

  function injectTopRatedLinks() {
    document.querySelectorAll('[data-top-rated-link]').forEach(el => el.remove());
    const target = document.querySelector('.hero-actions') || document.querySelector('#requestFormSection .card-body') || document.querySelector('.mini-badges');
    if (!target) return;
    const anchor = document.createElement(target.classList.contains('hero-actions') ? 'a' : 'div');
    anchor.setAttribute('data-top-rated-link', 'true');
    if (anchor.tagName === 'A') {
      anchor.href = 'top-rated-technicians.html';
      anchor.className = 'btn-outline-custom';
      anchor.textContent = getText('common.topRated') || 'Top rated technicians';
    } else {
      anchor.innerHTML = `<a href="top-rated-technicians.html" class="btn btn-main mt-3">${escapeHtml(getText('common.topRated') || 'Top rated technicians')}</a>`;
    }
    target.appendChild(anchor);
  }

  function savePendingReview(data) {
    localStorage.setItem('fixlyPendingReview', JSON.stringify(data || null));
  }
  function getPendingReview() {
    return JSON.parse(localStorage.getItem('fixlyPendingReview') || 'null');
  }
  function clearPendingReview() {
    localStorage.removeItem('fixlyPendingReview');
  }

  function initMockDb() {
    const key = 'fixlyMockDbV2';
    let db = JSON.parse(localStorage.getItem(key) || 'null');
    if (db && db.version === 2) return db;
    const now = new Date().toISOString();
    db = {
      version: 2,
      clients: [
        { id: 'client-demo', role: 'client', fullName: 'Client Demo', email: 'client@tunifix.tn', phone: '20111222', city: 'Monastir', password: 'Client@123' }
      ],
      technicians: [
        { id: DEFAULT_TECH_ID, role: 'technician', fullName: 'Ali Ben Salah', email: 'ali@tunifix.tn', phone: '22111222', city: 'Monastir', specialty: 'Électricité', experience: '5 ans d’expérience', password: 'Tech@123' },
        { id: 'tech-sami-jlassi', role: 'technician', fullName: 'Sami Jlassi', email: 'sami@tunifix.tn', phone: '25111222', city: 'Sousse', specialty: 'Plomberie', experience: '7 ans d’expérience', password: 'Tech@123' },
        { id: 'tech-mariem-trabelsi', role: 'technician', fullName: 'Mariem Trabelsi', email: 'mariem@tunifix.tn', phone: '27111222', city: 'Tunis', specialty: 'Climatisation', experience: '6 ans d’expérience', password: 'Tech@123' }
      ],
      reviews: [
        { id: uid('review'), technicianId: DEFAULT_TECH_ID, clientId: 'seed-a', requestId: 'request-seed-reviewed', name: 'Nadia', rating: 5, comment: 'Service rapide et professionnel.', createdAt: now },
        { id: uid('review'), technicianId: 'tech-sami-jlassi', clientId: 'seed-b', requestId: 'request-seed-2', name: 'Maher', rating: 4, comment: 'Très bon travail, ponctuel.', createdAt: now },
        { id: uid('review'), technicianId: 'tech-mariem-trabelsi', clientId: 'seed-c', requestId: 'request-seed-3', name: 'Sarra', rating: 5, comment: 'Excellente technicienne.', createdAt: now }
      ],
      requests: [
        { id: 'request-seed-reviewed', clientId: 'client-demo', fullName: 'Client Demo', email: 'client@tunifix.tn', phone: '20111222', city: 'Monastir', service: 'Électricité', urgency: 'Normale', title: 'Prise murale en panne', description: 'La prise ne fonctionne plus dans le salon.', images: [], status: 'completed', assignedTechnicianId: DEFAULT_TECH_ID, assignedTechnicianName: 'Ali Ben Salah', reviewByClientId: 'client-demo', createdAt: now },
        { id: 'request-seed-pending-review', clientId: 'client-demo', fullName: 'Client Demo', email: 'client@tunifix.tn', phone: '20111222', city: 'Monastir', service: 'Plomberie', urgency: 'Urgente', title: 'Fuite sous évier', description: 'J’ai une fuite sous l’évier de la cuisine.', images: [], status: 'completed', assignedTechnicianId: 'tech-sami-jlassi', assignedTechnicianName: 'Sami Jlassi', reviewByClientId: null, createdAt: now },
        { id: 'request-seed-open', clientId: 'client-demo', fullName: 'Client Demo', email: 'client@tunifix.tn', phone: '20111222', city: 'Monastir', service: 'Climatisation', urgency: 'Normale', title: 'Climatiseur à vérifier', description: 'Besoin d’un diagnostic pour la clim.', images: [], status: 'open', assignedTechnicianId: null, assignedTechnicianName: null, reviewByClientId: null, createdAt: now }
      ],
      notifications: [],
      sessions: {},
      passwordResets: {}
    };
    recalculateTechnicians(db);
    pushNotification(db, { userId: 'client-demo', email: 'client@tunifix.tn', subject: 'Bienvenue sur TUNIFIX', message: 'Votre espace démo est prêt. Vous pouvez publier des demandes et noter un technicien après mission.' });
    saveMockDb(db);
    return db;
  }
  function getMockDb() { return initMockDb(); }
  function saveMockDb(db) { localStorage.setItem('fixlyMockDbV2', JSON.stringify(db)); return db; }
  function uid(prefix) { return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`; }
  function parseBody(body) { if (!body) return {}; if (typeof body === 'string') { try { return JSON.parse(body); } catch (_) { return {}; } } return body; }
  function getMockCurrentUser(db) { const token = getToken(); if (!token || !db.sessions[token]) return null; const userId = db.sessions[token]; return [...db.clients, ...db.technicians].find(item => item.id === userId) || null; }
  function createSessionPayload(user) { return { id: user.id, role: user.role, fullName: user.fullName, email: user.email, phone: user.phone, city: user.city, specialty: user.specialty, experience: user.experience, expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString() }; }
  function loginMockUser(db, user) { const token = uid('mock-token'); db.sessions[token] = user.id; saveMockDb(db); return { token, user: createSessionPayload(user), session: createSessionPayload(user) }; }
  function publicTechnician(tech, db) { const reviews = db.reviews.filter(item => item.technicianId === tech.id); const averageRating = reviews.length ? reviews.reduce((sum, item) => sum + Number(item.rating || 0), 0) / reviews.length : 0; return { ...tech, averageRating, reviewCount: reviews.length }; }
  function recalculateTechnicians(db) { db.technicians = db.technicians.map(tech => publicTechnician(tech, db)); return db; }
  function pushNotification(db, { userId, email, subject, message }) { const item = { id: uid('notif'), userId: userId || null, email: email || '', subject: subject || '', message: message || '', createdAt: new Date().toISOString() }; db.notifications.unshift(item); return item; }

  async function mockApiFetch(path, options = {}) {
    const db = getMockDb();
    const method = String(options.method || 'GET').toUpperCase();
    const body = parseBody(options.body);
    const user = getMockCurrentUser(db);
    const everyone = [...db.clients, ...db.technicians];

    if (path === '/me' && method === 'GET') { if (!user) throw new Error('Session expired'); return { session: createSessionPayload(user) }; }
    if (path === '/logout' && method === 'POST') { const token = getToken(); if (token && db.sessions[token]) delete db.sessions[token]; saveMockDb(db); return { ok: true }; }
    if (path === '/register/client' && method === 'POST') {
      const email = String(body.email || '').trim().toLowerCase();
      if (everyone.some(item => item.email.toLowerCase() === email)) throw new Error('Email already exists');
      const user = { id: uid('client'), role: 'client', fullName: String(body.fullName || '').trim(), email, phone: String(body.phone || '').trim(), city: String(body.city || '').trim(), password: String(body.password || '') };
      db.clients.push(user); pushNotification(db, { userId: user.id, email: user.email, subject: 'Bienvenue sur TUNIFIX', message: `Bonjour ${user.fullName}, votre compte client a été créé avec succès.` }); saveMockDb(db); return loginMockUser(db, user);
    }
    if (path === '/register/technician' && method === 'POST') {
      const email = String(body.email || '').trim().toLowerCase();
      if (everyone.some(item => item.email.toLowerCase() === email)) throw new Error('Email already exists');
      const user = { id: uid('tech'), role: 'technician', fullName: String(body.fullName || '').trim(), email, phone: String(body.phone || '').trim(), city: String(body.city || '').trim(), specialty: String(body.specialty || '').trim(), experience: String(body.experience || '').trim(), password: String(body.password || '') };
      db.technicians.push(publicTechnician(user, db)); pushNotification(db, { userId: user.id, email: user.email, subject: 'Bienvenue sur TUNIFIX', message: `Bonjour ${user.fullName}, votre compte technicien a été créé avec succès.` }); saveMockDb(db); return loginMockUser(db, user);
    }
    if ((path === '/login/client' || path === '/login/technician') && method === 'POST') {
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      const pool = path.includes('/client') ? db.clients : db.technicians;
      const found = pool.find(item => item.email.toLowerCase() === email && String(item.password || '') === password);
      if (!found) throw new Error('Incorrect email or password');
      pushNotification(db, { userId: found.id, email: found.email, subject: 'Nouvelle connexion', message: `Une connexion a été détectée sur votre compte ${found.fullName}.` }); saveMockDb(db); return loginMockUser(db, found);
    }
    if (path === '/password/forgot' && method === 'POST') {
      const email = String(body.email || '').trim().toLowerCase();
      const found = everyone.find(item => item.email.toLowerCase() === email);
      if (found) { const token = uid('reset'); db.passwordResets[token] = { userId: found.id, email, createdAt: new Date().toISOString() }; pushNotification(db, { userId: found.id, email, subject: 'Réinitialisation du mot de passe', message: `Bonjour ${found.fullName}, un lien de réinitialisation a été demandé pour votre compte.\nToken démo: ${token}\nDans une vraie mise en production, ce token serait envoyé par email via SMTP / API mail.` }); saveMockDb(db); }
      return { ok: true };
    }
    if ((path === '/technicians' || path === '/technicians/top') && method === 'GET') { recalculateTechnicians(db); saveMockDb(db); return { technicians: [...db.technicians].sort((a, b) => Number(b.averageRating || 0) - Number(a.averageRating || 0) || Number(b.reviewCount || 0) - Number(a.reviewCount || 0)) }; }
    let match = path.match(/^\/technicians\/([^/]+)$/);
    if (match && method === 'GET') { recalculateTechnicians(db); saveMockDb(db); const tech = db.technicians.find(item => item.id === match[1]); if (!tech) throw new Error('Technician not found'); return { technician: tech }; }
    match = path.match(/^\/technicians\/([^/]+)\/reviews$/);
    if (match && method === 'GET') return { reviews: db.reviews.filter(item => item.technicianId === match[1]).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) };
    if (match && method === 'POST') {
      const techId = match[1];
      if (!user || user.role !== 'client') throw new Error('Client login required');
      const request = db.requests.find(item => item.id === body.requestId);
      if (!request || request.clientId !== user.id || request.status !== 'completed' || request.assignedTechnicianId !== techId) throw new Error('Completed request required before rating');
      if (request.reviewByClientId) throw new Error('Review already submitted');
      const review = { id: uid('review'), technicianId: techId, clientId: user.id, requestId: request.id, name: String(body.name || '').trim(), rating: Number(body.rating || 0), comment: String(body.comment || '').trim(), createdAt: new Date().toISOString() };
      db.reviews.push(review); request.reviewByClientId = user.id; recalculateTechnicians(db); const tech = db.technicians.find(item => item.id === techId); pushNotification(db, { userId: user.id, email: user.email, subject: 'Avis publié', message: `Votre avis pour ${tech?.fullName || 'le technicien'} a été enregistré.` }); if (tech) pushNotification(db, { userId: tech.id, email: tech.email, subject: 'Nouveau avis client', message: `${user.fullName} a laissé une note de ${review.rating}/5 sur TUNIFIX.` }); saveMockDb(db); return { ok: true, review };
    }
    if (path === '/requests' && method === 'GET') { if (!user) throw new Error('Unauthorized'); return { requests: user.role === 'client' ? db.requests.filter(item => item.clientId === user.id) : [...db.requests].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) }; }
    if (path === '/requests' && method === 'POST') {
      if (!user || user.role !== 'client') throw new Error('Client login required');
      const request = { id: uid('request'), clientId: user.id, fullName: String(body.fullName || user.fullName || '').trim(), email: String(body.email || user.email || '').trim().toLowerCase(), phone: String(body.phone || user.phone || '').trim(), city: String(body.city || user.city || '').trim(), service: String(body.service || '').trim(), urgency: String(body.urgency || '').trim(), title: String(body.title || '').trim(), description: String(body.description || '').trim(), images: Array.isArray(body.images) ? body.images : [], status: 'open', assignedTechnicianId: null, assignedTechnicianName: null, reviewByClientId: null, createdAt: new Date().toISOString() };
      db.requests.unshift(request); pushNotification(db, { userId: user.id, email: user.email, subject: 'Demande créée', message: `Votre demande "${request.title}" a été publiée.` }); saveMockDb(db); return { request };
    }
    match = path.match(/^\/requests\/([^/]+)$/);
    if (match && method === 'PUT') {
      if (!user || user.role !== 'client') throw new Error('Client login required');
      const request = db.requests.find(item => item.id === match[1]);
      if (!request) throw new Error('Request not found');
      if (request.clientId !== user.id) throw new Error('You can only edit your own requests');
      if (request.status !== 'open') throw new Error('Only open requests can be edited');
      Object.assign(request, { fullName: String(body.fullName || request.fullName).trim(), email: String(body.email || request.email).trim().toLowerCase(), phone: String(body.phone || request.phone).trim(), city: String(body.city || request.city).trim(), service: String(body.service || request.service).trim(), urgency: String(body.urgency || request.urgency).trim(), title: String(body.title || request.title).trim(), description: String(body.description || request.description).trim(), images: Array.isArray(body.images) ? body.images : request.images });
      pushNotification(db, { userId: user.id, email: user.email, subject: 'Demande mise à jour', message: `Votre demande "${request.title}" a été modifiée.` }); saveMockDb(db); return { request };
    }
    if (match && method === 'DELETE') {
      if (!user || user.role !== 'client') throw new Error('Client login required');
      const idx = db.requests.findIndex(item => item.id === match[1]); if (idx === -1) throw new Error('Request not found'); const request = db.requests[idx];
      if (request.clientId !== user.id) throw new Error('You can only delete your own requests');
      if (request.status !== 'open') throw new Error('Only open requests can be deleted');
      db.requests.splice(idx, 1); saveMockDb(db); return { ok: true };
    }
    match = path.match(/^\/requests\/([^/]+)\/accept$/);
    if (match && method === 'POST') {
      if (!user || user.role !== 'technician') throw new Error('Technician login required');
      const request = db.requests.find(item => item.id === match[1]); if (!request) throw new Error('Request not found'); if (request.status !== 'open') throw new Error('Already assigned');
      request.status = 'assigned'; request.assignedTechnicianId = user.id; request.assignedTechnicianName = user.fullName;
      pushNotification(db, { userId: user.id, email: user.email, subject: 'Mission acceptée', message: `Vous avez accepté la mission "${request.title}".` });
      const client = db.clients.find(item => item.id === request.clientId); if (client) pushNotification(db, { userId: client.id, email: client.email, subject: 'Un technicien a accepté votre demande', message: `${user.fullName} a accepté votre demande "${request.title}".` });
      saveMockDb(db); return { request };
    }
    match = path.match(/^\/requests\/([^/]+)\/complete$/);
    if (match && method === 'POST') {
      if (!user || user.role !== 'technician') throw new Error('Technician login required');
      const request = db.requests.find(item => item.id === match[1]); if (!request) throw new Error('Request not found'); if (request.assignedTechnicianId !== user.id) throw new Error('Only assigned technician can complete');
      request.status = 'completed';
      const client = db.clients.find(item => item.id === request.clientId); if (client) pushNotification(db, { userId: client.id, email: client.email, subject: 'Mission terminée', message: `La mission "${request.title}" est marquée comme terminée. Vous pouvez maintenant noter le technicien depuis votre tableau de bord.` });
      pushNotification(db, { userId: user.id, email: user.email, subject: 'Mission terminée', message: `Vous avez marqué la mission "${request.title}" comme terminée.` }); saveMockDb(db); return { request };
    }
    if (path === '/notifications' && method === 'GET') { if (!user) return { notifications: [] }; return { notifications: db.notifications.filter(item => item.userId === user.id || item.email.toLowerCase() === String(user.email || '').toLowerCase()) }; }
    throw new Error('Request failed');
  }


  const pageTitleMap = {
    'index.html': 'title.index',
    'login-client.html': 'title.loginClient',
    'login-technician.html': 'title.loginTech',
    'register-client.html': 'title.registerClient',
    'register-technician.html': 'title.registerTech',
    'register.html': 'title.registerChoose',
    'post.html': 'title.post',
    'profile.html': 'title.profile',
    'tech.html': 'title.tech'
  };

  function injectResponsiveFixes() {
    if (document.getElementById('tunifixResponsiveFixes')) return;
    const style = document.createElement('style');
    style.id = 'tunifixResponsiveFixes';
    style.textContent = `
      @media (max-width: 767.98px) {
        .hero-title, .page-title { font-size: 2rem !important; line-height: 1.12 !important; }
        .hero-subtitle, .page-subtitle { font-size: .98rem !important; }
        .hero-actions, .d-flex.flex-wrap.gap-2, .mini-badges, .mt-3 { gap: 10px !important; }
        .hero-actions .btn-main, .hero-actions .btn-outline-custom, .btn-main, .btn-outline-custom, .btn-lightish { width: 100%; justify-content: center; text-align: center; }
        .mini-badge { width: 100%; justify-content: center; text-align: center; }
        .floating-stat { position: static !important; width: 100%; margin-top: 12px; }
        .hero-card img { height: 280px !important; }
        .navbar .container, nav .container { gap: 10px; }
        .navbar .ms-auto { width: auto; }
        .lang-select { min-width: 120px !important; }
        .card-body, .premium-card .card-body, .profile-card .card-body, .review-card .card-body, .panel-card .card-body, .form-card .card-body, .side-card .card-body, .job-card .card-body { padding: 22px !important; }
        .social-links a { margin-bottom: 8px; }
        body.rtl-layout .navbar .ms-auto { margin-right: auto !important; margin-left: 0 !important; }
      }
    `;
    document.head.appendChild(style);
  }

  const uiStrings = {
    fr: {
      'lang.fr': 'Français', 'lang.en': 'English', 'lang.ar': 'العربية',
      'title.index': 'TUNIFIX', 'title.loginClient': 'TUNIFIX - Connexion client', 'title.loginTech': 'TUNIFIX - Connexion technicien', 'title.registerClient': 'TUNIFIX - Inscription client', 'title.registerTech': 'TUNIFIX - Inscription technicien', 'title.registerChoose': 'TUNIFIX - Inscription', 'title.post': 'TUNIFIX - Espace client', 'title.profile': 'TUNIFIX - Profil technicien', 'title.tech': 'TUNIFIX - Espace technicien',
      'nav.findTech': 'Trouver un technicien', 'nav.findJob': 'Trouver un travail', 'nav.postNeed': 'Publier un besoin', 'nav.receiveJobs': 'Recevoir des missions',
      'common.footerAbout': 'Plateforme de mise en relation entre clients et techniciens en Tunisie.', 'common.servicesTitle': 'Services', 'common.contactTitle': 'Contact', 'common.tunisia': 'Tunisie', 'common.footerBottom': 'TUNIFIX © 2026 - Tous droits réservés', 'common.notifications': 'Emails', 'common.topRated': 'Top techniciens', 'common.forgotPassword': 'Mot de passe oublié ?', 'common.resetByEmail': 'Réinitialiser par email', 'common.emailAddress': 'Adresse email', 'common.sendResetLink': 'Envoyer le lien', 'common.resetSent': 'Un email de réinitialisation a été généré.',
      'common.email': 'Email', 'common.password': 'Mot de passe', 'common.fullName': 'Nom complet', 'common.phone': 'Téléphone', 'common.city': 'Ville', 'common.confirmPassword': 'Confirmer le mot de passe', 'common.specialty': 'Spécialité', 'common.experience': 'Expérience', 'common.description': 'Description', 'common.name': 'Nom', 'common.login': 'Se connecter', 'common.createAccount': 'Créer le compte', 'common.backToLogin': 'Retour à la connexion', 'common.logout': 'Déconnexion', 'common.sessionUntil': 'Session active jusqu’au',
      'common.emailPlaceholder': 'nom@domaine.com', 'common.passwordPlaceholder': 'Votre mot de passe', 'common.fullNamePlaceholder': 'Votre nom complet', 'common.phoneDigits': 'Chiffres uniquement', 'common.cityPlaceholder': 'Votre ville', 'common.cityAreaPlaceholder': 'Ville / zone', 'common.strongPassword': 'Mot de passe fort', 'common.confirmPasswordPlaceholder': 'Confirmez le mot de passe', 'common.namePlaceholder': 'Votre nom', 'common.experiencePlaceholder': 'Ex : 5 ans',
      'service.plomberie': 'Plomberie', 'service.electricite': 'Électricité', 'service.video': 'Vidéosurveillance', 'service.appliance': 'Électroménager', 'service.wood': 'Menuiserie', 'service.weld': 'Soudure', 'service.diy': 'Bricolage', 'service.assembly': 'Montage', 'service.garden': 'Jardinage', 'service.ac': 'Chaud / Froid', 'service.paint': 'Peinture', 'service.pool': 'Piscine',
      'urgency.low': 'Faible', 'urgency.normal': 'Normale', 'urgency.urgent': 'Urgente',
      'index.heroTitle': 'Trouvez un technicien fiable. Ou décrochez votre prochaine mission.', 'index.heroSubtitle': 'TUNIFIX connecte les clients et les techniciens en Tunisie pour les services maison, réparation, installation, entretien et dépannage.', 'index.heroClientBtn': 'Espace client', 'index.heroTechBtn': 'Espace technicien', 'index.heroStatTopLabel': 'Demandes actives', 'index.heroStatTopValue': '+120 missions', 'index.heroStatBottomLabel': 'Services populaires', 'index.heroStatBottomValue': 'Électroménager • Piscine', 'index.servicesTitle': 'Services principaux', 'index.servicesSubtitle': 'Une plateforme unique pour les besoins maison, réparation, installation, entretien et dépannage.', 'index.servicePlomberieText': 'Fuites, tuyaux, robinets, réparations sanitaires.', 'index.serviceElectriciteText': 'Prises, câblage, lumières, disjoncteurs et dépannage.', 'index.serviceVideoText': 'Installation, configuration et maintenance des caméras.', 'index.serviceApplianceText': 'Machine à laver, frigo, four, lave-vaisselle et entretien.', 'index.serviceWoodText': 'Meubles, portes, étagères, réparations en bois.', 'index.serviceWeldText': 'Travaux métalliques, réparations et fabrication sur mesure.', 'index.serviceDiyText': 'Petits travaux et réparations diverses à domicile.', 'index.serviceAssemblyText': 'Montage et installation de meubles et équipements.', 'index.serviceGardenText': 'Entretien, tonte, taille, nettoyage et plantation.', 'index.serviceAcText': 'Climatisation, chauffage, entretien et réparation.', 'index.servicePaintText': 'Peinture intérieure, extérieure et finitions propres.', 'index.servicePoolText': 'Pompe, filtration, nettoyage et maintenance piscine.', 'index.spaceTitle': 'Choisissez votre espace', 'index.spaceSubtitle': 'Une expérience claire pour les clients et les techniciens.', 'index.clientCardTitle': 'Compte client', 'index.clientCardText': 'Publiez un besoin, comparez les profils et trouvez rapidement le bon technicien.', 'index.clientCardItem1': 'Créer un compte client', 'index.clientCardItem2': 'Publier une demande', 'index.clientCardItem3': 'Suivre les interventions', 'index.clientCardBtn': 'Ouvrir l’espace client', 'index.techCardTitle': 'Compte technicien', 'index.techCardText': 'Présentez vos services, trouvez des missions et développez votre activité.', 'index.techCardItem1': 'Créer un profil professionnel', 'index.techCardItem2': 'Recevoir des missions', 'index.techCardItem3': 'Gérer votre visibilité', 'index.techCardBtn': 'Ouvrir l’espace technicien',
      'loginClient.title': 'Connexion client', 'loginClient.subtitle': 'Accédez à votre espace pour publier un besoin, suivre vos demandes et entrer en contact avec des techniciens qualifiés.', 'loginClient.infoTitle': 'Espace client', 'loginClient.infoText': 'Publiez vos besoins rapidement et trouvez le bon technicien selon votre service, votre ville et votre urgence.', 'loginClient.infoItem1': 'Créer et gérer vos demandes', 'loginClient.infoItem2': 'Suivre les interventions', 'loginClient.infoItem3': 'Consulter les profils techniciens', 'loginClient.infoItem4': 'Comparer les services disponibles', 'loginClient.accountBadge': 'Compte client', 'loginClient.formTitle': 'Bienvenue sur votre espace', 'loginClient.formText': 'Entrez vos informations pour accéder à votre compte.',
      'loginTech.title': 'Connexion technicien', 'loginTech.subtitle': 'Accédez à votre espace professionnel pour recevoir des missions, gérer votre profil et développer votre activité.', 'loginTech.infoTitle': 'Espace technicien', 'loginTech.infoText': 'Présentez vos compétences, recevez des demandes et trouvez plus de clients dans votre région.', 'loginTech.infoItem1': 'Recevoir des missions ciblées', 'loginTech.infoItem2': 'Mettre en valeur vos spécialités', 'loginTech.infoItem3': 'Développer votre réputation', 'loginTech.infoItem4': 'Gérer vos demandes en cours', 'loginTech.accountBadge': 'Compte technicien', 'loginTech.formTitle': 'Accès professionnel', 'loginTech.formText': 'Connectez-vous pour gérer vos demandes et votre visibilité.',
      'registerClient.title': 'Inscription client', 'registerClient.subtitle': 'Créez votre compte pour publier vos besoins et entrer rapidement en relation avec des techniciens.', 'registerClient.formTitle': 'Créer votre compte',
      'registerTech.title': 'Inscription technicien', 'registerTech.subtitle': 'Créez votre profil professionnel et commencez à recevoir des missions.', 'registerTech.formTitle': 'Créer votre profil technicien',
      'registerChoose.heroTitle': 'Créer un compte', 'registerChoose.heroText': 'Choisissez si vous souhaitez publier des besoins ou proposer vos services sur TUNIFIX.', 'registerChoose.boxTitle': 'Choisir un type de compte', 'registerChoose.clientBadge': 'Compte client', 'registerChoose.clientTitle': 'Client', 'registerChoose.clientText': 'Pour publier un besoin et trouver le bon technicien.', 'registerChoose.techBadge': 'Compte technicien', 'registerChoose.techTitle': 'Technicien', 'registerChoose.techText': 'Pour proposer vos services et recevoir des missions.',
      'post.title': 'Publier un besoin', 'post.subtitle': 'Décrivez votre problème, ajoutez des photos, puis suivez le statut de votre demande jusqu’à l’avis final.', 'post.formTitle': 'Nouvelle demande', 'post.formText': 'Ajoutez les détails et des photos pour aider les techniciens à comprendre le problème.', 'post.category': 'Catégorie', 'post.urgency': 'Urgence', 'post.location': 'Localisation', 'post.issueTitle': 'Titre du problème', 'post.images': 'Images du problème', 'post.submit': 'Envoyer le problème', 'post.addImages': 'Ajouter des images', 'post.seeRatings': 'Voir les notes des techniciens', 'post.directoryTitle': 'Techniciens disponibles', 'post.directorySubtitle': 'Notes visibles avant de choisir', 'post.titlePlaceholder': 'Ex : machine à laver en panne', 'post.descriptionPlaceholder': 'Décrivez le problème', 'post.updatedSuccess': 'Demande mise à jour avec succès.',
      'dashboard.title': 'Tableau de bord client', 'dashboard.subtitle': 'Suivez vos demandes, leur statut, et voyez rapidement si un avis a déjà été laissé.', 'dashboard.totalRequests': 'demandes', 'dashboard.open': 'Ouvertes', 'dashboard.assigned': 'Assignées', 'dashboard.completed': 'Terminées', 'dashboard.rateTechnician': 'Noter le technicien', 'dashboard.noRequests': 'Aucune demande pour le moment.', 'dashboard.loginNeeded': 'Connectez-vous comme client pour gérer vos demandes.', 'dashboard.editBtn': 'Modifier', 'dashboard.deleteBtn': 'Supprimer', 'dashboard.reviewed': 'Avis laissé', 'dashboard.notReviewed': 'Avis non laissé', 'dashboard.awaitingReview': 'En attente', 'dashboard.saveEdit': 'Enregistrer les modifications', 'dashboard.confirmDelete': 'Supprimer cette demande ?', 'dashboard.onlyOpenEditable': 'Seules les demandes ouvertes peuvent être modifiées.', 'dashboard.onlyOpenDeletable': 'Seules les demandes ouvertes peuvent être supprimées.', 'dashboard.ownRequestOnly': 'Vous pouvez seulement modifier vos propres demandes.',
      'directory.viewProfile': 'Voir le profil', 'directory.empty': 'Aucun technicien pour le moment.',
      'profile.title': 'Profil technicien', 'profile.subtitle': 'Consultez les informations du profil professionnel, les spécialités et les avis clients.', 'profile.reviewsTitle': 'Avis clients', 'profile.reviewFormTitle': 'Ajouter un avis', 'profile.ratingField': 'Note', 'profile.comment': 'Commentaire', 'profile.commentPlaceholder': 'Votre avis sur le service', 'profile.publishReview': 'Publier l’avis', 'profile.contactButton': 'Contacter le technicien', 'profile.manageRating': 'Gérer votre note',
      'tech.title': 'Espace technicien', 'tech.subtitle': 'Consultez les demandes disponibles et gérez votre profil professionnel.', 'tech.profileTitle': 'Profil technicien', 'tech.profileText': 'Gérez vos informations principales.', 'tech.zone': 'Zone', 'tech.viewProfile': 'Voir le profil', 'tech.jobsTitle': 'Demandes disponibles'
    },
    en: {
      'lang.fr': 'French', 'lang.en': 'English', 'lang.ar': 'Arabic',
      'title.index': 'TUNIFIX', 'title.loginClient': 'TUNIFIX - Client login', 'title.loginTech': 'TUNIFIX - Technician login', 'title.registerClient': 'TUNIFIX - Client sign up', 'title.registerTech': 'TUNIFIX - Technician sign up', 'title.registerChoose': 'TUNIFIX - Sign up', 'title.post': 'TUNIFIX - Client area', 'title.profile': 'TUNIFIX - Technician profile', 'title.tech': 'TUNIFIX - Technician area',
      'nav.findTech': 'Find a technician', 'nav.findJob': 'Find a job', 'nav.postNeed': 'Post a request', 'nav.receiveJobs': 'Receive jobs',
      'common.footerAbout': 'A platform connecting clients and technicians in Tunisia.', 'common.servicesTitle': 'Services', 'common.contactTitle': 'Contact', 'common.tunisia': 'Tunisia', 'common.footerBottom': 'TUNIFIX © 2026 - All rights reserved', 'common.notifications': 'Emails', 'common.topRated': 'Top rated', 'common.forgotPassword': 'Forgot password?', 'common.resetByEmail': 'Reset by email', 'common.emailAddress': 'Email address', 'common.sendResetLink': 'Send link', 'common.resetSent': 'A reset email has been generated.',
      'common.email': 'Email', 'common.password': 'Password', 'common.fullName': 'Full name', 'common.phone': 'Phone', 'common.city': 'City', 'common.confirmPassword': 'Confirm password', 'common.specialty': 'Specialty', 'common.experience': 'Experience', 'common.description': 'Description', 'common.name': 'Name', 'common.login': 'Log in', 'common.createAccount': 'Create account', 'common.backToLogin': 'Back to login', 'common.logout': 'Log out', 'common.sessionUntil': 'Session active until',
      'common.emailPlaceholder': 'name@domain.com', 'common.passwordPlaceholder': 'Your password', 'common.fullNamePlaceholder': 'Your full name', 'common.phoneDigits': 'Digits only', 'common.cityPlaceholder': 'Your city', 'common.cityAreaPlaceholder': 'City / area', 'common.strongPassword': 'Strong password', 'common.confirmPasswordPlaceholder': 'Confirm password', 'common.namePlaceholder': 'Your name', 'common.experiencePlaceholder': 'Ex: 5 years',
      'service.plomberie': 'Plumbing', 'service.electricite': 'Electricity', 'service.video': 'Video surveillance', 'service.appliance': 'Home appliances', 'service.wood': 'Carpentry', 'service.weld': 'Welding', 'service.diy': 'Handyman work', 'service.assembly': 'Assembly', 'service.garden': 'Gardening', 'service.ac': 'Heating / Cooling', 'service.paint': 'Painting', 'service.pool': 'Pool',
      'urgency.low': 'Low', 'urgency.normal': 'Normal', 'urgency.urgent': 'Urgent',
      'index.heroTitle': 'Find a reliable technician. Or land your next job.', 'index.heroSubtitle': 'TUNIFIX connects clients and technicians in Tunisia for home services, repairs, installation, maintenance, and troubleshooting.', 'index.heroClientBtn': 'Client area', 'index.heroTechBtn': 'Technician area', 'index.heroStatTopLabel': 'Active requests', 'index.heroStatTopValue': '+120 jobs', 'index.heroStatBottomLabel': 'Popular services', 'index.heroStatBottomValue': 'Appliances • Pool', 'index.servicesTitle': 'Main services', 'index.servicesSubtitle': 'A single platform for home needs, repairs, installation, maintenance, and troubleshooting.', 'index.servicePlomberieText': 'Leaks, pipes, faucets, and plumbing repairs.', 'index.serviceElectriciteText': 'Sockets, wiring, lights, breakers, and repairs.', 'index.serviceVideoText': 'Camera installation, setup, and maintenance.', 'index.serviceApplianceText': 'Washing machine, fridge, oven, dishwasher, and maintenance.', 'index.serviceWoodText': 'Furniture, doors, shelves, and wood repairs.', 'index.serviceWeldText': 'Metal work, repairs, and custom fabrication.', 'index.serviceDiyText': 'Small home jobs and miscellaneous repairs.', 'index.serviceAssemblyText': 'Furniture and equipment assembly and installation.', 'index.serviceGardenText': 'Maintenance, mowing, trimming, cleaning, and planting.', 'index.serviceAcText': 'Air conditioning, heating, maintenance, and repair.', 'index.servicePaintText': 'Interior and exterior painting with clean finishes.', 'index.servicePoolText': 'Pump, filtration, cleaning, and pool maintenance.', 'index.spaceTitle': 'Choose your area', 'index.spaceSubtitle': 'A clear experience for clients and technicians.', 'index.clientCardTitle': 'Client account', 'index.clientCardText': 'Post a need, compare profiles, and quickly find the right technician.', 'index.clientCardItem1': 'Create a client account', 'index.clientCardItem2': 'Post a request', 'index.clientCardItem3': 'Track interventions', 'index.clientCardBtn': 'Open client area', 'index.techCardTitle': 'Technician account', 'index.techCardText': 'Show your services, find jobs, and grow your business.', 'index.techCardItem1': 'Create a professional profile', 'index.techCardItem2': 'Receive jobs', 'index.techCardItem3': 'Manage your visibility', 'index.techCardBtn': 'Open technician area',
      'loginClient.title': 'Client login', 'loginClient.subtitle': 'Access your area to post a request, track your jobs, and contact qualified technicians.', 'loginClient.infoTitle': 'Client area', 'loginClient.infoText': 'Post your needs quickly and find the right technician based on service, city, and urgency.', 'loginClient.infoItem1': 'Create and manage your requests', 'loginClient.infoItem2': 'Track interventions', 'loginClient.infoItem3': 'Browse technician profiles', 'loginClient.infoItem4': 'Compare available services', 'loginClient.accountBadge': 'Client account', 'loginClient.formTitle': 'Welcome back', 'loginClient.formText': 'Enter your details to access your account.',
      'loginTech.title': 'Technician login', 'loginTech.subtitle': 'Access your professional area to receive jobs, manage your profile, and grow your business.', 'loginTech.infoTitle': 'Technician area', 'loginTech.infoText': 'Show your skills, receive requests, and find more clients in your region.', 'loginTech.infoItem1': 'Receive targeted jobs', 'loginTech.infoItem2': 'Highlight your specialties', 'loginTech.infoItem3': 'Build your reputation', 'loginTech.infoItem4': 'Manage current requests', 'loginTech.accountBadge': 'Technician account', 'loginTech.formTitle': 'Professional access', 'loginTech.formText': 'Log in to manage your requests and visibility.',
      'registerClient.title': 'Client sign up', 'registerClient.subtitle': 'Create your account to post your needs and quickly get in touch with technicians.', 'registerClient.formTitle': 'Create your account',
      'registerTech.title': 'Technician sign up', 'registerTech.subtitle': 'Create your professional profile and start receiving jobs.', 'registerTech.formTitle': 'Create your technician profile',
      'registerChoose.heroTitle': 'Create an account', 'registerChoose.heroText': 'Choose whether you want to post requests or offer your services on TUNIFIX.', 'registerChoose.boxTitle': 'Choose an account type', 'registerChoose.clientBadge': 'Client account', 'registerChoose.clientTitle': 'Client', 'registerChoose.clientText': 'To post a need and find the right technician.', 'registerChoose.techBadge': 'Technician account', 'registerChoose.techTitle': 'Technician', 'registerChoose.techText': 'To offer your services and receive jobs.',
      'post.title': 'Post a request', 'post.subtitle': 'Describe your issue, add photos, then track your request until the final review.', 'post.formTitle': 'New request', 'post.formText': 'Add details and photos to help technicians understand the issue.', 'post.category': 'Category', 'post.urgency': 'Urgency', 'post.location': 'Location', 'post.issueTitle': 'Issue title', 'post.images': 'Problem images', 'post.submit': 'Send request', 'post.addImages': 'Add images', 'post.seeRatings': 'See technician ratings', 'post.directoryTitle': 'Available technicians', 'post.directorySubtitle': 'Ratings visible before choosing', 'post.titlePlaceholder': 'Ex: washing machine broken', 'post.descriptionPlaceholder': 'Describe the issue', 'post.updatedSuccess': 'Request updated successfully.',
      'dashboard.title': 'Client dashboard', 'dashboard.subtitle': 'Track your requests, their status, and quickly see whether a review has already been left.', 'dashboard.totalRequests': 'requests', 'dashboard.open': 'Open', 'dashboard.assigned': 'Assigned', 'dashboard.completed': 'Completed', 'dashboard.rateTechnician': 'Rate technician', 'dashboard.noRequests': 'No requests yet.', 'dashboard.loginNeeded': 'Log in as a client to manage your requests.', 'dashboard.editBtn': 'Edit', 'dashboard.deleteBtn': 'Delete', 'dashboard.reviewed': 'Reviewed', 'dashboard.notReviewed': 'Not reviewed', 'dashboard.awaitingReview': 'Waiting', 'dashboard.saveEdit': 'Save changes', 'dashboard.confirmDelete': 'Delete this request?', 'dashboard.onlyOpenEditable': 'Only open requests can be edited.', 'dashboard.onlyOpenDeletable': 'Only open requests can be deleted.', 'dashboard.ownRequestOnly': 'You can only modify your own requests.',
      'directory.viewProfile': 'View profile', 'directory.empty': 'No technicians yet.',
      'profile.title': 'Technician profile', 'profile.subtitle': 'Check professional information, specialties, and customer reviews.', 'profile.reviewsTitle': 'Customer reviews', 'profile.reviewFormTitle': 'Add a review', 'profile.ratingField': 'Rating', 'profile.comment': 'Comment', 'profile.commentPlaceholder': 'Your review of the service', 'profile.publishReview': 'Publish review', 'profile.contactButton': 'Contact technician', 'profile.manageRating': 'Manage your rating',
      'tech.title': 'Technician area', 'tech.subtitle': 'View available requests and manage your professional profile.', 'tech.profileTitle': 'Technician profile', 'tech.profileText': 'Manage your main information.', 'tech.zone': 'Area', 'tech.viewProfile': 'View profile', 'tech.jobsTitle': 'Available requests'
    },
    ar: {
      'lang.fr': 'الفرنسية', 'lang.en': 'الإنجليزية', 'lang.ar': 'العربية',
      'title.index': 'TUNIFIX', 'title.loginClient': 'TUNIFIX - تسجيل دخول الحريف', 'title.loginTech': 'TUNIFIX - تسجيل دخول الفني', 'title.registerClient': 'TUNIFIX - تسجيل الحريف', 'title.registerTech': 'TUNIFIX - تسجيل الفني', 'title.registerChoose': 'TUNIFIX - التسجيل', 'title.post': 'TUNIFIX - فضاء الحريف', 'title.profile': 'TUNIFIX - ملف الفني', 'title.tech': 'TUNIFIX - فضاء الفني',
      'nav.findTech': 'ابحث عن فني', 'nav.findJob': 'ابحث عن عمل', 'nav.postNeed': 'انشر طلبًا', 'nav.receiveJobs': 'استقبل مهامًا',
      'common.footerAbout': 'منصة تربط بين الحرفاء والفنيين في تونس.', 'common.servicesTitle': 'الخدمات', 'common.contactTitle': 'اتصال', 'common.tunisia': 'تونس', 'common.footerBottom': 'TUNIFIX © 2026 - جميع الحقوق محفوظة',
      'common.email': 'البريد الإلكتروني', 'common.password': 'كلمة المرور', 'common.fullName': 'الاسم الكامل', 'common.phone': 'الهاتف', 'common.city': 'المدينة', 'common.confirmPassword': 'تأكيد كلمة المرور', 'common.specialty': 'الاختصاص', 'common.experience': 'الخبرة', 'common.description': 'الوصف', 'common.name': 'الاسم', 'common.login': 'تسجيل الدخول', 'common.createAccount': 'إنشاء الحساب', 'common.backToLogin': 'العودة إلى تسجيل الدخول', 'common.logout': 'تسجيل الخروج', 'common.sessionUntil': 'الجلسة صالحة إلى',
      'common.emailPlaceholder': 'name@domain.com', 'common.passwordPlaceholder': 'كلمة المرور', 'common.fullNamePlaceholder': 'اسمك الكامل', 'common.phoneDigits': 'أرقام فقط', 'common.cityPlaceholder': 'مدينتك', 'common.cityAreaPlaceholder': 'المدينة / المنطقة', 'common.strongPassword': 'كلمة مرور قوية', 'common.confirmPasswordPlaceholder': 'أكد كلمة المرور', 'common.namePlaceholder': 'اسمك', 'common.experiencePlaceholder': 'مثال: 5 سنوات',
      'service.plomberie': 'سباكة', 'service.electricite': 'كهرباء', 'service.video': 'مراقبة فيديو', 'service.appliance': 'أجهزة منزلية', 'service.wood': 'نجارة', 'service.weld': 'لحام', 'service.diy': 'أشغال منزلية', 'service.assembly': 'تركيب', 'service.garden': 'بستنة', 'service.ac': 'تدفئة / تبريد', 'service.paint': 'دهان', 'service.pool': 'مسبح',
      'urgency.low': 'ضعيفة', 'urgency.normal': 'عادية', 'urgency.urgent': 'مستعجلة',
      'index.heroTitle': 'اعثر على فني موثوق. أو احصل على مهمتك القادمة.', 'index.heroSubtitle': 'تربط TUNIFIX بين الحرفاء والفنيين في تونس لخدمات المنزل والإصلاح والتركيب والصيانة والتدخل السريع.', 'index.heroClientBtn': 'فضاء الحريف', 'index.heroTechBtn': 'فضاء الفني', 'index.heroStatTopLabel': 'طلبات نشطة', 'index.heroStatTopValue': '+120 مهمة', 'index.heroStatBottomLabel': 'خدمات مطلوبة', 'index.heroStatBottomValue': 'أجهزة منزلية • مسبح', 'index.servicesTitle': 'الخدمات الرئيسية', 'index.servicesSubtitle': 'منصة واحدة لاحتياجات المنزل والإصلاح والتركيب والصيانة والتدخل السريع.', 'index.servicePlomberieText': 'تسربات وأنابيب وحنفيات وإصلاحات صحية.', 'index.serviceElectriciteText': 'مآخذ وأسلاك وأضواء وقواطع وإصلاحات.', 'index.serviceVideoText': 'تركيب الكاميرات وإعدادها وصيانتها.', 'index.serviceApplianceText': 'غسالة وثلاجة وفرن وغسالة صحون وصيانة.', 'index.serviceWoodText': 'أثاث وأبواب ورفوف وإصلاحات خشبية.', 'index.serviceWeldText': 'أشغال معدنية وإصلاحات وتصنيع حسب الطلب.', 'index.serviceDiyText': 'أعمال صغيرة وإصلاحات منزلية متنوعة.', 'index.serviceAssemblyText': 'تركيب الأثاث والمعدات وتجهيزها.', 'index.serviceGardenText': 'صيانة وقص وتشذيب وتنظيف وغراسة.', 'index.serviceAcText': 'تكييف وتدفئة وصيانة وإصلاح.', 'index.servicePaintText': 'دهان داخلي وخارجي وتشطيبات نظيفة.', 'index.servicePoolText': 'مضخة وفلترة وتنظيف وصيانة المسبح.', 'index.spaceTitle': 'اختر فضاءك', 'index.spaceSubtitle': 'تجربة واضحة للحرفاء والفنيين.', 'index.clientCardTitle': 'حساب حريف', 'index.clientCardText': 'انشر حاجتك وقارن الملفات واعثر بسرعة على الفني المناسب.', 'index.clientCardItem1': 'أنشئ حساب حريف', 'index.clientCardItem2': 'انشر طلبًا', 'index.clientCardItem3': 'تابع التدخلات', 'index.clientCardBtn': 'افتح فضاء الحريف', 'index.techCardTitle': 'حساب فني', 'index.techCardText': 'قدّم خدماتك واعثر على مهام وطوّر نشاطك.', 'index.techCardItem1': 'أنشئ ملفًا مهنيًا', 'index.techCardItem2': 'استقبل مهامًا', 'index.techCardItem3': 'أدر ظهورك', 'index.techCardBtn': 'افتح فضاء الفني',
      'loginClient.title': 'تسجيل دخول الحريف', 'loginClient.subtitle': 'ادخل إلى حسابك لنشر طلب ومتابعة احتياجاتك والتواصل مع فنيين مؤهلين.', 'loginClient.infoTitle': 'فضاء الحريف', 'loginClient.infoText': 'انشر حاجتك بسرعة واعثر على الفني المناسب حسب الخدمة والمدينة والاستعجال.', 'loginClient.infoItem1': 'إنشاء وإدارة الطلبات', 'loginClient.infoItem2': 'متابعة التدخلات', 'loginClient.infoItem3': 'تصفح ملفات الفنيين', 'loginClient.infoItem4': 'مقارنة الخدمات المتاحة', 'loginClient.accountBadge': 'حساب حريف', 'loginClient.formTitle': 'مرحبًا بك من جديد', 'loginClient.formText': 'أدخل معلوماتك للوصول إلى حسابك.',
      'loginTech.title': 'تسجيل دخول الفني', 'loginTech.subtitle': 'ادخل إلى فضائك المهني لاستقبال المهام وإدارة ملفك وتطوير نشاطك.', 'loginTech.infoTitle': 'فضاء الفني', 'loginTech.infoText': 'قدّم مهاراتك واستقبل الطلبات واعثر على مزيد من الحرفاء في منطقتك.', 'loginTech.infoItem1': 'استقبال مهام موجهة', 'loginTech.infoItem2': 'إبراز اختصاصاتك', 'loginTech.infoItem3': 'بناء سمعتك', 'loginTech.infoItem4': 'إدارة الطلبات الحالية', 'loginTech.accountBadge': 'حساب فني', 'loginTech.formTitle': 'دخول مهني', 'loginTech.formText': 'سجّل الدخول لإدارة طلباتك وظهورك.',
      'registerClient.title': 'تسجيل الحريف', 'registerClient.subtitle': 'أنشئ حسابك لنشر احتياجاتك والتواصل بسرعة مع الفنيين.', 'registerClient.formTitle': 'أنشئ حسابك',
      'registerTech.title': 'تسجيل الفني', 'registerTech.subtitle': 'أنشئ ملفك المهني وابدأ في استقبال المهام.', 'registerTech.formTitle': 'أنشئ ملفك الفني',
      'registerChoose.heroTitle': 'إنشاء حساب', 'registerChoose.heroText': 'اختر هل تريد نشر طلبات أو تقديم خدماتك على TUNIFIX.', 'registerChoose.boxTitle': 'اختر نوع الحساب', 'registerChoose.clientBadge': 'حساب حريف', 'registerChoose.clientTitle': 'حريف', 'registerChoose.clientText': 'لنشر حاجة والعثور على الفني المناسب.', 'registerChoose.techBadge': 'حساب فني', 'registerChoose.techTitle': 'فني', 'registerChoose.techText': 'لتقديم خدماتك واستقبال المهام.',
      'post.title': 'نشر طلب', 'post.subtitle': 'اشرح مشكلتك وأضف صورًا ثم تابع حالة طلبك حتى الرأي النهائي.', 'post.formTitle': 'طلب جديد', 'post.formText': 'أضف التفاصيل والصور لمساعدة الفنيين على فهم المشكلة.', 'post.category': 'الصنف', 'post.urgency': 'الاستعجال', 'post.location': 'الموقع', 'post.issueTitle': 'عنوان المشكلة', 'post.images': 'صور المشكلة', 'post.submit': 'إرسال الطلب', 'post.addImages': 'إضافة صور', 'post.seeRatings': 'مشاهدة تقييمات الفنيين', 'post.directoryTitle': 'الفنيون المتاحون', 'post.directorySubtitle': 'التقييمات ظاهرة قبل الاختيار', 'post.titlePlaceholder': 'مثال: آلة غسيل معطلة', 'post.descriptionPlaceholder': 'اشرح المشكلة', 'post.updatedSuccess': 'تم تحديث الطلب بنجاح.',
      'dashboard.title': 'لوحة الحريف', 'dashboard.subtitle': 'تابع طلباتك وحالتها واعرف بسرعة هل تم ترك رأي أم لا.', 'dashboard.totalRequests': 'طلبات', 'dashboard.open': 'مفتوحة', 'dashboard.assigned': 'مسندة', 'dashboard.completed': 'مكتملة', 'dashboard.rateTechnician': 'تقييم الفني', 'dashboard.noRequests': 'لا توجد طلبات حاليًا.', 'dashboard.loginNeeded': 'سجّل الدخول كحريف لإدارة طلباتك.', 'dashboard.editBtn': 'تعديل', 'dashboard.deleteBtn': 'حذف', 'dashboard.reviewed': 'تم ترك رأي', 'dashboard.notReviewed': 'لم يُترك رأي', 'dashboard.awaitingReview': 'في الانتظار', 'dashboard.saveEdit': 'حفظ التغييرات', 'dashboard.confirmDelete': 'حذف هذا الطلب؟', 'dashboard.onlyOpenEditable': 'يمكن تعديل الطلبات المفتوحة فقط.', 'dashboard.onlyOpenDeletable': 'يمكن حذف الطلبات المفتوحة فقط.', 'dashboard.ownRequestOnly': 'يمكنك تعديل طلباتك فقط.',
      'directory.viewProfile': 'عرض الملف', 'directory.empty': 'لا يوجد فنيوّن حاليًا.',
      'profile.title': 'ملف الفني', 'profile.subtitle': 'اطّلع على المعلومات المهنية والاختصاصات وآراء الحرفاء.', 'profile.reviewsTitle': 'آراء الحرفاء', 'profile.reviewFormTitle': 'أضف رأيًا', 'profile.ratingField': 'التقييم', 'profile.comment': 'التعليق', 'profile.commentPlaceholder': 'رأيك في الخدمة', 'profile.publishReview': 'نشر الرأي', 'profile.contactButton': 'الاتصال بالفني', 'profile.manageRating': 'إدارة تقييمك',
      'tech.title': 'فضاء الفني', 'tech.subtitle': 'اطلع على الطلبات المتاحة وأدر ملفك المهني.', 'tech.profileTitle': 'ملف الفني', 'tech.profileText': 'أدر معلوماتك الأساسية.', 'tech.zone': 'المنطقة', 'tech.viewProfile': 'عرض الملف', 'tech.jobsTitle': 'الطلبات المتاحة'
    }
  };

  const messages = {
    fr: {
      'common.emailError': 'Veuillez entrer une adresse email valide au format nom@domaine.com.',
      'common.phoneError': 'Le téléphone doit contenir uniquement des chiffres, entre 8 et 15.',
      'common.confirmPasswordError': 'Les mots de passe ne correspondent pas.',
      'common.emailExists': 'Cette adresse email existe déjà.',
      'common.badLogin': 'Email ou mot de passe incorrect.',
      'common.loginPasswordRequired': 'Veuillez entrer votre mot de passe.',
      'common.strongPasswordError': 'Le mot de passe doit être fort : 8 caractères minimum, une majuscule, une minuscule, un chiffre et un symbole.',
      'common.passwordMin': 'Le mot de passe doit contenir au moins 8 caractères.',
      'common.passwordLower': 'Ajoutez au moins une lettre minuscule.',
      'common.passwordUpper': 'Ajoutez au moins une lettre majuscule.',
      'common.passwordDigit': 'Ajoutez au moins un chiffre.',
      'common.passwordSpecial': 'Ajoutez au moins un symbole.',
      'common.backendOffline': 'Le backend ne répond pas. Lancez le serveur Node.js.',
      'common.genericError': 'Une erreur est survenue.',
      'clientRegister.nameError': 'Veuillez entrer votre nom complet.',
      'clientRegister.cityError': 'Veuillez entrer votre ville.',
      'clientRegister.success': 'Compte client créé avec succès.',
      'techRegister.nameError': 'Veuillez entrer le nom du technicien.',
      'techRegister.cityError': 'Veuillez entrer la ville du technicien.',
      'techRegister.specialtyError': 'Veuillez entrer une spécialité.',
      'techRegister.experienceError': 'Veuillez indiquer votre expérience.',
      'techRegister.success': 'Compte technicien créé avec succès.',
      'clientLogin.success': 'Connexion client réussie.',
      'techLogin.success': 'Connexion technicien réussie.',
      'post.nameError': 'Veuillez entrer votre nom complet.',
      'post.cityError': 'Veuillez entrer votre ville.',
      'post.titleError': 'Le titre du problème est trop court.',
      'post.descriptionError': 'La description doit contenir au moins 10 caractères.',
      'post.success': 'Votre besoin a bien été enregistré.',
      'profile.experienceLabel': 'Expérience',
      'profile.ratingLabel': 'Note',
      'profile.noReviews': 'Aucun avis pour le moment.',
      'profile.reviewNameError': 'Veuillez entrer votre nom.',
      'profile.reviewRatingError': 'Veuillez choisir une note.',
      'profile.reviewCommentError': 'Veuillez écrire un avis plus détaillé.',
      'profile.reviewSuccess': 'Votre avis a été ajouté.', 'profile.reviewRequiresCompletedJob': 'اختر مهمة مكتملة من لوحة الحريف قبل التقييم.', 'profile.selectCompletedJob': 'Choisissez la mission terminée à noter', 'profile.selectedCompletedJob': 'Mission prête pour l’avis', 'profile.readyToReview': 'Mission terminée détectée. Vous pouvez noter ce technicien.', 'profile.clientLoginToReview': 'Connectez-vous comme client pour publier un avis.', 'profile.techCannotReview': 'Le technicien ne peut pas publier un avis sur son propre profil.',
      'tech.acceptMission': 'Accepter mission',
      'tech.noJobs': 'Aucune demande disponible pour le moment.',
      'tech.acceptedMission': 'Mission acceptée.',
      'tech.completeMission': 'Marquer comme terminée',
      'tech.completedMission': 'Mission terminée',
      'tech.alreadyAssigned': 'Déjà assignée',
      'profile.noContact': 'Aucun contact disponible pour ce technicien.'
    },
    en: {
      'common.emailError': 'Please enter a valid email in the form name@domain.com.',
      'common.phoneError': 'Phone must contain digits only, between 8 and 15.',
      'common.confirmPasswordError': 'Passwords do not match.',
      'common.emailExists': 'This email address already exists.',
      'common.badLogin': 'Incorrect email or password.',
      'common.loginPasswordRequired': 'Please enter your password.',
      'common.strongPasswordError': 'Password must be strong: at least 8 characters, one uppercase, one lowercase, one digit, and one symbol.',
      'common.passwordMin': 'Password must contain at least 8 characters.',
      'common.passwordLower': 'Add at least one lowercase letter.',
      'common.passwordUpper': 'Add at least one uppercase letter.',
      'common.passwordDigit': 'Add at least one digit.',
      'common.passwordSpecial': 'Add at least one symbol.',
      'common.backendOffline': 'The backend is not responding. Start the Node.js server.',
      'common.genericError': 'An error occurred.',
      'clientRegister.nameError': 'Please enter your full name.',
      'clientRegister.cityError': 'Please enter your city.',
      'clientRegister.success': 'Client account created successfully.',
      'techRegister.nameError': 'Please enter the technician name.',
      'techRegister.cityError': 'Please enter the technician city.',
      'techRegister.specialtyError': 'Please enter a specialty.',
      'techRegister.experienceError': 'Please enter your experience.',
      'techRegister.success': 'Technician account created successfully.',
      'clientLogin.success': 'Client login successful.',
      'techLogin.success': 'Technician login successful.',
      'post.nameError': 'Please enter your full name.',
      'post.cityError': 'Please enter your city.',
      'post.titleError': 'The issue title is too short.',
      'post.descriptionError': 'The description must contain at least 10 characters.',
      'post.success': 'Your request has been saved successfully.',
      'profile.experienceLabel': 'Experience',
      'profile.ratingLabel': 'Rating',
      'profile.noReviews': 'No reviews yet.',
      'profile.reviewNameError': 'Please enter your name.',
      'profile.reviewRatingError': 'Please choose a rating.',
      'profile.reviewCommentError': 'Please write a more detailed review.',
      'profile.reviewSuccess': 'Your review has been added.', 'profile.reviewRequiresCompletedJob': 'Select a completed job from your dashboard before reviewing.', 'profile.readyToReview': 'Completed job detected. You can now rate this technician.', 'profile.clientLoginToReview': 'Log in as a client to publish a review.', 'profile.techCannotReview': 'Technicians cannot review their own profile.',
      'tech.acceptMission': 'Accept mission',
      'tech.noJobs': 'No requests available right now.',
      'tech.acceptedMission': 'Mission accepted.',
      'tech.completeMission': 'Mark as completed',
      'tech.completedMission': 'Mission completed',
      'tech.alreadyAssigned': 'Already assigned',
      'profile.noContact': 'No contact details available for this technician.'
    },
    ar: {
      'common.emailError': 'أدخل بريدًا إلكترونيًا صحيحًا بصيغة اسم@موقع.كوم.',
      'common.phoneError': 'رقم الهاتف يجب أن يحتوي على أرقام فقط بين 8 و15 رقمًا.',
      'common.confirmPasswordError': 'كلمتا المرور غير متطابقتين.',
      'common.emailExists': 'هذا البريد الإلكتروني موجود بالفعل.',
      'common.badLogin': 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
      'common.loginPasswordRequired': 'أدخل كلمة المرور.',
      'common.strongPasswordError': 'كلمة المرور يجب أن تكون قوية: 8 أحرف على الأقل مع حرف كبير وحرف صغير ورقم ورمز.',
      'common.passwordMin': 'كلمة المرور يجب أن تحتوي على 8 أحرف على الأقل.',
      'common.passwordLower': 'أضف حرفًا صغيرًا واحدًا على الأقل.',
      'common.passwordUpper': 'أضف حرفًا كبيرًا واحدًا على الأقل.',
      'common.passwordDigit': 'أضف رقمًا واحدًا على الأقل.',
      'common.passwordSpecial': 'أضف رمزًا واحدًا على الأقل.',
      'common.backendOffline': 'الخادم الخلفي لا يرد. شغّل خادم Node.js.',
      'common.genericError': 'حدث خطأ ما.',
      'clientRegister.nameError': 'أدخل الاسم الكامل.',
      'clientRegister.cityError': 'أدخل المدينة.',
      'clientRegister.success': 'تم إنشاء حساب الحريف بنجاح.',
      'techRegister.nameError': 'أدخل اسم الفني.',
      'techRegister.cityError': 'أدخل مدينة الفني.',
      'techRegister.specialtyError': 'أدخل الاختصاص.',
      'techRegister.experienceError': 'أدخل الخبرة.',
      'techRegister.success': 'تم إنشاء حساب الفني بنجاح.',
      'clientLogin.success': 'تم تسجيل دخول الحريف بنجاح.',
      'techLogin.success': 'تم تسجيل دخول الفني بنجاح.',
      'post.nameError': 'أدخل الاسم الكامل.',
      'post.cityError': 'أدخل المدينة.',
      'post.titleError': 'عنوان المشكلة قصير جدًا.',
      'post.descriptionError': 'الوصف يجب أن يحتوي على 10 أحرف على الأقل.',
      'post.success': 'تم تسجيل طلبك بنجاح.',
      'profile.experienceLabel': 'الخبرة',
      'profile.ratingLabel': 'التقييم',
      'profile.noReviews': 'لا توجد آراء حاليًا.',
      'profile.reviewNameError': 'أدخل اسمك.',
      'profile.reviewRatingError': 'اختر تقييمًا.',
      'profile.reviewCommentError': 'اكتب رأيًا أوضح.',
      'profile.reviewSuccess': 'تمت إضافة رأيك.', 'profile.reviewRequiresCompletedJob': 'اختر مهمة مكتملة من لوحة الحريف قبل التقييم.', 'profile.selectCompletedJob': 'اختر المهمة المكتملة للتقييم', 'profile.selectedCompletedJob': 'المهمة الجاهزة للتقييم', 'profile.readyToReview': 'تم العثور على مهمة مكتملة ويمكنك الآن تقييم هذا الفني.', 'profile.clientLoginToReview': 'سجّل الدخول كحريف لنشر رأيك.', 'profile.techCannotReview': 'لا يمكن للفني تقييم ملفه الشخصي.',
      'tech.acceptMission': 'قبول المهمة',
      'tech.noJobs': 'لا توجد طلبات متاحة الآن.',
      'tech.acceptedMission': 'تم قبول المهمة.',
      'tech.completeMission': 'وضع علامة مكتملة',
      'tech.completedMission': 'تمت المهمة',
      'tech.alreadyAssigned': 'تم إسنادها بالفعل',
      'profile.noContact': 'لا توجد معلومات اتصال متاحة لهذا الفني.'
    }
  };

  function getText(key) {
    const lang = currentLang();
    return uiStrings[lang]?.[key] || uiStrings.fr[key] || messages[lang]?.[key] || messages.fr[key] || key;
  }

  const pageTranslations = {
    'login-client.html': {
      title: { fr: 'TUNIFIX - Connexion client', en: 'TUNIFIX - Client login', ar: 'TUNIFIX - تسجيل دخول الحريف' },
      text: {
        '.page-title': { fr: 'Connexion client', en: 'Client login', ar: 'تسجيل دخول الحريف' },
        '.page-subtitle': { fr: 'Accédez à votre espace pour publier un besoin, suivre vos demandes et entrer en contact avec des techniciens qualifiés.', en: 'Access your area to post a request, track your jobs, and contact qualified technicians.', ar: 'ادخل إلى حسابك لنشر طلب ومتابعة احتياجاتك والتواصل مع فنيين مؤهلين.' },
        '#clientLoginForm label[for="clientLoginEmail"]': { fr: 'Email', en: 'Email', ar: 'البريد الإلكتروني' },
        '#clientLoginForm label[for="clientLoginPassword"]': { fr: 'Mot de passe', en: 'Password', ar: 'كلمة المرور' },
        '#clientLoginSubmit': { fr: 'Se connecter', en: 'Log in', ar: 'تسجيل الدخول' },
        '#clientCreateAccountLink': { fr: 'Créer un compte', en: 'Create an account', ar: 'إنشاء حساب' }
      },
      placeholders: {
        '#clientLoginEmail': { fr: 'Votre email', en: 'Your email', ar: 'بريدك الإلكتروني' },
        '#clientLoginPassword': { fr: 'Votre mot de passe', en: 'Your password', ar: 'كلمة المرور' }
      }
    },
    'login-technician.html': {
      title: { fr: 'TUNIFIX - Connexion technicien', en: 'TUNIFIX - Technician login', ar: 'TUNIFIX - تسجيل دخول الفني' },
      text: {
        '.page-title': { fr: 'Connexion technicien', en: 'Technician login', ar: 'تسجيل دخول الفني' },
        '.page-subtitle': { fr: 'Connectez-vous pour consulter les demandes disponibles et gérer votre activité.', en: 'Log in to view available jobs and manage your activity.', ar: 'سجّل الدخول للاطلاع على الطلبات المتاحة وإدارة نشاطك.' },
        '#technicianLoginForm label[for="technicianLoginEmail"]': { fr: 'Email', en: 'Email', ar: 'البريد الإلكتروني' },
        '#technicianLoginForm label[for="technicianLoginPassword"]': { fr: 'Mot de passe', en: 'Password', ar: 'كلمة المرور' },
        '#technicianLoginSubmit': { fr: 'Se connecter', en: 'Log in', ar: 'تسجيل الدخول' },
        '#technicianCreateAccountLink': { fr: 'Créer un compte', en: 'Create an account', ar: 'إنشاء حساب' }
      },
      placeholders: {
        '#technicianLoginEmail': { fr: 'Votre email', en: 'Your email', ar: 'بريدك الإلكتروني' },
        '#technicianLoginPassword': { fr: 'Votre mot de passe', en: 'Your password', ar: 'كلمة المرور' }
      }
    },
    'register-client.html': {
      title: { fr: 'TUNIFIX - Inscription client', en: 'TUNIFIX - Client registration', ar: 'TUNIFIX - تسجيل الحريف' },
      text: {
        '.page-title': { fr: 'Inscription client', en: 'Client registration', ar: 'تسجيل الحريف' },
        '.page-subtitle': { fr: 'Créez votre compte pour publier vos besoins et entrer rapidement en relation avec des techniciens.', en: 'Create your account to post your needs and quickly connect with technicians.', ar: 'أنشئ حسابك لنشر احتياجاتك والتواصل بسرعة مع الفنيين.' },
        '#clientRegisterForm label[for="clientFullName"]': { fr: 'Nom complet', en: 'Full name', ar: 'الاسم الكامل' },
        '#clientRegisterForm label[for="clientEmail"]': { fr: 'Email', en: 'Email', ar: 'البريد الإلكتروني' },
        '#clientRegisterForm label[for="clientPhone"]': { fr: 'Téléphone', en: 'Phone', ar: 'الهاتف' },
        '#clientRegisterForm label[for="clientCity"]': { fr: 'Ville', en: 'City', ar: 'المدينة' },
        '#clientRegisterForm label[for="clientPassword"]': { fr: 'Mot de passe', en: 'Password', ar: 'كلمة المرور' },
        '#clientRegisterForm label[for="clientConfirmPassword"]': { fr: 'Confirmer le mot de passe', en: 'Confirm password', ar: 'تأكيد كلمة المرور' },
        '#clientRegisterSubmit': { fr: 'Créer le compte', en: 'Create account', ar: 'إنشاء الحساب' },
        '#clientRegisterBackLink': { fr: 'Retour à la connexion', en: 'Back to login', ar: 'العودة إلى تسجيل الدخول' }
      },
      placeholders: {
        '#clientFullName': { fr: 'Votre nom complet', en: 'Your full name', ar: 'اسمك الكامل' },
        '#clientEmail': { fr: 'nom@domaine.com', en: 'name@domain.com', ar: 'name@domain.com' },
        '#clientPhone': { fr: 'Chiffres uniquement', en: 'Digits only', ar: 'أرقام فقط' },
        '#clientCity': { fr: 'Votre ville', en: 'Your city', ar: 'مدينتك' },
        '#clientPassword': { fr: 'Mot de passe fort', en: 'Strong password', ar: 'كلمة مرور قوية' },
        '#clientConfirmPassword': { fr: 'Confirmez le mot de passe', en: 'Confirm password', ar: 'أكد كلمة المرور' }
      }
    },
    'register-technician.html': {
      title: { fr: 'TUNIFIX - Inscription technicien', en: 'TUNIFIX - Technician registration', ar: 'TUNIFIX - تسجيل الفني' },
      text: {
        '.page-title': { fr: 'Inscription technicien', en: 'Technician registration', ar: 'تسجيل الفني' },
        '.page-subtitle': { fr: 'Créez votre profil professionnel et commencez à recevoir des missions.', en: 'Create your professional profile and start receiving jobs.', ar: 'أنشئ ملفك المهني وابدأ في استقبال المهام.' },
        '#technicianRegisterForm label[for="techFullName"]': { fr: 'Nom complet', en: 'Full name', ar: 'الاسم الكامل' },
        '#technicianRegisterForm label[for="techEmail"]': { fr: 'Email', en: 'Email', ar: 'البريد الإلكتروني' },
        '#technicianRegisterForm label[for="techPhone"]': { fr: 'Téléphone', en: 'Phone', ar: 'الهاتف' },
        '#technicianRegisterForm label[for="techCity"]': { fr: 'Ville', en: 'City', ar: 'المدينة' },
        '#technicianRegisterForm label[for="techPassword"]': { fr: 'Mot de passe', en: 'Password', ar: 'كلمة المرور' },
        '#technicianRegisterForm label[for="techConfirmPassword"]': { fr: 'Confirmer le mot de passe', en: 'Confirm password', ar: 'تأكيد كلمة المرور' },
        '#technicianRegisterForm label[for="techExperience"]': { fr: 'Expérience', en: 'Experience', ar: 'الخبرة' },
        '#technicianRegisterSubmit': { fr: 'Créer le compte', en: 'Create account', ar: 'إنشاء الحساب' },
        '#technicianRegisterBackLink': { fr: 'Retour à la connexion', en: 'Back to login', ar: 'العودة إلى تسجيل الدخول' }
      },
      placeholders: {
        '#techFullName': { fr: 'Votre nom complet', en: 'Your full name', ar: 'اسمك الكامل' },
        '#techEmail': { fr: 'nom@domaine.com', en: 'name@domain.com', ar: 'name@domain.com' },
        '#techPhone': { fr: 'Chiffres uniquement', en: 'Digits only', ar: 'أرقام فقط' },
        '#techCity': { fr: 'Votre ville', en: 'Your city', ar: 'مدينتك' },
        '#techPassword': { fr: 'Mot de passe fort', en: 'Strong password', ar: 'كلمة مرور قوية' },
        '#techConfirmPassword': { fr: 'Confirmez le mot de passe', en: 'Confirm password', ar: 'أكد كلمة المرور' },
        '#techExperience': { fr: 'Ex : 5 ans', en: 'Ex: 5 years', ar: 'مثال: 5 سنوات' }
      }
    },
    'post.html': {
      title: { fr: 'TUNIFIX - Espace client', en: 'TUNIFIX - Client area', ar: 'TUNIFIX - فضاء الحريف' },
      text: {
        '.page-title': { fr: 'Publier un besoin', en: 'Post a request', ar: 'نشر طلب' },
        '.page-subtitle': { fr: 'Décrivez votre problème en quelques étapes et recevez l’aide du bon technicien.', en: 'Describe your issue in a few steps and get help from the right technician.', ar: 'اشرح مشكلتك في خطوات قليلة واحصل على مساعدة الفني المناسب.' },
        '#requestForm label[for="requestFullName"]': { fr: 'Nom complet', en: 'Full name', ar: 'الاسم الكامل' },
        '#requestForm label[for="requestEmail"]': { fr: 'Email', en: 'Email', ar: 'البريد الإلكتروني' },
        '#requestForm label[for="requestCity"]': { fr: 'Localisation', en: 'Location', ar: 'الموقع' },
        '#requestForm label[for="requestTitle"]': { fr: 'Titre du problème', en: 'Issue title', ar: 'عنوان المشكلة' },
        '#requestForm label[for="requestDescription"]': { fr: 'Description', en: 'Description', ar: 'الوصف' },
        '#requestSubmit': { fr: 'Envoyer le problème', en: 'Send request', ar: 'إرسال الطلب' }
      },
      placeholders: {
        '#requestFullName': { fr: 'Votre nom', en: 'Your name', ar: 'اسمك' },
        '#requestEmail': { fr: 'nom@domaine.com', en: 'name@domain.com', ar: 'name@domain.com' },
        '#requestCity': { fr: 'Ville / zone', en: 'City / area', ar: 'المدينة / المنطقة' },
        '#requestTitle': { fr: 'Ex : machine à laver en panne', en: 'Ex: washing machine broken', ar: 'مثال: آلة غسيل معطلة' },
        '#requestDescription': { fr: 'Décrivez le problème', en: 'Describe the issue', ar: 'اشرح المشكلة' }
      }
    },
    'profile.html': {
      title: { fr: 'TUNIFIX - Profil technicien', en: 'TUNIFIX - Technician profile', ar: 'TUNIFIX - ملف الفني' },
      text: {
        '.page-title': { fr: 'Profil technicien', en: 'Technician profile', ar: 'ملف الفني' },
        '.page-subtitle': { fr: 'Consultez les informations du profil professionnel, les spécialités et les avis clients.', en: 'Check the professional profile, specialties, and customer reviews.', ar: 'اطّلع على الملف المهني والاختصاصات وآراء الحرفاء.' },
        '#reviewsTitle': { fr: 'Avis clients', en: 'Customer reviews', ar: 'آراء الحرفاء' },
        '#reviewFormTitle': { fr: 'Ajouter un avis', en: 'Add a review', ar: 'أضف رأيًا' },
        '#reviewForm label[for="reviewerName"]': { fr: 'Nom', en: 'Name', ar: 'الاسم' },
        '#reviewForm label[for="reviewComment"]': { fr: 'Avis', en: 'Review', ar: 'الرأي' },
        '#reviewSubmit': { fr: 'Publier l’avis', en: 'Publish review', ar: 'نشر الرأي' },
        '#contactTechBtn': { fr: 'Contacter le technicien', en: 'Contact technician', ar: 'الاتصال بالفني' }
      },
      placeholders: {
        '#reviewerName': { fr: 'Votre nom', en: 'Your name', ar: 'اسمك' },
        '#reviewComment': { fr: 'Votre avis sur le service', en: 'Your review of the service', ar: 'رأيك في الخدمة' }
      }
    },
    'tech.html': {
      title: { fr: 'TUNIFIX - Espace technicien', en: 'TUNIFIX - Technician area', ar: 'TUNIFIX - فضاء الفني' },
      text: {
        '.page-title': { fr: 'Espace technicien', en: 'Technician area', ar: 'فضاء الفني' },
        '.page-subtitle': { fr: 'Consultez les demandes disponibles et gérez votre profil professionnel.', en: 'View available requests and manage your professional profile.', ar: 'اطلع على الطلبات المتاحة وأدر ملفك المهني.' },
        '#viewProfileBtn': { fr: 'Voir le profil', en: 'View profile', ar: 'عرض الملف' },
        '#jobsTitle': { fr: 'Demandes disponibles', en: 'Available requests', ar: 'الطلبات المتاحة' }
      }
    },
    'register.html': {
      title: { fr: 'TUNIFIX - Inscription', en: 'TUNIFIX - Sign up', ar: 'TUNIFIX - التسجيل' },
      text: {
        'h1': { fr: 'Choisissez votre type de compte', en: 'Choose your account type', ar: 'اختر نوع الحساب' }
      }
    },
    'index.html': {
      title: { fr: 'TUNIFIX', en: 'TUNIFIX', ar: 'TUNIFIX' },
      text: {
        '#heroTitle': { fr: 'Trouvez un technicien fiable. Ou décrochez votre prochaine mission.', en: 'Find a reliable technician. Or land your next job.', ar: 'اعثر على فني موثوق. أو احصل على مهمتك القادمة.' },
        '#heroSubtitle': { fr: 'TUNIFIX connecte les clients et les techniciens en Tunisie pour les services de plomberie, électricité, électroménager, jardinage, peinture, piscine, chaud / froid et plus.', en: 'TUNIFIX connects clients and technicians in Tunisia for plumbing, electricity, appliances, gardening, painting, pool care, heating / cooling, and more.', ar: 'تربط TUNIFIX بين الحرفاء والفنيين في تونس لخدمات السباكة والكهرباء والأجهزة المنزلية والبستنة والدهان والمسابح والتبريد والتسخين وغير ذلك.' },
        '#heroClientBtn': { fr: 'Espace client', en: 'Client area', ar: 'فضاء الحريف' },
        '#heroTechBtn': { fr: 'Espace technicien', en: 'Technician area', ar: 'فضاء الفني' },
        '#badgeFindTech': { fr: '<i class="bi bi-search"></i> Trouver un technicien', en: '<i class="bi bi-search"></i> Find a technician', ar: '<i class="bi bi-search"></i> ابحث عن فني' },
        '#badgeFindJob': { fr: '<i class="bi bi-briefcase"></i> Trouver un travail', en: '<i class="bi bi-briefcase"></i> Find a job', ar: '<i class="bi bi-briefcase"></i> ابحث عن عمل' },
        '#badgePostNeed': { fr: '<i class="bi bi-pencil-square"></i> Publier un besoin', en: '<i class="bi bi-pencil-square"></i> Post a request', ar: '<i class="bi bi-pencil-square"></i> انشر طلبًا' },
        '#badgeReceiveJobs': { fr: '<i class="bi bi-bell"></i> Recevoir des missions', en: '<i class="bi bi-bell"></i> Receive jobs', ar: '<i class="bi bi-bell"></i> استقبل مهامًا' },
        '#heroStatTopLabel': { fr: 'Demandes actives', en: 'Active requests', ar: 'طلبات نشطة' },
        '#heroStatTopValue': { fr: '+120 missions', en: '+120 jobs', ar: '+120 مهمة' },
        '#heroStatBottomLabel': { fr: 'Services populaires', en: 'Popular services', ar: 'خدمات مطلوبة' },
        '#heroStatBottomValue': { fr: 'Électroménager • Piscine', en: 'Appliances • Pool', ar: 'أجهزة منزلية • مسبح' },
        '#servicesTitle': { fr: 'Services principaux', en: 'Main services', ar: 'الخدمات الرئيسية' },
        '#servicesSubtitle': { fr: 'Une plateforme unique pour les besoins maison, réparation, installation, entretien et dépannage.', en: 'A single platform for home needs, repairs, installation, maintenance, and troubleshooting.', ar: 'منصة واحدة لاحتياجات المنزل والإصلاح والتركيب والصيانة والتدخل السريع.' },
        '#servicePlomberieTitle': { fr: 'Plomberie', en: 'Plumbing', ar: 'سباكة' },
        '#servicePlomberieText': { fr: 'Fuites, tuyaux, robinets, réparations sanitaires.', en: 'Leaks, pipes, faucets, and plumbing repairs.', ar: 'تسربات وأنابيب وحنفيات وإصلاحات صحية.' },
        '#serviceElectriciteTitle': { fr: 'Électricité', en: 'Electricity', ar: 'كهرباء' },
        '#serviceElectriciteText': { fr: 'Prises, câblage, lumières, disjoncteurs et dépannage.', en: 'Sockets, wiring, lights, breakers, and repairs.', ar: 'مآخذ وأسلاك وأضواء وقواطع وإصلاحات.' },
        '#serviceVideoTitle': { fr: 'Vidéosurveillance', en: 'Video surveillance', ar: 'مراقبة فيديو' },
        '#serviceVideoText': { fr: 'Installation, configuration et maintenance des caméras.', en: 'Camera installation, setup, and maintenance.', ar: 'تركيب الكاميرات وإعدادها وصيانتها.' },
        '#serviceApplianceTitle': { fr: 'Électroménager', en: 'Home appliances', ar: 'أجهزة منزلية' },
        '#serviceApplianceText': { fr: 'Machine à laver, frigo, four, lave-vaisselle et entretien.', en: 'Washing machine, fridge, oven, dishwasher, and maintenance.', ar: 'غسالة وثلاجة وفرن وغسالة صحون وصيانة.' },
        '#serviceWoodTitle': { fr: 'Menuiserie', en: 'Carpentry', ar: 'نجارة' },
        '#serviceWoodText': { fr: 'Meubles, portes, étagères, réparations en bois.', en: 'Furniture, doors, shelves, and wood repairs.', ar: 'أثاث وأبواب ورفوف وإصلاحات خشبية.' },
        '#serviceWeldTitle': { fr: 'Soudure', en: 'Welding', ar: 'لحام' },
        '#serviceWeldText': { fr: 'Travaux métalliques, réparations et fabrication sur mesure.', en: 'Metal work, repairs, and custom fabrication.', ar: 'أشغال معدنية وإصلاحات وتصنيع حسب الطلب.' },
        '#serviceDiyTitle': { fr: 'Bricolage', en: 'Handyman work', ar: 'أشغال منزلية' },
        '#serviceDiyText': { fr: 'Petits travaux et réparations diverses à domicile.', en: 'Small home jobs and miscellaneous repairs.', ar: 'أعمال صغيرة وإصلاحات منزلية متنوعة.' },
        '#serviceAssemblyTitle': { fr: 'Montage', en: 'Assembly', ar: 'تركيب' },
        '#serviceAssemblyText': { fr: 'Montage et installation de meubles et équipements.', en: 'Furniture and equipment assembly and installation.', ar: 'تركيب الأثاث والمعدات وتجهيزها.' },
        '#serviceGardenTitle': { fr: 'Jardinage', en: 'Gardening', ar: 'بستنة' },
        '#serviceGardenText': { fr: 'Entretien, tonte, taille, nettoyage et plantation.', en: 'Maintenance, mowing, trimming, cleaning, and planting.', ar: 'صيانة وقص وتشذيب وتنظيف وغراسة.' },
        '#serviceAcTitle': { fr: 'Chaud / Froid', en: 'Heating / Cooling', ar: 'تدفئة / تبريد' },
        '#serviceAcText': { fr: 'Climatisation, chauffage, entretien et réparation.', en: 'Air conditioning, heating, maintenance, and repair.', ar: 'تكييف وتدفئة وصيانة وإصلاح.' },
        '#servicePaintTitle': { fr: 'Peinture', en: 'Painting', ar: 'دهان' },
        '#servicePaintText': { fr: 'Peinture intérieure, extérieure et finitions propres.', en: 'Interior and exterior painting with clean finishes.', ar: 'دهان داخلي وخارجي وتشطيبات نظيفة.' },
        '#servicePoolTitle': { fr: 'Piscine', en: 'Pool', ar: 'مسبح' },
        '#servicePoolText': { fr: 'Pompe, filtration, nettoyage et maintenance piscine.', en: 'Pump, filtration, cleaning, and pool maintenance.', ar: 'مضخة وفلترة وتنظيف وصيانة المسبح.' },
        '#spaceTitle': { fr: 'Choisissez votre espace', en: 'Choose your area', ar: 'اختر فضاءك' },
        '#spaceSubtitle': { fr: 'Une expérience claire pour les clients et les techniciens.', en: 'A clear experience for clients and technicians.', ar: 'تجربة واضحة للحرفاء والفنيين.' },
        '#clientCardTitle': { fr: 'Compte client', en: 'Client account', ar: 'حساب حريف' },
        '#clientCardText': { fr: 'Publiez un besoin, comparez les profils et trouvez rapidement le bon technicien.', en: 'Post a need, compare profiles, and quickly find the right technician.', ar: 'انشر حاجتك وقارن الملفات واعثر بسرعة على الفني المناسب.' },
        '#clientCardItem1': { fr: 'Créer un compte client', en: 'Create a client account', ar: 'أنشئ حساب حريف' },
        '#clientCardItem2': { fr: 'Publier une demande', en: 'Post a request', ar: 'انشر طلبًا' },
        '#clientCardItem3': { fr: 'Suivre les interventions', en: 'Track interventions', ar: 'تابع التدخلات' },
        '#clientCardBtn': { fr: 'Ouvrir l’espace client', en: 'Open client area', ar: 'افتح فضاء الحريف' },
        '#techCardTitle': { fr: 'Compte technicien', en: 'Technician account', ar: 'حساب فني' },
        '#techCardText': { fr: 'Présentez vos services, trouvez des missions et développez votre activité.', en: 'Show your services, find jobs, and grow your business.', ar: 'قدّم خدماتك واعثر على مهام وطوّر نشاطك.' },
        '#techCardItem1': { fr: 'Créer un profil professionnel', en: 'Create a professional profile', ar: 'أنشئ ملفًا مهنيًا' },
        '#techCardItem2': { fr: 'Recevoir des missions', en: 'Receive jobs', ar: 'استقبل مهامًا' },
        '#techCardItem3': { fr: 'Gérer votre visibilité', en: 'Manage your visibility', ar: 'أدر ظهورك' },
        '#techCardBtn': { fr: 'Ouvrir l’espace technicien', en: 'Open technician area', ar: 'افتح فضاء الفني' },
        '#footerAbout': { fr: 'Plateforme de mise en relation entre clients et techniciens en Tunisie.', en: 'A platform connecting clients and technicians in Tunisia.', ar: 'منصة تربط بين الحرفاء والفنيين في تونس.' },
        '#footerServicesTitle': { fr: 'Services', en: 'Services', ar: 'الخدمات' },
        '#footerService1': { fr: 'Plomberie', en: 'Plumbing', ar: 'سباكة' },
        '#footerService2': { fr: 'Électricité', en: 'Electricity', ar: 'كهرباء' },
        '#footerService3': { fr: 'Vidéosurveillance', en: 'Video surveillance', ar: 'مراقبة فيديو' },
        '#footerService4': { fr: 'Électroménager', en: 'Home appliances', ar: 'أجهزة منزلية' },
        '#footerService5': { fr: 'Menuiserie', en: 'Carpentry', ar: 'نجارة' },
        '#footerService6': { fr: 'Soudure', en: 'Welding', ar: 'لحام' },
        '#footerService7': { fr: 'Bricolage', en: 'Handyman work', ar: 'أشغال منزلية' },
        '#footerService8': { fr: 'Jardinage', en: 'Gardening', ar: 'بستنة' },
        '#footerService9': { fr: 'Chaud / Froid', en: 'Heating / Cooling', ar: 'تدفئة / تبريد' },
        '#footerService10': { fr: 'Peinture', en: 'Painting', ar: 'دهان' },
        '#footerService11': { fr: 'Piscine', en: 'Pool', ar: 'مسبح' },
        '#footerContactTitle': { fr: 'Contact', en: 'Contact', ar: 'اتصال' },
        '#footerBottom': { fr: 'TUNIFIX © 2026 - Tous droits réservés', en: 'TUNIFIX © 2026 - All rights reserved', ar: 'TUNIFIX © 2026 - جميع الحقوق محفوظة' }
      }
    }
  };
})();
