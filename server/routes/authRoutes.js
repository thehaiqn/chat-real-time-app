import express from 'express';
import rateLimit from 'express-rate-limit';
import { login, logout, register, forgotPassword, resetPassword, socialLogin, requestOTP, verifyOTP } from '../controllers/authController.js';

const router = express.Router();

router.post('/signup', register);
router.post('/login', login);
router.post('/social', socialLogin);
router.post('/logout', logout);
router.post('/forgot-password', forgotPassword);
router.put('/reset-password/:token', resetPassword);

const otpLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 phút
  max: 1, // Giới hạn 1 request mỗi 1 phút cho 1 IP
  message: { error: "Bạn gửi yêu cầu quá nhanh. Vui lòng đợi 60 giây trước khi thử lại." },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/forgot-password/request-otp', otpLimiter, requestOTP);
router.post('/forgot-password/verify-otp', verifyOTP);

export default router;
