/* ═══════════════════════════════════════════════
   Betting League — Auth Page Interactions
   ═══════════════════════════════════════════════ */

(function () {
  'use strict';

  // ─── DOM ───
  const tabSignIn = document.getElementById('tabSignIn');
  const tabSignUp = document.getElementById('tabSignUp');
  const tabSlider = document.getElementById('tabSlider');
  const signInPanel = document.getElementById('signInPanel');
  const signUpPanel = document.getElementById('signUpPanel');
  const signInForm = document.getElementById('signInForm');
  const signUpForm = document.getElementById('signUpForm');
  const switchToSignUp = document.getElementById('switchToSignUp');
  const switchToSignIn = document.getElementById('switchToSignIn');

  // Eye toggles
  const siEyeToggle = document.getElementById('siEyeToggle');
  const suEyeToggle = document.getElementById('suEyeToggle');

  // Password strength
  const suPassword = document.getElementById('su_password');
  const passwordStrength = document.getElementById('passwordStrength');
  const strengthFill = document.getElementById('strengthFill');
  const strengthLabel = document.getElementById('strengthLabel');

  let currentTab = 'signin';

  // ─── Tab Switching ───
  function switchTab(tab) {
    currentTab = tab;

    if (tab === 'signin') {
      tabSignIn.classList.add('active');
      tabSignUp.classList.remove('active');
      tabSlider.classList.remove('right');
      signInPanel.classList.add('active');
      signUpPanel.classList.remove('active');
    } else {
      tabSignUp.classList.add('active');
      tabSignIn.classList.remove('active');
      tabSlider.classList.add('right');
      signUpPanel.classList.add('active');
      signInPanel.classList.remove('active');
    }
  }

  tabSignIn.addEventListener('click', () => switchTab('signin'));
  tabSignUp.addEventListener('click', () => switchTab('signup'));
  switchToSignUp.addEventListener('click', (e) => { e.preventDefault(); switchTab('signup'); });
  switchToSignIn.addEventListener('click', (e) => { e.preventDefault(); switchTab('signin'); });

  // ─── Eye Toggle (Password Show/Hide) ───
  function setupEyeToggle(toggleBtn, inputId) {
    if (!toggleBtn) return;
    const input = document.getElementById(inputId);
    toggleBtn.addEventListener('click', () => {
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      const open = toggleBtn.querySelector('.eye-open');
      const closed = toggleBtn.querySelector('.eye-closed');
      open.style.display = isPassword ? 'none' : 'block';
      closed.style.display = isPassword ? 'block' : 'none';
    });
  }

  setupEyeToggle(siEyeToggle, 'si_password');
  setupEyeToggle(suEyeToggle, 'su_password');

  // ─── Password Strength Meter ───
  function evaluatePassword(password) {
    if (!password) return { level: '', score: 0 };

    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;

    if (score <= 1) return { level: 'weak', label: 'Weak' };
    if (score === 2) return { level: 'fair', label: 'Fair' };
    if (score === 3) return { level: 'good', label: 'Good' };
    return { level: 'strong', label: 'Strong' };
  }

  if (suPassword) {
    suPassword.addEventListener('input', () => {
      const val = suPassword.value;
      if (val.length > 0) {
        passwordStrength.classList.add('visible');
        const result = evaluatePassword(val);
        strengthFill.className = 'strength-fill ' + result.level;
        strengthLabel.className = 'strength-label ' + result.level;
        strengthLabel.textContent = result.label;
      } else {
        passwordStrength.classList.remove('visible');
      }
    });
  }

  // ─── Form Validation UX ───
  function setFieldState(wrapId, state) {
    const wrap = document.getElementById(wrapId);
    if (!wrap) return;
    wrap.classList.remove('error', 'success');
    if (state) wrap.classList.add(state);
  }

  // Real-time email validation on sign-up
  const suEmail = document.getElementById('su_email');
  if (suEmail) {
    suEmail.addEventListener('blur', () => {
      if (suEmail.value && !suEmail.value.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        setFieldState('suEmailWrap', 'error');
      } else if (suEmail.value) {
        setFieldState('suEmailWrap', 'success');
      } else {
        setFieldState('suEmailWrap', null);
      }
    });
    suEmail.addEventListener('focus', () => setFieldState('suEmailWrap', null));
  }

  // Phone validation
  const suPhone = document.getElementById('su_phone');
  if (suPhone) {
    suPhone.addEventListener('blur', () => {
      const cleaned = suPhone.value.replace(/\D/g, '');
      if (suPhone.value && cleaned.length < 10) {
        setFieldState('suPhoneWrap', 'error');
      } else if (suPhone.value) {
        setFieldState('suPhoneWrap', 'success');
      } else {
        setFieldState('suPhoneWrap', null);
      }
    });
    suPhone.addEventListener('focus', () => setFieldState('suPhoneWrap', null));
  }

  // ─── Toast ───
  let toastWrap;
  function showToast(message, type = 'info') {
    if (!toastWrap) {
      toastWrap = document.createElement('div');
      toastWrap.className = 'toast-wrap';
      document.body.appendChild(toastWrap);
    }
    const toast = document.createElement('div');
    toast.className = `toast-msg ${type}`;
    toast.textContent = message;
    toastWrap.appendChild(toast);
    setTimeout(() => { if (toast.parentNode) toast.remove(); }, 3000);
  }

  // ─── Form Submissions ───
  if (signInForm) {
    signInForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('si_email').value.trim();
      const password = document.getElementById('si_password').value;

      if (!email) {
        setFieldState('siEmailWrap', 'error');
        showToast('Please enter your email or phone', 'error');
        return;
      }
      if (!password) {
        setFieldState('siPasswordWrap', 'error');
        showToast('Please enter your password', 'error');
        return;
      }

      // Call Backend API
      const btn = document.getElementById('signInSubmit');
      const originalHtml = btn.innerHTML;
      btn.innerHTML = 'LOADING...';
      btn.disabled = true;

      fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ identifier: email, password: password })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          localStorage.setItem('auth_token', data.token);
          localStorage.setItem('auth_user', JSON.stringify(data.user));
          showToast('Signed in successfully!', 'success');
          setTimeout(() => {
            if (data.user.role === 'admin') {
              window.location.href = '/admin';
            } else {
              window.location.href = '/dashboard';
            }
          }, 800);
        } else {
          setFieldState('siEmailWrap', 'error');
          setFieldState('siPasswordWrap', 'error');
          showToast(data.message || 'Login failed', 'error');
        }
      })
      .catch(err => {
        showToast('Server error. Try again.', 'error');
      })
      .finally(() => {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
      });
    });
  }

  if (signUpForm) {
    signUpForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('su_name').value.trim();
      const email = document.getElementById('su_email').value.trim();
      const phone = document.getElementById('su_phone').value.trim();
      const password = document.getElementById('su_password').value;
      const terms = document.getElementById('su_terms').checked;

      let valid = true;

      if (!name) { setFieldState('suNameWrap', 'error'); valid = false; }
      if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) { setFieldState('suEmailWrap', 'error'); valid = false; }
      if (!phone || phone.replace(/\D/g, '').length < 10) { setFieldState('suPhoneWrap', 'error'); valid = false; }
      if (!password || password.length < 8) { setFieldState('suPasswordWrap', 'error'); valid = false; }

      if (!valid) {
        showToast('Please fill all fields correctly', 'error');
        return;
      }

      if (!terms) {
        showToast('Please agree to Terms & Privacy Policy', 'error');
        return;
      }

      // Call Backend API
      const btn = document.getElementById('signUpSubmit');
      const originalHtml = btn.innerHTML;
      btn.innerHTML = 'LOADING...';
      btn.disabled = true;

      fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username: name, email: email, phone: phone, password: password })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          localStorage.setItem('auth_token', data.token);
          localStorage.setItem('auth_user', JSON.stringify(data.user));
          showToast('Account created! Redirecting...', 'success');
          setTimeout(() => {
            window.location.href = '/dashboard';
          }, 800);
        } else {
          showToast(data.message || 'Signup failed', 'error');
          setFieldState('suNameWrap', 'error');
        }
      })
      .catch(err => {
        showToast('Server error. Try again.', 'error');
      })
      .finally(() => {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
      });
    });
  }

  // ─── Handle URL hash for direct tab linking ───
  function checkHash() {
    const hash = window.location.hash;
    if (hash === '#signup') switchTab('signup');
    else switchTab('signin');
  }

  window.addEventListener('hashchange', checkHash);
  checkHash();

  // ─── Input focus animation: subtle bounce on the field icon ───
  document.querySelectorAll('.field-input').forEach(input => {
    input.addEventListener('focus', () => {
      const icon = input.closest('.field-input-wrap').querySelector('.field-icon');
      if (icon) {
        icon.style.transform = 'scale(1.1)';
        setTimeout(() => { icon.style.transform = 'scale(1)'; }, 200);
      }
    });
  });

})();
