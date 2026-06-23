// src/routes/user.routes.js
import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { handleProfileUpload } from '../middlewares/upload.middleware.js';
import { uploadLimiter } from '../middlewares/rateLimit.middleware.js';
import {
  getMe, updateMe, uploadAvatar, deleteMe,
  submitParentalConsent, sendGuardianOtp,
  updateFcmToken, saveClassroom, unsaveClassroom,
  getSavedClassrooms, getPaymentHistory, changePassword,
} from '../controllers/user.controller.js';

const router = Router();
router.use(authenticate);

router.get('/me',              getMe);
router.patch('/me',            updateMe);
router.post('/me/avatar',      uploadLimiter, ...handleProfileUpload, uploadAvatar);
router.delete('/me',           deleteMe);
router.post('/me/change-password', changePassword);

// Parental consent (minor users)
router.post('/me/parental-consent/send-otp', sendGuardianOtp);
router.post('/me/parental-consent',          submitParentalConsent);

// FCM push token
router.post('/me/fcm-token', updateFcmToken);

// Saved classrooms (students)
router.get('/me/saved-classrooms',              getSavedClassrooms);
router.post('/me/saved-classrooms/:classroomId',   saveClassroom);
router.delete('/me/saved-classrooms/:classroomId', unsaveClassroom);

// Payment history
router.get('/me/payments', getPaymentHistory);

export default router;