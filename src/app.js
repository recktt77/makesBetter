const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Import routes
const authRoutes = require('./modules/auth/auth.routes');
const otpRoutes = require('./modules/otp/otp.routes');
const identitiesRoutes = require('./modules/identities/identities.routes');
const sourcesRoutes = require('./modules/sources/sources.routes');
const taxEventsRoutes = require('./modules/tax-events/taxEvents.routes');

// Import middleware
const { errorHandler, notFoundHandler } = require('./middleware/error.middleware');

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Trust proxy for correct IP detection
app.set('trust proxy', true);

// Health check
app.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString(),
    });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/otp', otpRoutes);
app.use('/api/identities', identitiesRoutes);
app.use('/api/sources', sourcesRoutes);
app.use('/api/tax-events', taxEventsRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

module.exports = app;
