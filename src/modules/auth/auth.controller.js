const authService = require('./auth.service');

/**
 * Auth Controller - HTTP handlers for authentication
 */
const authController = {
    /**
     * Request login - Step 1
     * POST /api/auth/login/request
     */
    async requestLogin(req, res, next) {
        try {
            const { identifier } = req.body;

            if (!identifier) {
                return res.status(400).json({
                    success: false,
                    error: 'Email, телефон или username обязательны',
                });
            }

            const ipAddress = req.ip || req.connection.remoteAddress;
            const userAgent = req.get('User-Agent');

            const result = await authService.requestLogin(identifier, ipAddress, userAgent);

            res.status(200).json({
                success: true,
                data: result,
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Verify OTP and login - Step 2
     * POST /api/auth/login/verify
     */
    async verifyLogin(req, res, next) {
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

            const result = await authService.verifyAndLogin(userId, code);

            res.status(200).json({
                success: true,
                data: result,
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Get current user
     * GET /api/auth/me
     */
    async getMe(req, res, next) {
        try {
            const authHeader = req.headers.authorization;

            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({
                    success: false,
                    error: 'Токен не предоставлен',
                });
            }

            const token = authHeader.split(' ')[1];
            const user = await authService.getUserFromToken(token);

            res.status(200).json({
                success: true,
                data: { user },
            });
        } catch (error) {
            if (error.name === 'JsonWebTokenError') {
                return res.status(401).json({
                    success: false,
                    error: 'Неверный токен',
                });
            }
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({
                    success: false,
                    error: 'Токен истёк',
                });
            }
            next(error);
        }
    },

    /**
     * Logout (client-side - just for reference)
     * POST /api/auth/logout
     */
    async logout(req, res) {
        // JWT токены stateless, поэтому logout происходит на клиенте
        // Можно добавить blacklist токенов при необходимости
        res.status(200).json({
            success: true,
            message: 'Выход выполнен успешно',
        });
    },
};

module.exports = authController;
