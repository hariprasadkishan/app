import { z } from "zod";
import { SUBJECTS, CLASS_GRADES } from "../constants/enums.js";

export const createBookingSchema = z.object({
  teacherId: z.string().length(24, "Invalid teacher ID"),
  subject: z.enum(SUBJECTS),
  classGrade: z.enum(CLASS_GRADES).optional(),
  scheduledAt: z.string().datetime().pipe(
    z.string().transform(s => new Date(s))
  ).refine(d => d > new Date(), "Scheduled time must be in the future"),
  durationMinutes: z.number().int().refine(v => [30, 60, 90, 120].includes(v)),
  slotId: z.string().length(24).optional(),
});

export const cancelBookingSchema = z.object({
  reason: z.string().trim().min(5).max(500).optional(),
});