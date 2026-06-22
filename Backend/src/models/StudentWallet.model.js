// ─────────────────────────────────────────────────────────────────────────────
// src/models/StudentWallet.model.js
// Unified student wallet handling both virtual tokens and fiat cash balances.
// ─────────────────────────────────────────────────────────────────────────────
import mongoose             from 'mongoose';
import mongooseLeanVirtuals from 'mongoose-lean-virtuals';
import { jsonTransform, toObjectOptions, moneyField } from '../utils/schema.util.js';

const { Schema } = mongoose;

const studentWalletSchema = new Schema(
  {
    studentId: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      unique:   true,
      index:    true,
    },
    // ── Token Ledger ──────────────────────────────────────────────────────────
    tokenBalance: {
      type:    Number,
      default: 0,
      min:     [0, 'Token balance cannot be negative'],
    },
    totalTokensPurchased: { type: Number, default: 0, min: 0 },
    totalTokensUsed:      { type: Number, default: 0, min: 0 },
    
    // ── Fiat Cash Ledger (In Paise to avoid float bugs) ───────────────────────
    cashBalancePaise: {
      ...moneyField(),
      description: 'Deposited/Refunded hard cash held inside the app to buy courses'
    },
    totalCashDepositedPaise: { ...moneyField() },
    totalCashSpentPaise:     { ...moneyField() },
    totalCashRefundedPaise:  { ...moneyField() },
  },
  {
    timestamps: true,
    toJSON:     jsonTransform,
    toObject:   toObjectOptions,
  },
);

studentWalletSchema.plugin(mongooseLeanVirtuals);

// ── Virtuals ───────────────────────────────────────────────────────────────────
studentWalletSchema.virtual('cashBalanceRupees').get(function () {
  return this.cashBalancePaise / 100;
});

// ── Instance Methods ──────────────────────────────────────────────────────────
studentWalletSchema.methods.creditTokens = async function (amount) {
  if (amount <= 0) throw new Error('Token amount must be positive');
  this.tokenBalance += amount;
  this.totalTokensPurchased += amount;
  return this.save();
};

studentWalletSchema.methods.debitTokens = async function (amount) {
  if (amount <= 0) throw new Error('Token amount must be positive');
  if (this.tokenBalance < amount) throw new Error('Insufficient token balance');
  this.tokenBalance -= amount;
  this.totalTokensUsed += amount;
  return this.save();
};

studentWalletSchema.methods.creditCash = async function (amountPaise, isRefund = false) {
  if (amountPaise <= 0) throw new Error('Cash amount must be positive');
  this.cashBalancePaise += amountPaise;
  if (isRefund) {
    this.totalCashRefundedPaise += amountPaise;
  } else {
    this.totalCashDepositedPaise += amountPaise;
  }
  return this.save();
};

studentWalletSchema.methods.debitCash = async function (amountPaise) {
  if (amountPaise <= 0) throw new Error('Cash amount must be positive');
  if (this.cashBalancePaise < amountPaise) throw new Error('Insufficient cash balance');
  this.cashBalancePaise -= amountPaise;
  this.totalCashSpentPaise += amountPaise;
  return this.save();
};

export const StudentWallet = mongoose.model('StudentWallet', studentWalletSchema);