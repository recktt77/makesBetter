const app = require('./app');
const { verifyConnection } = require('./utils/mailer');
const { pool } = require('./db/postgres');
require('dotenv').config();

const PORT = process.env.PORT || 3000;

// Start server
const startServer = async () => {
    try {
        // Test database connection
        await pool.query('SELECT NOW()');
        console.log('✅ Database connection verified');

        // Verify email transporter (optional - don't fail if email not configured)
        await verifyConnection().catch(() => {
            console.warn('⚠️ Email transporter not configured - OTP emails will fail');
        });

        // Start listening
        app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`📍 Health check: http://localhost:${PORT}/health`);
            console.log(`🔐 Auth API: http://localhost:${PORT}/api/auth`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully');
    await pool.end();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully');
    await pool.end();
    process.exit(0);
});

startServer();
