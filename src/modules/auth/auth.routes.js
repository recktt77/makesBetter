const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');

/**
 * @route   POST /api/auth/login/request
 * @desc    Request OTP login - Step 1
 * @access  Public
 * @body    { identifier: "email@example.com" }
 */
router.post('/login/request', authController.requestLogin);

/**
 * @route   POST /api/auth/login/verify
 * @desc    Verify OTP and complete login - Step 2
 * @access  Public
 * @body    { userId: "uuid", code: "123456" }
 */
router.post('/login/verify', authController.verifyLogin);

/**
 * @route   GET /api/auth/me
 * @desc    Get current authenticated user
 * @access  Private
 * @header  Authorization: Bearer <token>
 */
router.get('/me', authController.getMe);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout', authController.logout);

module.exports = router;
