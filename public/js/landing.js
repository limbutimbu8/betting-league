/* ═══════════════════════════════════════════════
   Betting League — Landing Page Interactions
   ═══════════════════════════════════════════════ */

(function () {
  'use strict';

  // ─── Navbar scroll effect ───
  const navbar = document.getElementById('navbar');
  let lastScrollY = 0;

  function handleScroll() {
    const scrollY = window.scrollY;
    if (scrollY > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
    lastScrollY = scrollY;
  }

  window.addEventListener('scroll', handleScroll, { passive: true });

  // ─── Mobile hamburger menu ───
  const hamburger = document.getElementById('navHamburger');
  const navLinks = document.getElementById('navLinks');

  if (hamburger) {
    hamburger.addEventListener('click', () => {
      navLinks.classList.toggle('mobile-open');
    });

    // Close on link click
    navLinks.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('mobile-open');
      });
    });
  }

  // ─── Smooth scroll for Learn More ───
  const learnMoreBtn = document.getElementById('learnMoreBtn');
  if (learnMoreBtn) {
    learnMoreBtn.addEventListener('click', () => {
      document.getElementById('games').scrollIntoView({ behavior: 'smooth' });
    });
  }

  // ─── Counter animation ───
  function animateCounters() {
    const counters = document.querySelectorAll('.hero-stat-value[data-target]');
    counters.forEach(counter => {
      const target = parseInt(counter.dataset.target);
      const prefix = counter.dataset.prefix || '';
      const suffix = counter.dataset.suffix || '+';
      const duration = 2000;
      const startTime = Date.now();

      function update() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.floor(eased * target);

        if (target >= 1000000) {
          counter.textContent = prefix + (current / 100000).toFixed(1) + 'L' + suffix;
        } else if (target >= 1000) {
          counter.textContent = prefix + current.toLocaleString('en-IN') + suffix;
        } else {
          counter.textContent = prefix + current + suffix;
        }

        if (progress < 1) {
          requestAnimationFrame(update);
        }
      }

      update();
    });
  }

  // Trigger counters when hero is visible
  const heroObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounters();
        heroObserver.disconnect();
      }
    });
  }, { threshold: 0.3 });

  const heroStats = document.querySelector('.hero-stats');
  if (heroStats) heroObserver.observe(heroStats);

  // ─── Scroll reveal animations ───
  function setupRevealAnimations() {
    const revealElements = document.querySelectorAll(
      '.game-card, .feature-card, .step-card, .testimonial-card, .section-header, .cta-card'
    );

    revealElements.forEach(el => el.classList.add('reveal'));

    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry, index) => {
        if (entry.isIntersecting) {
          // Stagger animations within same section
          const siblings = entry.target.parentElement.querySelectorAll('.reveal');
          let delay = 0;
          siblings.forEach((sib, i) => {
            if (sib === entry.target) delay = i * 100;
          });
          setTimeout(() => {
            entry.target.classList.add('visible');
          }, delay);
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    revealElements.forEach(el => revealObserver.observe(el));
  }

  setupRevealAnimations();

  // ─── Live winner ticker ───
  function generateTickerContent() {
    const names = [
      'Rahul P.', 'Sneha M.', 'Arjun K.', 'Priya S.', 'Amit R.', 'Neha G.',
      'Vikram T.', 'Anjali D.', 'Rohit B.', 'Kavita N.', 'Suresh L.', 'Divya C.',
      'Manish J.', 'Pooja V.', 'Kiran H.', 'Deepak A.', 'Swati W.', 'Raj M.',
      'Meera F.', 'Aditya S.'
    ];
    const amounts = [500, 1200, 2500, 4500, 8000, 12000, 750, 3200, 6800, 950, 15000, 1800, 22000, 600, 9500];
    const games = ['Color Trading', 'Color Trading', 'Color Trading'];

    let items = [];
    for (let i = 0; i < 20; i++) {
      const name = names[Math.floor(Math.random() * names.length)];
      const amount = amounts[Math.floor(Math.random() * amounts.length)];
      const game = games[Math.floor(Math.random() * games.length)];
      items.push(`
        <span class="mx-4 text-white">•</span> ${name.toUpperCase()} JUST WON ₹${amount.toLocaleString('en-IN')} ON ${game.toUpperCase()}
      `);
    }

    // Duplicate for seamless loop
    const html = items.join('') + items.join('');
    return html;
  }

  const tickerContent = document.getElementById('tickerContent');
  if (tickerContent) {
    tickerContent.innerHTML = generateTickerContent();
  }

  // ─── Auth Modal ───
  const authModal = document.getElementById('authModal');
  const modalClose = document.getElementById('modalClose');
  const signInBtn = document.getElementById('signInBtn');
  const signUpBtn = document.getElementById('signUpBtn');
  const ctaSignUp = document.getElementById('ctaSignUp');
  const tabSignIn = document.getElementById('tabSignIn');
  const tabSignUp = document.getElementById('tabSignUp');
  const signInForm = document.getElementById('signInForm');
  const signUpForm = document.getElementById('signUpForm');
  const switchToSignUp = document.getElementById('switchToSignUp');
  const switchToSignIn = document.getElementById('switchToSignIn');

  function openModal(tab = 'signin') {
    authModal.classList.add('show');
    document.body.style.overflow = 'hidden';
    showTab(tab);
  }

  function closeModal() {
    authModal.classList.remove('show');
    document.body.style.overflow = '';
  }

  function showTab(tab) {
    if (tab === 'signin') {
      tabSignIn.classList.add('active');
      tabSignUp.classList.remove('active');
      signInForm.style.display = 'block';
      signUpForm.style.display = 'none';
    } else {
      tabSignUp.classList.add('active');
      tabSignIn.classList.remove('active');
      signUpForm.style.display = 'block';
      signInForm.style.display = 'none';
    }
  }

  if (signInBtn) signInBtn.addEventListener('click', () => openModal('signin'));
  if (signUpBtn) signUpBtn.addEventListener('click', () => openModal('signup'));
  if (ctaSignUp) ctaSignUp.addEventListener('click', () => openModal('signup'));
  if (modalClose) modalClose.addEventListener('click', closeModal);
  if (tabSignIn) tabSignIn.addEventListener('click', () => showTab('signin'));
  if (tabSignUp) tabSignUp.addEventListener('click', () => showTab('signup'));
  if (switchToSignUp) switchToSignUp.addEventListener('click', (e) => { e.preventDefault(); showTab('signup'); });
  if (switchToSignIn) switchToSignIn.addEventListener('click', (e) => { e.preventDefault(); showTab('signin'); });

  // Close on overlay click
  if (authModal) {
    authModal.addEventListener('click', (e) => {
      if (e.target === authModal) closeModal();
    });
  }

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  // Form submissions (placeholder)
  if (signInForm) {
    signInForm.addEventListener('submit', (e) => {
      e.preventDefault();
      // In the future: actual auth
      window.location.href = '/game';
    });
  }

  if (signUpForm) {
    signUpForm.addEventListener('submit', (e) => {
      e.preventDefault();
      // In the future: actual auth
      window.location.href = '/game';
    });
  }

  // ─── Smooth scroll for nav links ───
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
      const target = document.querySelector(link.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

})();
