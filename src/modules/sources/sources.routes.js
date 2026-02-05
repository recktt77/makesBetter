const express = require('express');
const router = express.Router();
const sourcesController = require('./sources.controller');
const { authenticate } = require('../../middleware/auth.middleware');

// All routes require authentication
router.use(authenticate);

// ==========================================
// SINGLE RECORD OPERATIONS
// ==========================================

/**
 * @route   GET /api/sources/record/:id
 * @desc    Get single source record (without payload)
 * @access  Private
 */
router.get('/record/:id', sourcesController.getRecord);

/**
 * @route   GET /api/sources/record/:id/payload
 * @desc    Get source record with full raw_payload
 * @access  Private
 */
router.get('/record/:id/payload', sourcesController.getRecordWithPayload);

/**
 * @route   DELETE /api/sources/record/:id
 * @desc    Deactivate source record (soft delete)
 * @access  Private (owner only)
 */
router.delete('/record/:id', sourcesController.deactivateRecord);

/**
 * @route   POST /api/sources/record/:id/reactivate
 * @desc    Reactivate source record
 * @access  Private (owner only)
 */
router.post('/record/:id/reactivate', sourcesController.reactivateRecord);

// ==========================================
// TAX IDENTITY SCOPED OPERATIONS
// ==========================================

/**
 * @route   GET /api/sources/:taxIdentityId
 * @desc    List source records for tax identity
 * @access  Private
 * @query   sourceType, isActive, startDate, endDate, page, limit, sortBy, sortOrder
 */
router.get('/:taxIdentityId', sourcesController.listRecords);

/**
 * @route   POST /api/sources/:taxIdentityId
 * @desc    Import single source record
 * @access  Private
 * @body    { sourceType, externalId?, rawPayload }
 */
router.post('/:taxIdentityId', sourcesController.importRecord);

/**
 * @route   POST /api/sources/:taxIdentityId/bulk
 * @desc    Bulk import source records
 * @access  Private
 * @body    { records: [{ sourceType, externalId?, rawPayload }] }
 */
router.post('/:taxIdentityId/bulk', sourcesController.bulkImport);

/**
 * @route   GET /api/sources/:taxIdentityId/stats
 * @desc    Get import statistics
 * @access  Private
 */
router.get('/:taxIdentityId/stats', sourcesController.getStats);

/**
 * @route   POST /api/sources/:taxIdentityId/bulk-deactivate
 * @desc    Bulk deactivate source records
 * @access  Private (owner only)
 * @body    { recordIds: [uuid, ...] }
 */
router.post('/:taxIdentityId/bulk-deactivate', sourcesController.bulkDeactivate);

module.exports = router;