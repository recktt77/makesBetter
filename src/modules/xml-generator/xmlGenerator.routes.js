const express = require('express');
const router = express.Router();
const xmlGeneratorController = require('./xmlGenerator.controller');
const { authenticate } = require('../../middleware/auth.middleware');

// All routes require authentication
router.use(authenticate);

// ==========================================
// GENERATION
// ==========================================

/**
 * POST /xml/generate/:declarationId
 * Generate XML for declaration
 */
router.post('/generate/:declarationId', xmlGeneratorController.generate);

// ==========================================
// RETRIEVAL
// ==========================================

/**
 * GET /xml/:declarationId/latest
 * Get latest XML for declaration
 */
router.get('/:declarationId/latest', xmlGeneratorController.getLatest);

/**
 * GET /xml/:declarationId/download
 * Download latest XML as file
 */
router.get('/:declarationId/download', xmlGeneratorController.download);

/**
 * GET /xml/:declarationId/versions
 * List all XML versions for declaration
 */
router.get('/:declarationId/versions', xmlGeneratorController.listVersions);

/**
 * GET /xml/version/:xmlId
 * Get specific XML version by ID
 */
router.get('/version/:xmlId', xmlGeneratorController.getById);

/**
 * GET /xml/version/:xmlId/download
 * Download specific XML version
 */
router.get('/version/:xmlId/download', xmlGeneratorController.downloadVersion);

// ==========================================
// VALIDATION
// ==========================================

/**
 * POST /xml/:declarationId/validate
 * Validate XML structure
 */
router.post('/:declarationId/validate', xmlGeneratorController.validate);

module.exports = router;
