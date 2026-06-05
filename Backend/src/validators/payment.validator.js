// src/validators/payment.validator.js

import { z } from 'zod';

export const verifyPaymentSchema = z.object({
  razorpayOrderId:   z.string().min(1, 'Razorpay order ID is required'),
  razorpayPaymentId: z.string().min(1, 'Razorpay payment ID is required'),
  razorpaySignature: z.string().min(1, 'Razorpay signature is required'),
  bookingId:         z.string().length(24, 'Invalid booking ID'),
});

export const getPaymentSchema = z.object({
  paymentId: z.string().length(24, 'Invalid payment ID'),
});

export const paymentQuerySchema = z.object({
  page:   z.coerce.number().int().min(1).default(1),
  limit:  z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum(['created', 'authorized', 'captured', 'failed', 'refunded', 'partially_refunded']).optional(),
});