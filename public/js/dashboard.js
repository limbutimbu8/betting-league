/* ═══════════════════════════════════════════════
   Betting League — Dashboard Interactions
   ═══════════════════════════════════════════════ */

   (function () {
    'use strict';
  
    const navLinks = document.querySelectorAll('.nav-link');
    const panels = document.querySelectorAll('.dash-panel');
    const wTabs = document.querySelectorAll('.w-tab');
    const wViews = document.querySelectorAll('.wallet-view');
    
    // Auth Check
    const token = localStorage.getItem('auth_token');
    if (!token) {
      window.location.href = '/auth';
      return;
    }

    // Tab Switching Logic
    function switchTab(tabId) {
      navLinks.forEach(link => {
        if (link.dataset.tab === tabId) link.classList.add('active');
        else link.classList.remove('active');
      });
      panels.forEach(panel => {
        if (panel.id === tabId) panel.classList.add('active');
        else panel.classList.remove('active');
      });
      window.location.hash = tabId.replace('tab-', '');
      
      if (tabId === 'tab-transactions') {
        loadTransactions();
      }
    }
  
    navLinks.forEach(link => {
      link.addEventListener('click', () => switchTab(link.dataset.tab));
    });
  
    wTabs.forEach(link => {
      link.addEventListener('click', () => {
        wTabs.forEach(t => t.classList.remove('active'));
        wViews.forEach(v => { v.classList.remove('active'); v.style.display = 'none'; });
        link.classList.add('active');
        const viewId = link.id === 'wTabDeposit' ? 'viewDeposit' : 'viewWithdraw';
        const view = document.getElementById(viewId);
        view.classList.add('active');
        view.style.display = 'block';
      });
    });
  
    function checkHash() {
      const hash = window.location.hash.substring(1);
      const validTabs = ['home', 'game', 'wallet', 'transactions', 'contact', 'settings'];
      if (validTabs.includes(hash)) switchTab('tab-' + hash);
      else switchTab('tab-home');
    }
  
    window.addEventListener('hashchange', checkHash);
    
    function openGame() {
      window.location.href = '/game?token=' + token;
    }

    function closeGame() {
      // not needed inside dashboard if redirected
    }

    // --- API Interactions ---
    async function fetchUser() {
      try {
        const res = await fetch('/api/me', { headers: { 'Authorization': 'Bearer ' + token } });
        const data = await res.json();
        if (data.success) {
          const balText = `₹${data.user.balance.toFixed(2)}`;
          
          if (document.getElementById('uiBalance')) document.getElementById('uiBalance').innerText = balText;
          if (document.getElementById('uiBalanceWallet')) document.getElementById('uiBalanceWallet').innerText = balText;
          
          // Legacy balance updates if they exist (from older HTML designs)
          const balEls = document.querySelectorAll('.bc-amount, .wbb-amount');
          balEls.forEach(el => {
            el.innerHTML = `${balText} <svg class="cc-icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>`;
          });

          // Update Stats
          if (document.getElementById('uiTotalBets')) {
            document.getElementById('uiTotalBets').innerText = data.user.totalBets || 0;
          }
          if (document.getElementById('uiTotalProfit')) {
            document.getElementById('uiTotalProfit').innerText = `₹${(data.user.totalProfit || 0).toFixed(2)}`;
          }
          if (document.getElementById('uiTotalLoss')) {
            document.getElementById('uiTotalLoss').innerText = `₹${(data.user.totalLoss || 0).toFixed(2)}`;
          }
          if (document.getElementById('uiWinRate')) {
            const bets = data.user.totalBets || 0;
            const wins = data.user.totalWins || 0;
            const winRate = bets > 0 ? Math.round((wins / bets) * 100) : 0;
            document.getElementById('uiWinRate').innerText = `${winRate}%`;
          }

        } else {
          localStorage.removeItem('auth_token');
          window.location.href = '/auth';
        }
      } catch(e) {}
    }

    async function loadTransactions() {
      const list = document.getElementById('transactionList');
      list.innerHTML = `<div style="text-align:center; padding: 20px;">Loading...</div>`;
      try {
        const res = await fetch('/api/wallet/transactions', { headers: { 'Authorization': 'Bearer ' + token } });
        const data = await res.json();
        if (data.success && data.transactions.length > 0) {
          list.innerHTML = data.transactions.map(tx => {
            const isDep = tx.type === 'deposit';
            const iconStr = isDep ? '<line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>' : '<line x1="5" y1="12" x2="19" y2="12"></line>';
            const colorClass = isDep ? 'tx-plus' : 'tx-minus';
            const sign = isDep ? '+' : '-';
            
            // Status bubble logic
            let stColor = '#f59e0b';
            if(tx.status === 'approved') stColor = '#10b981';
            if(tx.status === 'rejected') stColor = '#ef4444';
            
            const dateStr = new Date(tx.createdAt).toLocaleString();

            return `
            <div class="tx-item" style="border-left: 4px solid ${stColor};">
              <div class="tx-icon">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">${iconStr}</svg>
              </div>
              <div class="tx-details">
                <span class="tx-title">${isDep ? 'Deposit' : 'Withdraw'} <span style="font-size:10px; color:${stColor}; border:1px solid ${stColor}; border-radius:4px; padding:1px 4px; margin-left:6px;">${tx.status.toUpperCase()}</span></span>
                <span class="tx-date">${dateStr}</span>
              </div>
              <div class="tx-amount ${colorClass}">${sign}₹${tx.amount.toFixed(2)}</div>
            </div>`;
          }).join('');
        } else {
          list.innerHTML = `<div style="text-align:center; padding: 40px; color:var(--text-muted);">No transactions yet.</div>`;
        }
      } catch(e) {
        list.innerHTML = `<div style="text-align:center; padding: 20px; color:red;">Failed to load</div>`;
      }
    }

    window.submitDeposit = async function() {
      const amt = document.getElementById('dep_amt').value;
      const utr = document.getElementById('dep_utr').value;
      if (!amt || !utr) return alert('Fill all fields');
      
      const res = await fetch('/api/wallet/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ amount: Number(amt), transactionId: utr })
      });
      const data = await res.json();
      if(data.success) {
        alert('Deposit Request Submitted!');
        document.getElementById('dep_amt').value = '';
        document.getElementById('dep_utr').value = '';
        switchTab('tab-transactions');
      } else alert(data.message);
    }

    window.submitWithdraw = async function() {
      const amt = document.getElementById('wit_amt').value;
      const bank = document.getElementById('wit_bank').value;
      if (!amt || !bank) return alert('Fill all fields');
      
      const res = await fetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ amount: Number(amt), bankDetails: bank })
      });
      const data = await res.json();
      if(data.success) {
        alert('Withdraw Request Submitted!');
        document.getElementById('wit_amt').value = '';
        document.getElementById('wit_bank').value = '';
        fetchUser(); // reload balance immediately
        switchTab('tab-transactions');
      } else alert(data.message);
    }

    async function fetchSettings() {
      try {
        const res = await fetch('/api/settings', { headers: { 'Authorization': 'Bearer ' + token } });
        const data = await res.json();
        if(data.success && data.settings) {
          const qrImage = document.getElementById('qrCodeImage');
          const upiLabel = document.getElementById('upiIdDisplay');
          if(qrImage && data.settings.upiId) qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?data=upi://pay?pa=${data.settings.upiId}&pn=Prediction%20Club&size=200x200`;
          if(upiLabel && data.settings.upiId) upiLabel.textContent = `UPI: ${data.settings.upiId}`;
          
          const waLink = document.getElementById('supportWhatsapp');
          if (waLink && data.settings.whatsapp) {
            // Remove + from number, create wa.me link
            const waNum = data.settings.whatsapp.replace(/\+/g, '');
            waLink.href = `https://wa.me/${waNum}`;
          }
          
          const tgLink = document.getElementById('supportTelegram');
          if (tgLink && data.settings.telegram) {
            tgLink.href = data.settings.telegram;
          }
        }
      } catch(e) {}
    }

    // Change Password
    window.changePassword = async function() {
      const currentPassword = document.getElementById('currentPassword').value;
      const newPassword = document.getElementById('newPassword').value;
      const confirmNewPassword = document.getElementById('confirmNewPassword').value;
      
      if (!currentPassword || !newPassword || !confirmNewPassword) return alert('Please fill all fields');
      if (newPassword !== confirmNewPassword) return alert('New passwords do not match');
      if (newPassword.length < 4) return alert('Password must be at least 4 characters');
      
      try {
        const res = await fetch('/api/user/change-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
          body: JSON.stringify({ currentPassword, newPassword })
        });
        const data = await res.json();
        alert(data.message);
        if (data.success) {
          document.getElementById('currentPassword').value = '';
          document.getElementById('newPassword').value = '';
          document.getElementById('confirmNewPassword').value = '';
        }
      } catch(e) {
        alert('Error changing password');
      }
    }

    // Logout
    window.logoutUser = function() {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      window.location.href = '/auth';
    }

    window.dashboard = { switchTab, openGame, closeGame };
  
    // Init loads
    checkHash();
    fetchUser();
    fetchSettings();
  
  })();
