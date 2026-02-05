const otpRepository = require('./otp.repository');
const { generateOTP, getOTPExpiration, isOTPExpired } = require('../../utils/otp');
const { hashValue, compareHash } = require('../../utils/crypto');
const { sendOTPEmail } = require('../../utils/mailer');
require('dotenv').config();

const MAX_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS, 10) || 3;
const EXPIRES_MINUTES = parseInt(process.env.OTP_EXPIRES_MINUTES, 10) || 5;
const MAX_REQUESTS_PER_HOUR = 5;

/**
 * OTP Service - Business logic for OTP operations
 */
const otpService = {
    /**
     * Generate and send OTP to user
     * @param {Object} user - User object
     * @param {string} ipAddress - Client IP
     * @param {string} userAgent - Client user agent
     * @returns {Promise<Object>}
     */
    async sendOTP(user, ipAddress, userAgent) {
        // Rate limiting check
        const recentRequests = await otpRepository.countRecentRequests(user.id, 60);
        if (recentRequests >= MAX_REQUESTS_PER_HOUR) {
            throw new Error('Превышен лимит запросов OTP. Попробуйте позже.');
        }

        // Invalidate any existing OTPs for this user
        await otpRepository.invalidateAllForUser(user.id);

        // Generate new OTP
        const code = generateOTP();
        const codeHash = await hashValue(code);
        const expiresAt = getOTPExpiration(EXPIRES_MINUTES);

        console.log('Generated OTP:', { code, expiresAt: expiresAt.toISOString() });

        // Save OTP to database
        const otp = await otpRepository.create({
            userId: user.id,
            codeHash,
            expiresAt,
            ipAddress,
            userAgent,
        });

        // Send OTP via email
        if (user.email) {
            await sendOTPEmail(user.email, code);
        }

        return {
            otpId: otp.id,
            expiresAt: otp.expires_at,
            message: `Код отправлен на ${this.maskEmail(user.email)}`,
        };
    },

    /**
     * Verify OTP code
     * @param {string} userId - User UUID
     * @param {string} code - OTP code to verify
     * @returns {Promise<Object>}
     */
    async verifyOTP(userId, code) {
        // Find active OTP
        const otp = await otpRepository.findActiveByUserId(userId);

        if (!otp) {
            throw new Error('Код не найден или истёк. Запросите новый код.');
        }

        // Check if expired
        if (isOTPExpired(otp.expires_at)) {
            await otpRepository.markAsUsed(otp.id);
            throw new Error('Код истёк. Запросите новый код.');
        }

        // Check attempts
        if (otp.attempts >= MAX_ATTEMPTS) {
            await otpRepository.markAsUsed(otp.id);
            throw new Error('Превышено количество попыток. Запросите новый код.');
        }

        // Verify code
        const isValid = await compareHash(code, otp.code_hash);

        if (!isValid) {
            await otpRepository.incrementAttempts(otp.id);
            const remainingAttempts = MAX_ATTEMPTS - otp.attempts - 1;
            throw new Error(`Неверный код. Осталось попыток: ${remainingAttempts}`);
        }

        // Mark OTP as used
        await otpRepository.markAsUsed(otp.id);

        return {
            success: true,
            message: 'Код подтверждён',
        };
    },

    /**
     * Mask email for display
     * @param {string} email - Email address
     * @returns {string}
     */
    maskEmail(email) {
        if (!email) return '';
        const [name, domain] = email.split('@');
        const maskedName = name.charAt(0) + '***' + name.charAt(name.length - 1);
        return `${maskedName}@${domain}`;
    },

    /**
     * Cleanup expired OTPs
     * @returns {Promise<number>}
     */
    async cleanup() {
        return await otpRepository.deleteExpired();
    },
};

module.exports = otpService;
