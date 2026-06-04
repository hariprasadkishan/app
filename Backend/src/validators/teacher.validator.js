import { z } from "zod";
import { SUBJECTS, CLASS_GRADES, INDIAN_BOARDS } from "../constants/enums.js";

export const teacherProfileSchema = z.object({
  bio: z.string().trim().min(50, "Bio must be at least 50 characters").max(1200),
  headline: z.string().trim().max(160).optional(),
  subjects: z.array(z.enum(SUBJECTS)).min(1).max(10),
  classGrades: z.array(z.enum(CLASS_GRADES)).max(15).default([]),
  boards: z.array(z.enum(INDIAN_BOARDS)).default([]),
  hourlyRatePaise: z.number().int().min(5000, "Minimum ₹50").max(500000, "Maximum ₹5000"),
  experienceYears: z.number().int().min(0).max(60),
  onlineOnly: z.boolean().default(true),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
});

export const availabilitySlotSchema = z.object({
  day: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Use HH:MM format"),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Use HH:MM format"),
  slotDuration: z.number().int().refine(v => [30, 60, 90, 120].includes(v)),
});

export const teacherSearchSchema = z.object({
  subjects: z.array(z.enum(SUBJECTS)).optional(),
  classGrades: z.array(z.enum(CLASS_GRADES)).optional(),
  city: z.string().trim().max(100).optional(),
  minRate: z.coerce.number().int().min(0).optional(),
  maxRate: z.coerce.number().int().optional(),
  nearLng: z.coerce.number().optional(),
  nearLat: z.coerce.number().optional(),
  maxDistanceKm: z.coerce.number().min(1).max(500).default(50),
  minRating: z.coerce.number().min(0).max(5).default(0),
  textQuery: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  sort: z.enum(["rating", "price_asc", "price_desc", "new"]).default("rating"),
});