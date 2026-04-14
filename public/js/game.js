/* ═══════════════════════════════════════════════
   WINGO Color Trading — Client Game Logic
   ═══════════════════════════════════════════════ */

(function () {
  'use strict';

  // ─── State ───
  const state = {
    socket: null,
    balance: 0,
    selectedBet: null,     // { type: 'color'|'number'|'size', value: ... }
    selectedAmount: 1000,
    currentRound: null,
    config: {},
    myBets: [],            // current round bets
    myBetHistory: [],      // all-time bet results (this session)
  };

  // ─── DOM Elements ───
  const el = {
    balanceAmount: document.getElementById('balanceAmount'),
    balanceCard: document.getElementById('balanceCard'),
    periodNumber: document.getElementById('periodNumber'),
    timerProgress: document.getElementById('timerProgress'),
    timerPhase: document.getElementById('timerPhase'),
    timerDigits: document.getElementById('timerDigits'),
    timerSub: document.getElementById('timerSub'),
    stripBalls: document.getElementById('stripBalls'),
    bettingSection: document.getElementById('bettingSection'),
    placeBetBtn: document.getElementById('placeBetBtn'),
    betBtnText: document.querySelector('.bet-btn-text'),
    customAmount: document.getElementById('customAmount'),
    activeBetsSection: document.getElementById('activeBetsSection'),
    activeBetsList: document.getElementById('activeBetsList'),
    historyBody: document.getElementById('historyBody'),
    myBetsList: document.getElementById('myBetsList'),
    resultOverlay: document.getElementById('resultOverlay'),
    resultBall: document.getElementById('resultBall'),
    resultNumber: document.getElementById('resultNumber'),
    resultColors: document.getElementById('resultColors'),
    resultSize: document.getElementById('resultSize'),
    resultOutcome: document.getElementById('resultOutcome'),
    resultPeriod: document.getElementById('resultPeriod'),
    toastContainer: document.getElementById('toastContainer'),
    bgParticles: document.getElementById('bgParticles'),
  };

  // ─── Number to Color Map (client mirror) ───
  const NUMBER_COLOR_MAP = {
    0: ['red', 'violet'],
    1: ['green'],
    2: ['red'],
    3: ['green'],
    4: ['red'],
    5: ['green', 'violet'],
    6: ['red'],
    7: ['green'],
    8: ['red'],
    9: ['green'],
  };

  // ─── Initialize ───
  function init() {
    createParticles();
    connectSocket();
    setupEventListeners();
  }

  // ─── Background Particles ───
  function createParticles() {
    const colors = ['var(--green)', 'var(--red)', 'var(--violet)', 'var(--gold)'];
    for (let i = 0; i < 20; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle';
      const size = Math.random() * 4 + 2;
      particle.style.cssText = `
        width: ${size}px;
        height: ${size}px;
        left: ${Math.random() * 100}%;
        background: ${colors[Math.floor(Math.random() * colors.length)]};
        animation-duration: ${Math.random() * 15 + 10}s;
        animation-delay: ${Math.random() * 10}s;
      `;
      el.bgParticles.appendChild(particle);
    }
  }

  // ─── Socket Connection ───
  function connectSocket() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (!token) {
      document.body.innerHTML = '<h2 style="color:white; text-align:center; margin-top:50px;">Unauthorized: No Token</h2>';
      return;
    }

    state.socket = io({
      auth: { token }
    });

    state.socket.on('connect_error', (err) => {
      console.log('Connection error:', err.message);
      showToast('Authentication failed. Please login again.', 'error');
    });

    state.socket.on('connect', () => {
      console.log('🔌 Connected to WINGO server');
    });

    state.socket.on('disconnect', () => {
      console.log('❌ Disconnected');
      showToast('Connection lost. Reconnecting...', 'warning');
    });

    // Initial state
    state.socket.on('init', (data) => {
      state.balance = data.balance;
      state.config = data.config;
      state.currentRound = data.roundState;
      updateBalance();
      updateRoundDisplay();
      renderHistory(data.history);
      renderStrip(data.history);
    });

    // Timer tick
    state.socket.on('round:tick', (data) => {
      state.currentRound.timeLeft = data.timeLeft;
      state.currentRound.phase = data.phase;
      updateTimerDisplay(data.timeLeft, data.phase);
    });

    // New round state
    state.socket.on('round:state', (data) => {
      state.currentRound = data;
      state.myBets = [];
      updateRoundDisplay();
      updateActiveBets();
      el.resultOverlay.classList.remove('show');
    });

    // Phase change
    state.socket.on('round:phase', (data) => {
      state.currentRound.phase = data.phase;
      state.currentRound.timeLeft = data.timeLeft;
      updatePhaseDisplay(data.phase);

      if (data.phase === 'locked') {
        showToast('⏳ Betting locked!', 'info');
      }
    });

    // Round result
    state.socket.on('round:result', (data) => {
      state.currentRound.phase = 'result';
      state.currentRound.result = data.result;
      showResult(data);
      renderHistory(data.history);
      renderStrip(data.history);
    });

    // Bet response
    state.socket.on('bet:response', (data) => {
      if (data.success) {
        state.balance = data.newBalance;
        updateBalance();
        state.myBets.push(data.bet);
        updateActiveBets();
        showToast(`✅ Bet placed: ${formatBet(data.bet)}`, 'success');
        clearSelection();
      } else {
        showToast(`❌ ${data.message}`, 'error');
      }
    });

    // Personal bet result
    state.socket.on('bet:result', (data) => {
      state.balance = data.newBalance;
      updateBalance(data.won);

      state.myBetHistory.unshift(data);
      if (state.myBetHistory.length > 20) state.myBetHistory.pop();
      renderMyBets();
    });
  }

  // ─── Event Listeners ───
  function setupEventListeners() {
    // Color buttons
    document.querySelectorAll('.color-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const color = btn.dataset.color;
        selectBet('color', color);
        setActiveBtn('.color-btn', btn);
        clearActive('.number-btn');
        clearActive('.size-btn');
      });
    });

    // Number buttons
    document.querySelectorAll('.number-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const num = parseInt(btn.dataset.number);
        selectBet('number', num);
        setActiveBtn('.number-btn', btn);
        clearActive('.color-btn');
        clearActive('.size-btn');
      });
    });

    // Size buttons
    document.querySelectorAll('.size-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const size = btn.dataset.size;
        selectBet('size', size);
        setActiveBtn('.size-btn', btn);
        clearActive('.color-btn');
        clearActive('.number-btn');
      });
    });

    // Amount buttons
    document.querySelectorAll('.amount-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const amount = parseInt(btn.dataset.amount);
        state.selectedAmount = amount;
        setActiveBtn('.amount-btn', btn);
        el.customAmount.value = '';
        updateBetButton();
      });
    });

    // Custom amount
    el.customAmount.addEventListener('input', () => {
      const val = parseInt(el.customAmount.value);
      if (val && val >= 10) {
        state.selectedAmount = Math.min(val, 100000);
        clearActive('.amount-btn');
        updateBetButton();
      }
    });

    // Place bet
    el.placeBetBtn.addEventListener('click', () => {
      if (!state.selectedBet) return;
      if (!state.currentRound || state.currentRound.phase !== 'betting') {
        showToast('⏳ Wait for the next round', 'warning');
        return;
      }

      state.socket.emit('bet:place', {
        betType: state.selectedBet.type,
        betValue: state.selectedBet.value,
        amount: state.selectedAmount,
      });
    });
  }

  // ─── Selection Helpers ───
  function selectBet(type, value) {
    state.selectedBet = { type, value };
    updateBetButton();
  }

  function clearSelection() {
    state.selectedBet = null;
    clearActive('.color-btn');
    clearActive('.number-btn');
    clearActive('.size-btn');
    updateBetButton();
  }

  function setActiveBtn(selector, activeBtn) {
    document.querySelectorAll(selector).forEach(b => b.classList.remove('active'));
    activeBtn.classList.add('active');
  }

  function clearActive(selector) {
    document.querySelectorAll(selector).forEach(b => b.classList.remove('active'));
  }

  // ─── UI Updates ───
  function updateBalance(animate = false) {
    el.balanceAmount.textContent = `₹${state.balance.toLocaleString('en-IN')}`;
    if (animate) {
      el.balanceCard.classList.remove('pulse');
      void el.balanceCard.offsetWidth; // trigger reflow
      el.balanceCard.classList.add('pulse');
    }
  }

  function updateRoundDisplay() {
    if (!state.currentRound) return;
    el.periodNumber.textContent = state.currentRound.period || '---';
    updateTimerDisplay(state.currentRound.timeLeft, state.currentRound.phase);
    updatePhaseDisplay(state.currentRound.phase);
  }

  function updateTimerDisplay(timeLeft, phase) {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    el.timerDigits.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    // Update circular progress
    const totalDuration = state.config.roundDuration || 60;
    const progress = timeLeft / totalDuration;
    const circumference = 2 * Math.PI * 88; // r=88
    const offset = circumference * (1 - progress);
    el.timerProgress.style.strokeDasharray = circumference;
    el.timerProgress.style.strokeDashoffset = offset;

    // Color transitions
    el.timerProgress.classList.remove('locked', 'result');
    if (phase === 'locked') el.timerProgress.classList.add('locked');
    if (phase === 'result') el.timerProgress.classList.add('result');
  }

  function updatePhaseDisplay(phase) {
    el.timerPhase.className = 'timer-phase';
    el.bettingSection.classList.remove('disabled');

    switch (phase) {
      case 'betting':
        el.timerPhase.textContent = 'BETTING';
        el.timerPhase.classList.add('betting');
        el.timerSub.textContent = 'Place your bets';
        break;
      case 'locked':
        el.timerPhase.textContent = 'LOCKED';
        el.timerPhase.classList.add('locked');
        el.timerSub.textContent = 'No more bets';
        el.bettingSection.classList.add('disabled');
        break;
      case 'result':
        el.timerPhase.textContent = 'RESULT';
        el.timerPhase.classList.add('result');
        el.timerSub.textContent = 'Drawing...';
        el.bettingSection.classList.add('disabled');
        break;
    }
  }

  function updateBetButton() {
    if (!state.selectedBet) {
      el.placeBetBtn.disabled = true;
      el.betBtnText.textContent = 'Select a color or number';
      return;
    }
    el.placeBetBtn.disabled = false;
    const betLabel = formatBetLabel(state.selectedBet);
    el.betBtnText.textContent = `Place ₹${state.selectedAmount.toLocaleString('en-IN')} on ${betLabel}`;
  }

  function formatBetLabel(bet) {
    if (bet.type === 'color') return bet.value.charAt(0).toUpperCase() + bet.value.slice(1);
    if (bet.type === 'number') return `Number ${bet.value}`;
    if (bet.type === 'size') return bet.value.charAt(0).toUpperCase() + bet.value.slice(1);
    return '';
  }

  function formatBet(bet) {
    const label = bet.betType === 'color' ? bet.betValue
      : bet.betType === 'number' ? `#${bet.betValue}`
      : bet.betValue;
    return `${label} — ₹${bet.amount.toLocaleString('en-IN')}`;
  }

  // ─── Active Bets ───
  function updateActiveBets() {
    if (state.myBets.length === 0) {
      el.activeBetsSection.style.display = 'none';
      return;
    }
    el.activeBetsSection.style.display = 'block';
    el.activeBetsList.innerHTML = state.myBets.map(bet => {
      const dotClass = bet.betType === 'number' ? 'number' : bet.betType === 'size' ? 'size' : bet.betValue;
      const label = bet.betType === 'color' ? bet.betValue
        : bet.betType === 'number' ? `Number ${bet.betValue}`
        : bet.betValue;
      return `
        <div class="active-bet-item">
          <div class="bet-item-left">
            <div class="bet-item-dot ${dotClass}"></div>
            <span class="bet-item-type">${label}</span>
          </div>
          <span class="bet-item-amount">₹${bet.amount.toLocaleString('en-IN')}</span>
        </div>
      `;
    }).join('');
  }

  // ─── Results Strip ───
  function renderStrip(history) {
    if (!history || history.length === 0) {
      el.stripBalls.innerHTML = '<span style="color: var(--text-muted); font-size: 12px;">Waiting for results...</span>';
      return;
    }
    el.stripBalls.innerHTML = history.slice(0, 10).map(h => {
      const colorClass = getColorClass(h.colors);
      return `<div class="strip-ball ${colorClass}">${h.number}</div>`;
    }).join('');
  }

  function getColorClass(colors) {
    if (colors.length === 2) {
      if (colors.includes('red') && colors.includes('violet')) return 'red-violet';
      if (colors.includes('green') && colors.includes('violet')) return 'green-violet';
    }
    return colors[0];
  }

  // ─── History Table ───
  function renderHistory(history) {
    if (!history || history.length === 0) {
      el.historyBody.innerHTML = '<tr><td colspan="4" style="text-align:center; color: var(--text-muted); padding:20px;">No rounds yet</td></tr>';
      return;
    }
    el.historyBody.innerHTML = history.map(h => {
      const colorBadges = h.colors.map(c => `<span class="color-badge ${c}">${c}</span>`).join('');
      const numColor = h.colors[0];
      return `
        <tr>
          <td class="td-period">${h.period}</td>
          <td class="td-number" style="color: var(--${numColor})">${h.number}</td>
          <td><div class="td-color-badges">${colorBadges}</div></td>
          <td><span class="size-badge">${h.size}</span></td>
        </tr>
      `;
    }).join('');
  }

  // ─── My Bets History ───
  function renderMyBets() {
    if (state.myBetHistory.length === 0) {
      el.myBetsList.innerHTML = '<div class="empty-state">No bets placed yet. Start playing!</div>';
      return;
    }
    el.myBetsList.innerHTML = state.myBetHistory.map(bet => {
      const label = bet.betType === 'color' ? bet.betValue
        : bet.betType === 'number' ? `Number ${bet.betValue}`
        : bet.betValue;
      const winClass = bet.won ? 'won' : 'lost';
      const payoutText = bet.won ? `+₹${bet.payout.toLocaleString('en-IN')}` : `-₹${bet.amount.toLocaleString('en-IN')}`;
      return `
        <div class="my-bet-item">
          <div class="my-bet-info">
            <span class="my-bet-period">${bet.period}</span>
            <span class="my-bet-detail">${label}</span>
          </div>
          <div class="my-bet-result">
            <span class="my-bet-amount">₹${bet.amount.toLocaleString('en-IN')}</span>
            <div class="my-bet-payout ${winClass}">${payoutText}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  // ─── Result Modal ───
  function showResult(data) {
    const { result, period } = data;
    const colorClass = getColorClass(result.colors);

    // Ball
    el.resultBall.className = `result-ball ${colorClass}`;
    el.resultNumber.textContent = result.number;

    // Colors
    el.resultColors.innerHTML = result.colors.map(c =>
      `<span class="color-badge ${c}">${c}</span>`
    ).join('');

    // Size
    el.resultSize.textContent = result.size.toUpperCase();

    // Period
    el.resultPeriod.textContent = `Period: ${period}`;

    // Outcome (check if player had bets)
    if (state.myBets.length > 0) {
      el.resultOutcome.textContent = '⏳ Checking...';
      el.resultOutcome.className = 'result-outcome';
    } else {
      el.resultOutcome.textContent = 'No bet placed';
      el.resultOutcome.className = 'result-outcome lost';
    }

    // Show modal
    el.resultOverlay.classList.add('show');

    // Auto-hide after 4s
    setTimeout(() => {
      el.resultOverlay.classList.remove('show');
    }, 4000);
  }

  // Update outcome when personal result arrives
  const originalBetResult = state.socket;
  // We handle this in the socket listener above, but also update the modal:
  function updateResultOutcome(betResult) {
    if (el.resultOverlay.classList.contains('show')) {
      if (betResult.won) {
        el.resultOutcome.textContent = `🎉 Won ₹${betResult.payout.toLocaleString('en-IN')}!`;
        el.resultOutcome.className = 'result-outcome won';
      } else {
        el.resultOutcome.textContent = `😔 Lost ₹${betResult.amount.toLocaleString('en-IN')}`;
        el.resultOutcome.className = 'result-outcome lost';
      }
    }
  }

  // Patch the socket listener to also update modal
  // We do this after connectSocket — so let's restructure slightly
  // Actually let's add it to the init flow by monkey-patching.

  const _origInit = init;

  // ─── Toast Notifications ───
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    el.toastContainer.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 3000);
  }

  // ─── Sound Effects (Web Audio API) ───
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  let audioCtx;

  function playSound(type) {
    try {
      if (!audioCtx) audioCtx = new AudioCtx();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      gain.gain.value = 0.08;

      switch (type) {
        case 'bet':
          osc.frequency.value = 600;
          osc.type = 'sine';
          gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
          osc.start();
          osc.stop(audioCtx.currentTime + 0.15);
          break;
        case 'win':
          osc.frequency.value = 800;
          osc.type = 'sine';
          gain.gain.value = 0.1;
          gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
          osc.start();
          osc.stop(audioCtx.currentTime + 0.4);
          // Second note
          setTimeout(() => {
            const osc2 = audioCtx.createOscillator();
            const gain2 = audioCtx.createGain();
            osc2.connect(gain2);
            gain2.connect(audioCtx.destination);
            osc2.frequency.value = 1200;
            osc2.type = 'sine';
            gain2.gain.value = 0.1;
            gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
            osc2.start();
            osc2.stop(audioCtx.currentTime + 0.3);
          }, 150);
          break;
        case 'lose':
          osc.frequency.value = 300;
          osc.type = 'sine';
          gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
          osc.start();
          osc.stop(audioCtx.currentTime + 0.3);
          break;
        case 'tick':
          osc.frequency.value = 1000;
          osc.type = 'sine';
          gain.gain.value = 0.03;
          gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
          osc.start();
          osc.stop(audioCtx.currentTime + 0.05);
          break;
      }
    } catch (e) {
      // Audio not available, silently fail
    }
  }

  // ─── Enhanced Socket — with sound & modal updates ───
  function connectSocketEnhanced() {
    connectSocket();

    // Override bet:result handler with sound + modal
    state.socket.off('bet:result');
    state.socket.on('bet:result', (data) => {
      state.balance = data.newBalance;
      updateBalance(true);

      state.myBetHistory.unshift(data);
      if (state.myBetHistory.length > 20) state.myBetHistory.pop();
      renderMyBets();

      // Update result modal
      updateResultOutcome(data);

      // Sound
      if (data.won) {
        playSound('win');
        showToast(`🎉 You won ₹${data.payout.toLocaleString('en-IN')}!`, 'success');
      } else {
        playSound('lose');
      }
    });

    // Add sound to bet response
    const originalBetResponse = state.socket.listeners('bet:response');
    state.socket.off('bet:response');
    state.socket.on('bet:response', (data) => {
      if (data.success) {
        state.balance = data.newBalance;
        updateBalance();
        state.myBets.push(data.bet);
        updateActiveBets();
        showToast(`✅ Bet placed: ${formatBet(data.bet)}`, 'success');
        clearSelection();
        playSound('bet');
      } else {
        showToast(`❌ ${data.message}`, 'error');
      }
    });

    // Tick sound for last 5 seconds
    state.socket.off('round:tick');
    state.socket.on('round:tick', (data) => {
      state.currentRound.timeLeft = data.timeLeft;
      state.currentRound.phase = data.phase;
      updateTimerDisplay(data.timeLeft, data.phase);

      if (data.timeLeft <= 5 && data.phase === 'locked') {
        playSound('tick');
      }
    });
  }

  // ─── Boot ───
  function boot() {
    createParticles();
    connectSocketEnhanced();
    setupEventListeners();
  }

  // Go!
  document.addEventListener('DOMContentLoaded', boot);

})();
