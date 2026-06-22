// ─────────────────────────────────────────────────────────────────────────────
// src/models/TokenTransaction.model.js
// Standalone ledger for token tracking to avoid Mongoose array bloating.
// ─────────────────────────────────────────────────────────────────────────────
import mongoose             from 'mongoose';
import mongoosePaginate     from 'mongoose-paginate-v2';
import mongooseLeanVirtuals from 'mongoose-lean-virtuals';
import { TOKEN_TRANSACTION_TYPE } from '../constants/enums.js';
import { jsonTransform, toObjectOptions, enumField } from '../utils/schema.util.js';

const { Schema } = mongoose;

const tokenTransactionSchema = new Schema(
  {
    studentId: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: [true, 'Student ID is required'],
      index:    true,
    },
    walletId: {
      type:     Schema.Types.ObjectId,
      ref:      'StudentWallet',
      required: [true, 'Wallet ID is required'],
      index:    true,
    },
    type:   enumField(TOKEN_TRANSACTION_TYPE, TOKEN_TRANSACTION_TYPE.PURCHASED),
    amount: { type: Number, required: true }, // positive = credit, negative = debit
    balanceAfter: { type: Number, required: true, min: 0 },
    // Context references
    paymentId: { type: Schema.Types.ObjectId, ref: 'Payment', default: null, index: true },
    queryId:   { type: Schema.Types.ObjectId, ref: 'EnrollmentQuery', default: null, index: true },
    note:      { type: String, trim: true, default: '' },
  },
  {
    timestamps: true,
    toJSON:     jsonTransform,
    toObject:   toObjectOptions,
  },
);

tokenTransactionSchema.plugin(mongoosePaginate);
tokenTransactionSchema.plugin(mongooseLeanVirtuals);

// Compound index for super-fast transaction history queries
tokenTransactionSchema.index({ studentId: 1, createdAt: -1 });

export const TokenTransaction = mongoose.model('TokenTransaction', tokenTransactionSchema);