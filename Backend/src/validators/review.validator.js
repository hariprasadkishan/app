// src/validators/review.validator.js

import { z } from 'zod';

export const createReviewSchema = z.object({
  bookingId: z.string().length(24, 'Invalid booking ID'),
  rating:    z.number().int().min(1, 'Rating must be at least 1').max(5, 'Rating cannot exceed 5'),
  comment:   z.string().trim().max(1000, 'Comment cannot exceed 1000 characters').optional(),
});

export const teacherReviewsQuerySchema = z.object({
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const reviewQuerySchema = z.object({
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});