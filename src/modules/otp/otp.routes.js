const express = require('express');
const router = express.Router();
const otpController = require('./otp.controller');

/**
 * @route   POST /api/otp/verify
 * @desc    Verify OTP code
 * @access  Public
 */
router.post('/verify', otpController.verifyOTP);

/**
 * @route   POST /api/otp/cleanup
 * @desc    Cleanup expired OTPs (admin only)
 * @access  Admin
 */
router.post('/cleanup', otpController.cleanup);

module.exports = router;
