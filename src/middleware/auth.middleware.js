const authService = require('../modules/auth/auth.service');
const authRepository = require('../modules/auth/auth.repository');

/**
 * JWT Authentication Middleware
 */
const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'Токен авторизации не предоставлен',
            });
        }

        const token = authHeader.split(' ')[1];
        const decoded = authService.verifyToken(token);

        const user = await authRepository.findById(decoded.userId);

        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Пользователь не найден',
            });
        }

        if (!user.is_active) {
            return res.status(403).json({
                success: false,
                error: 'Аккаунт заблокирован',
            });
        }

        req.user = user;
        next();
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
};

/**
 * Optional authentication - doesn't fail if no token
 */
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            const decoded = authService.verifyToken(token);
            const user = await authRepository.findById(decoded.userId);

            if (user && user.is_active) {
                req.user = user;
            }
        }

        next();
    } catch (error) {
        // Ignore auth errors for optional auth
        next();
    }
};

module.exports = {
    authenticate,
    optionalAuth,
};
