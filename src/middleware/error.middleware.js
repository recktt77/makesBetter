/**
 * Global Error Handler Middleware
 */
const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);

    // Default error
    let statusCode = 500;
    let message = 'Внутренняя ошибка сервера';

    // Known error types
    if (err.message) {
        message = err.message;

        // Map error messages to status codes
        if (
            message.includes('не найден') ||
            message.includes('not found')
        ) {
            statusCode = 404;
        } else if (
            message.includes('обязательны') ||
            message.includes('required') ||
            message.includes('Неверный') ||
            message.includes('invalid')
        ) {
            statusCode = 400;
        } else if (
            message.includes('заблокирован') ||
            message.includes('blocked') ||
            message.includes('Превышен лимит')
        ) {
            statusCode = 403;
        } else if (
            message.includes('истёк') ||
            message.includes('expired') ||
            message.includes('Превышено количество попыток')
        ) {
            statusCode = 400;
        }
    }

    // PostgreSQL unique constraint violation
    if (err.code === '23505') {
        statusCode = 409;
        message = 'Запись уже существует';
    }

    // PostgreSQL foreign key violation
    if (err.code === '23503') {
        statusCode = 400;
        message = 'Связанная запись не найдена';
    }

    res.status(statusCode).json({
        success: false,
        error: message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
};

/**
 * 404 Not Found Handler
 */
const notFoundHandler = (req, res) => {
    res.status(404).json({
        success: false,
        error: `Маршрут ${req.originalUrl} не найден`,
    });
};

module.exports = {
    errorHandler,
    notFoundHandler,
};
