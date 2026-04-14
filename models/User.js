const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  email: {
    type: String,
    sparse: true,
    trim: true,
  },
  phone: {
    type: String,
    sparse: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },
  balance: {
    type: Number,
    default: 0, // Starts empty
  },
  isBanned: {
    type: Boolean,
    default: false
  },
  totalBets: { type: Number, default: 0 },
  totalWins: { type: Number, default: 0 },
  totalProfit: { type: Number, default: 0 }, // Winnings minus original bet
  totalLoss: { type: Number, default: 0 }    // Bet amounts lost
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
