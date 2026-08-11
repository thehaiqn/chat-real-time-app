import express from 'express';
import { login, logout, register, forgotPassword, resetPassword, socialLogin } from '../controllers/authController.js';

const router = express.Router();

router.post('/signup', register);
router.post('/login', login);
router.post('/social', socialLogin);
router.post('/logout', logout);
router.post('/forgot-password', forgotPassword);
router.put('/reset-password/:token', resetPassword);

export default router;
