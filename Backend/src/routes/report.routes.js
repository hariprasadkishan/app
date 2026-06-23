// src/routes/report.routes.js
import { Router }     from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { fileReport, getMyReports } from '../controllers/report.controller.js';

const router = Router();
router.use(authenticate);

router.post('/',    fileReport);
router.get('/my',   getMyReports);

export default router;