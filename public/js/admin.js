(async function() {
  const token = localStorage.getItem('auth_token');
  const userStr = localStorage.getItem('auth_user');
  if (!token || !userStr) { window.location.href = '/auth'; return; }
  
  const user = JSON.parse(userStr);
  if (user.role !== 'admin') {
    alert('Unauthorized');
    window.location.href = '/dashboard';
    return;
  }

  // Bind tabs
  const tabs = document.querySelectorAll('.admin-tab');
  const contents = document.querySelectorAll('.admin-content');
  tabs.forEach(t => t.addEventListener('click', () => {
    tabs.forEach(tt => tt.classList.remove('active'));
    contents.forEach(cc => cc.style.display = 'none');
    t.classList.add('active');
    document.getElementById(t.dataset.target).style.display = 'block';
  }));

  // Fetch Dashboard Stats
  async function loadStats() {
    try {
      const res = await fetch('/api/admin/stats', { headers: { 'Authorization': 'Bearer ' + token } });
      const data = await res.json();
      if(data.success) {
        document.getElementById('statUsers').innerText = data.stats.usersCount;
        document.getElementById('statDep').innerText = '₹' + data.stats.totalDeposits.toLocaleString('en-IN');
        document.getElementById('statWith').innerText = '₹' + data.stats.totalWithdrawals.toLocaleString('en-IN');
        document.getElementById('statProf').innerText = '₹' + data.stats.siteProfit.toLocaleString('en-IN');
      }
    } catch(e) {}
  }

  // Fetch W&T Requests
  async function loadRequests() {
    try {
      const list = document.getElementById('reqList');
      list.innerHTML = 'Loading...';
      const res = await fetch('/api/admin/transactions', { headers: { 'Authorization': 'Bearer ' + token } });
      const data = await res.json();
      if(data.success) {
        const pending = data.transactions.filter(t => t.status === 'pending');
        if (pending.length === 0) {
          list.innerHTML = '<div style="padding:20px; text-align:center;">No pending requests</div>';
          return;
        }
        list.innerHTML = pending.map(t => {
          return `
          <div style="background:#1e293b; padding:16px; border-radius:8px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <span style="font-weight:bold; color: #38bdf8;">${t.type.toUpperCase()}</span>
              <span style="margin: 0 10px;">•</span>
              <span>User: <strong style="color:white;">${t.userId.username}</strong></span>
              <span style="margin: 0 10px;">•</span>
              <span>Amount: <strong style="color:#4ade80;">₹${t.amount}</strong></span>
              <div style="font-size:12px; color:#94a3b8; margin-top:6px;">
                ${t.type === 'deposit' ? 'UTR: ' + t.transactionId : 'Bank/UPI: ' + t.bankDetails} | ${new Date(t.createdAt).toLocaleString()}
              </div>
            </div>
            <div style="display:flex; gap:10px;">
              <button onclick="decide('${t._id}', 'approve')" style="background:#10b981; color:white; border:none; padding:8px 16px; border-radius:4px; cursor:pointer;">Approve</button>
              <button onclick="decide('${t._id}', 'reject')" style="background:#ef4444; color:white; border:none; padding:8px 16px; border-radius:4px; cursor:pointer;">Reject</button>
            </div>
          </div>
          `;
        }).join('');
      }
    } catch(e) {}
  }

  // Decide Action
  window.decide = async function(id, action) {
    if(!confirm(`Are you sure you want to ${action} this request?`)) return;
    try {
      const res = await fetch('/api/admin/transaction/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ txId: id, action })
      });
      const data = await res.json();
      alert(data.message);
      if(data.success) {
        loadStats();
        loadRequests();
      }
    } catch(e) {}
  }

  // Fetch Users
  async function loadUsers() {
    try {
      const list = document.getElementById('usersList');
      list.innerHTML = 'Loading...';
      const res = await fetch('/api/admin/users', { headers: { 'Authorization': 'Bearer ' + token } });
      const data = await res.json();
      if(data.success) {
        if (data.users.length === 0) {
          list.innerHTML = '<div style="padding:20px; text-align:center;">No users found</div>';
          return;
        }
        list.innerHTML = data.users.map(u => {
          return `
          <div style="background:#1e293b; padding:16px; border-radius:8px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <span style="font-weight:bold; color:white; font-size:18px;">${u.username}</span>
              ${u.isBanned ? '<span style="background:var(--danger); color:white; padding:2px 6px; border-radius:4px; font-size:10px; margin-left:10px; vertical-align:middle;">BANNED</span>' : ''}
              <div style="font-size:14px; color:#94a3b8; margin-top:6px;">
                Balance: <strong style="color:#4ade80;">₹${u.balance}</strong>
              </div>
            </div>
            <div>
              ${u.isBanned 
                ? `<button onclick="toggleBanUser('${u._id}', false)" style="background:var(--success); color:white; border:none; padding:8px 16px; border-radius:4px; cursor:pointer;">Unban</button>`
                : `<button onclick="toggleBanUser('${u._id}', true)" style="background:var(--danger); color:white; border:none; padding:8px 16px; border-radius:4px; cursor:pointer;">Ban</button>`
              }
            </div>
          </div>
          `;
        }).join('');
      }
    } catch(e) {}
  }

  // Toggle Ban Action
  window.toggleBanUser = async function(id, isBanned) {
    if(!confirm(`Are you sure you want to ${isBanned ? 'BAN' : 'UNBAN'} this user?`)) return;
    try {
      const res = await fetch('/api/admin/user/ban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ userId: id, isBanned })
      });
      const data = await res.json();
      alert(data.message);
      if(data.success) {
        loadUsers();
      }
    } catch(e) {}
  }

  // Fetch Settings
  async function loadSettings() {
    try {
      const res = await fetch('/api/settings', { headers: { 'Authorization': 'Bearer ' + token } });
      const data = await res.json();
      if(data.success && data.settings) {
        document.getElementById('adminUpiInput').value = data.settings.upiId || '';
        document.getElementById('adminWhatsappInput').value = data.settings.whatsapp || '';
        document.getElementById('adminTelegramInput').value = data.settings.telegram || '';
      }
    } catch(e) {}
  }

  // Save Settings
  window.saveSettings = async function() {
    const upiId = document.getElementById('adminUpiInput').value;
    const whatsapp = document.getElementById('adminWhatsappInput').value;
    const telegram = document.getElementById('adminTelegramInput').value;
    
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ upiId, whatsapp, telegram })
      });
      const data = await res.json();
      alert(data.message);
    } catch(e) {
      alert('Error saving settings');
    }
  }

  // Admin Key File content (stored after verify)
  let verifiedKeyContent = null;

  window.verifyAdminKey = async function() {
    const fileInput = document.getElementById('adminKeyFile');
    const statusEl = document.getElementById('keyStatus');
    
    if (!fileInput.files || fileInput.files.length === 0) {
      statusEl.innerHTML = '<span style="color:#ef4444;">❌ No file selected</span>';
      return;
    }
    
    const file = fileInput.files[0];
    const reader = new FileReader();
    
    reader.onload = async function(e) {
      const fileContent = e.target.result;
      statusEl.innerHTML = '<span style="color:#94a3b8;">⏳ Verifying key...</span>';
      
      try {
        const res = await fetch('/api/admin/verify-key', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
          body: JSON.stringify({ fileContent })
        });
        const data = await res.json();
        
        if (data.verified) {
          verifiedKeyContent = fileContent;
          statusEl.innerHTML = '<span style="color:#10b981;">✅ Key verified successfully!</span>';
          document.getElementById('adminPasswordSection').style.display = 'block';
        } else {
          statusEl.innerHTML = '<span style="color:#ef4444;">❌ Invalid key file — Access Denied</span>';
          document.getElementById('adminPasswordSection').style.display = 'none';
          verifiedKeyContent = null;
        }
      } catch(err) {
        statusEl.innerHTML = '<span style="color:#ef4444;">❌ Verification error</span>';
      }
    };
    
    reader.readAsText(file);
  }

  window.changeAdminPassword = async function() {
    const newPassword = document.getElementById('adminNewPassword').value;
    const confirmPassword = document.getElementById('adminConfirmPassword').value;
    
    if (!newPassword || !confirmPassword) return alert('Fill all fields');
    if (newPassword !== confirmPassword) return alert('Passwords do not match');
    if (!verifiedKeyContent) return alert('Key not verified. Upload the key file first.');
    
    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ fileContent: verifiedKeyContent, newPassword })
      });
      const data = await res.json();
      alert(data.message);
      if (data.success) {
        document.getElementById('adminNewPassword').value = '';
        document.getElementById('adminConfirmPassword').value = '';
        document.getElementById('adminPasswordSection').style.display = 'none';
        document.getElementById('keyStatus').innerHTML = '';
        document.getElementById('adminKeyFile').value = '';
        verifiedKeyContent = null;
      }
    } catch(e) {
      alert('Error changing password');
    }
  }

  // OTP Flow
  let verifiedOtpToken = null;

  window.requestAdminOtp = async function() {
    const btn = document.getElementById('btnRequestOtp');
    const statusEl = document.getElementById('otpRequestStatus');
    
    btn.disabled = true;
    btn.innerText = 'Sending...';
    statusEl.innerHTML = '<span style="color:#94a3b8;">⏳ Sending OTP, please check your email...</span>';
    
    try {
      const res = await fetch('/api/admin/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
      });
      const data = await res.json();
      
      if (data.success) {
        statusEl.innerHTML = `<span style="color:#10b981;">✅ ${data.message}</span>`;
        document.getElementById('adminOtpVerifySection').style.display = 'block';
        btn.innerText = 'OTP Sent';
      } else {
        statusEl.innerHTML = `<span style="color:#ef4444;">❌ ${data.message}</span>`;
        btn.disabled = false;
        btn.innerText = 'Request Email OTP';
      }
    } catch(e) {
      statusEl.innerHTML = '<span style="color:#ef4444;">❌ Failed to request OTP</span>';
      btn.disabled = false;
      btn.innerText = 'Request Email OTP';
    }
  }

  window.verifyAdminOtp = async function() {
    const otp = document.getElementById('adminOtpInput').value.trim();
    const statusEl = document.getElementById('otpVerifyStatus');
    const btn = document.getElementById('btnVerifyOtp');
    
    if (!otp) return alert('Enter the 6-digit OTP');
    
    btn.disabled = true;
    btn.innerText = 'Verifying...';
    
    try {
      const res = await fetch('/api/admin/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ otp })
      });
      const data = await res.json();
      
      if (data.success) {
        verifiedOtpToken = data.otpToken;
        statusEl.innerHTML = '<span style="color:#10b981;">✅ OTP verified successfully!</span>';
        document.getElementById('adminOtpPasswordSection').style.display = 'block';
        btn.innerText = 'Verified';
      } else {
        statusEl.innerHTML = `<span style="color:#ef4444;">❌ ${data.message}</span>`;
        btn.disabled = false;
        btn.innerText = 'Verify OTP';
        verifiedOtpToken = null;
      }
    } catch(e) {
      statusEl.innerHTML = '<span style="color:#ef4444;">❌ Verification error</span>';
      btn.disabled = false;
      btn.innerText = 'Verify OTP';
    }
  }

  window.changeAdminPasswordOtp = async function() {
    const newPassword = document.getElementById('adminOtpNewPassword').value;
    const confirmPassword = document.getElementById('adminOtpConfirmPassword').value;
    
    if (!newPassword || !confirmPassword) return alert('Fill all fields');
    if (newPassword !== confirmPassword) return alert('Passwords do not match');
    if (!verifiedOtpToken) return alert('OTP not verified yet.');
    
    try {
      const res = await fetch('/api/admin/change-password-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ otpToken: verifiedOtpToken, newPassword })
      });
      const data = await res.json();
      alert(data.message);
      
      if (data.success) {
        // Reset everything
        document.getElementById('adminOtpNewPassword').value = '';
        document.getElementById('adminOtpConfirmPassword').value = '';
        document.getElementById('adminOtpInput').value = '';
        document.getElementById('adminOtpPasswordSection').style.display = 'none';
        document.getElementById('adminOtpVerifySection').style.display = 'none';
        document.getElementById('otpVerifyStatus').innerHTML = '';
        document.getElementById('otpRequestStatus').innerHTML = '';
        
        const btnReq = document.getElementById('btnRequestOtp');
        btnReq.disabled = false;
        btnReq.innerText = 'Request Email OTP';
        
        const btnVer = document.getElementById('btnVerifyOtp');
        btnVer.disabled = false;
        btnVer.innerText = 'Verify OTP';
        
        verifiedOtpToken = null;
      }
    } catch(e) {
      alert('Error changing password via OTP');
    }
  }


  // Init
  loadStats();
  loadRequests();
  loadUsers();
  loadSettings();

  // --- Game Control Socket & Override ---
  if (typeof io !== 'undefined') {
    const socket = io({
      auth: { token }
    });

    socket.on('round:state', (state) => {
      document.getElementById('gcPeriod').innerText = `Period: ${state.period || '---'}`;
      updatePhase(state.phase);
    });

    socket.on('round:tick', (data) => {
      let secs = data.timeLeft;
      let min = Math.floor(secs / 60);
      let s = secs % 60;
      document.getElementById('gcTime').innerText = `0${min}:${s < 10 ? '0'+s : s}`;
      updatePhase(data.phase);
    });

    socket.on('round:phase', (data) => {
      updatePhase(data.phase);
      if (data.phase === 'result' || data.phase === 'betting') {
        if (data.phase === 'betting') {
          // Clear live stream on new round
          document.getElementById('liveStreamBox').innerHTML = '<div style="color:#64748b; font-style:italic;">--- New Round Started ---</div>';
        }
      }
    });

    socket.on('admin:pool_update', (pools) => {
      document.getElementById('poolUsers').innerText = pools.totalUsers;
      document.getElementById('poolAmount').innerText = '₹' + pools.totalAmount.toLocaleString('en-IN');
      
      document.getElementById('poolCGreen').innerText = '₹' + pools.color.green.toLocaleString('en-IN');
      document.getElementById('poolCViolet').innerText = '₹' + pools.color.violet.toLocaleString('en-IN');
      document.getElementById('poolCRed').innerText = '₹' + pools.color.red.toLocaleString('en-IN');

      document.getElementById('poolSSmall').innerText = '₹' + pools.size.small.toLocaleString('en-IN');
      document.getElementById('poolSBig').innerText = '₹' + pools.size.big.toLocaleString('en-IN');

      for (let i = 0; i <= 9; i++) {
        document.getElementById('poolN' + i).innerText = '₹' + pools.number[i].toLocaleString('en-IN');
      }
    });

    socket.on('admin:live_bet', (bet) => {
      const box = document.getElementById('liveStreamBox');
      const time = new Date(bet.timestamp).toLocaleTimeString();
      let colorTag = '#94a3b8';
      if (bet.betValue === 'green') colorTag = 'var(--success)';
      if (bet.betValue === 'red') colorTag = 'var(--danger)';
      if (bet.betValue === 'violet') colorTag = 'var(--violet)';
      
      const el = document.createElement('div');
      el.style.marginBottom = '4px';
      el.innerHTML = `<span style="color:#64748b;">[${time}]</span> <strong style="color:white;">${bet.username}</strong> placed <strong style="color:#4ade80;">₹${bet.amount.toLocaleString('en-IN')}</strong> on <span style="color:${colorTag}; text-transform:uppercase; font-weight:bold;">${bet.betValue}</span>`;
      
      box.prepend(el);
      // Keep only last 50
      if (box.children.length > 50) box.removeChild(box.lastChild);
    });

    function updatePhase(phase) {
      const el = document.getElementById('gcPhase');
      if (phase === 'betting') {
        el.innerText = 'Phase: Betting Open (You can override)';
        el.style.color = 'var(--success)';
      } else if (phase === 'locked') {
        el.innerText = 'Phase: Locked (Calculating result...)';
        el.style.color = 'var(--danger)';
      } else if (phase === 'result') {
        el.innerText = 'Phase: Showing Result';
        el.style.color = 'var(--primary)';
      }
    }
  }

  // Set Override function
  window.setOverride = async function(type, value) {
    if(!confirm(`Force the next result to be ${type}: ${value}?`)) return;
    
    try {
      const res = await fetch('/api/admin/game/override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ type, value })
      });
      const data = await res.json();
      alert(data.message);
    } catch(err) {
      alert('Error setting override');
    }
  }

  window.toggleRigging = async function(enabled) {
    try {
      const res = await fetch('/api/admin/game/rigging', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ enabled })
      });
      const data = await res.json();
      const slider = document.getElementById('riggingSlider');
      if (data.isRigged) {
        slider.parentElement.style.backgroundColor = 'var(--success)';
        slider.style.transform = 'translateX(26px)';
      } else {
        slider.parentElement.style.backgroundColor = '#334155';
        slider.style.transform = 'translateX(0)';
      }
    } catch (err) {
      alert('Failed to toggle rigging');
    }
  }
})();
