const express = require('express');
const router = express.Router();
const taxEventsController = require('./taxEvents.controller');
const { authenticate } = require('../../middleware/auth.middleware');

// All routes require authentication
router.use(authenticate);

// ==========================================
// EVENT TYPES (must be before :taxIdentityId routes)
// ==========================================

/**
 * @route   GET /api/tax-events/types
 * @desc    Get all tax event types
 * @access  Private
 */
router.get('/types', taxEventsController.getEventTypes);

/**
 * @route   POST /api/tax-events/types
 * @desc    Create new tax event type (admin)
 * @access  Private
 * @body    { code, description }
 */
router.post('/types', taxEventsController.createEventType);

// ==========================================
// CREATE SINGLE EVENT
// ==========================================

/**
 * @route   POST /api/tax-events
 * @desc    Create single tax event manually
 * @access  Private
 * @body    { taxIdentityId, eventType, eventDate, amount?, currency?, metadata? }
 */
router.post('/', taxEventsController.createEvent);

// ==========================================
// SINGLE EVENT OPERATIONS
// ==========================================

/**
 * @route   GET /api/tax-events/event/:id
 * @desc    Get single tax event
 * @access  Private
 */
router.get('/event/:id', taxEventsController.getEvent);

/**
 * @route   GET /api/tax-events/by-source/:sourceRecordId
 * @desc    Get all events from source record
 * @access  Private
 */
router.get('/by-source/:sourceRecordId', taxEventsController.getEventsBySource);

// ==========================================
// PARSING OPERATIONS
// ==========================================

/**
 * @route   POST /api/tax-events/parse/:sourceRecordId
 * @desc    Parse source record into tax events
 * @access  Private
 */
router.post('/parse/:sourceRecordId', taxEventsController.parseSourceRecord);

/**
 * @route   POST /api/tax-events/reparse/:sourceRecordId
 * @desc    Re-parse source record (delete old, create new)
 * @access  Private (owner only)
 */
router.post('/reparse/:sourceRecordId', taxEventsController.reparseSourceRecord);

/**
 * @route   POST /api/tax-events/parse-all/:taxIdentityId
 * @desc    Parse all unparsed source records
 * @access  Private
 */
router.post('/parse-all/:taxIdentityId', taxEventsController.parseAllForIdentity);

// ==========================================
// TAX IDENTITY SCOPED OPERATIONS
// ==========================================

/**
 * @route   GET /api/tax-events/:taxIdentityId
 * @desc    List tax events for identity
 * @access  Private
 * @query   taxYear, eventType, startDate, endDate, page, limit, sortBy, sortOrder
 */
router.get('/:taxIdentityId', taxEventsController.listEvents);

/**
 * @route   GET /api/tax-events/:taxIdentityId/years
 * @desc    Get available tax years
 * @access  Private
 */
router.get('/:taxIdentityId/years', taxEventsController.getAvailableYears);

/**
 * @route   GET /api/tax-events/:taxIdentityId/summary/:taxYear
 * @desc    Get summary for tax year
 * @access  Private
 */
router.get('/:taxIdentityId/summary/:taxYear', taxEventsController.getSummary);

module.exports = router;
