const jwt = require('jsonwebtoken');
const authRepository = require('./auth.repository');
const otpService = require('../otp/otp.service');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Auth Service - Business logic for authentication
 */
const authService = {
    /**
     * Step 1: Request login - find user and send OTP
     * @param {string} identifier - Email, phone or username
     * @param {string} ipAddress - Client IP
     * @param {string} userAgent - Client user agent
     * @returns {Promise<Object>}
     */
    async requestLogin(identifier, ipAddress, userAgent) {
        // Find user by identifier
        let user = await authRepository.findByIdentifier(identifier);

        if (!user) {
            // Optionally: auto-create user if it's an email
            if (this.isEmail(identifier)) {
                user = await authRepository.create({ email: identifier });
            } else {
                throw new Error('Пользователь не найден');
            }
        }

        if (!user.is_active) {
            throw new Error('Аккаунт заблокирован');
        }

        if (!user.email) {
            throw new Error('Email не указан для пользователя');
        }

        // Send OTP
        const otpResult = await otpService.sendOTP(user, ipAddress, userAgent);

        return {
            userId: user.id,
            ...otpResult,
        };
    },

    /**
     * Step 2: Verify OTP and login
     * @param {string} userId - User UUID
     * @param {string} code - OTP code
     * @returns {Promise<Object>}
     */
    async verifyAndLogin(userId, code) {
        // Verify OTP
        await otpService.verifyOTP(userId, code);

        // Find user
        const user = await authRepository.findById(userId);

        if (!user) {
            throw new Error('Пользователь не найден');
        }

        // Generate JWT token
        const token = this.generateToken(user);

        return {
            token,
            user: this.sanitizeUser(user),
        };
    },

    /**
     * Generate JWT token
     * @param {Object} user - User object
     * @returns {string}
     */
    generateToken(user) {
        return jwt.sign(
            {
                userId: user.id,
                email: user.email,
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );
    },

    /**
     * Verify JWT token
     * @param {string} token - JWT token
     * @returns {Object}
     */
    verifyToken(token) {
        return jwt.verify(token, JWT_SECRET);
    },

    /**
     * Remove sensitive data from user object
     * @param {Object} user - User object
     * @returns {Object}
     */
    sanitizeUser(user) {
        const { ...safeUser } = user;
        return {
            id: safeUser.id,
            email: safeUser.email,
            phone: safeUser.phone,
            username: safeUser.username,
            is_active: safeUser.is_active,
            created_at: safeUser.created_at,
        };
    },

    /**
     * Check if string is email
     * @param {string} str - String to check
     * @returns {boolean}
     */
    isEmail(str) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(str);
    },

    /**
     * Get user from token
     * @param {string} token - JWT token
     * @returns {Promise<Object>}
     */
    async getUserFromToken(token) {
        const decoded = this.verifyToken(token);
        const user = await authRepository.findById(decoded.userId);

        if (!user) {
            throw new Error('Пользователь не найден');
        }

        return this.sanitizeUser(user);
    },
};

module.exports = authService;
