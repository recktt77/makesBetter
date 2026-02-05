const otpService = require('./otp.service');

/**
 * OTP Controller - HTTP handlers for OTP operations
 */
const otpController = {
    /**
     * Request OTP code
     * POST /api/otp/request
     */
    async requestOTP(req, res, next) {
        try {
            const { user } = req; // User is attached by auth middleware
            const ipAddress = req.ip || req.connection.remoteAddress;
            const userAgent = req.get('User-Agent');

            const result = await otpService.sendOTP(user, ipAddress, userAgent);

            res.status(200).json({
                success: true,
                data: result,
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Verify OTP code
     * POST /api/otp/verify
     */
    async verifyOTP(req, res, next) {
        try {
            const { userId, code } = req.body;

            if (!userId || !code) {
                return res.status(400).json({
                    success: false,
                    error: 'userId и code обязательны',
                });
            }

            if (!/^\d{6}$/.test(code)) {
                return res.status(400).json({
                    success: false,
                    error: 'Код должен содержать 6 цифр',
                });
            }

            const result = await otpService.verifyOTP(userId, code);

            res.status(200).json({
                success: true,
                data: result,
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Cleanup expired OTPs (admin/cron endpoint)
     * POST /api/otp/cleanup
     */
    async cleanup(req, res, next) {
        try {
            const deletedCount = await otpService.cleanup();

            res.status(200).json({
                success: true,
                data: {
                    deletedCount,
                    message: `Удалено ${deletedCount} устаревших OTP кодов`,
                },
            });
        } catch (error) {
            next(error);
        }
    },
};

module.exports = otpController;
