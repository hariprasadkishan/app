// src/validators/admin.validator.js

import { z } from 'zod';

export const approveTeacherSchema = z.object({
  note: z.string().trim().max(500).optional(),
});

export const rejectTeacherSchema = z.object({
  reason: z.string().trim().min(10, 'Reason must be at least 10 characters').max(500),
});

export const suspendTeacherSchema = z.object({
  reason: z.string().trim().min(5, 'Reason is required').max(500),
});

export const approveRefundSchema = z.object({
  approvedAmountPaise: z.number().int().positive().optional(),
  note:                z.string().trim().max(500).optional(),
});

export const rejectRefundSchema = z.object({
  reason: z.string().trim().min(5, 'Reason is required').max(500),
});

export const banUserSchema = z.object({
  reason: z.string().trim().min(5, 'Reason is required').max(500),
});

export const adminListQuerySchema = z.object({
  page:   z.coerce.number().int().min(1).default(1),
  limit:  z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
  status: z.string().optional(),
  role:   z.enum(['student', 'teacher', 'admin']).optional(),
});

export const analyticsQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate:   z.string().datetime().optional(),
});