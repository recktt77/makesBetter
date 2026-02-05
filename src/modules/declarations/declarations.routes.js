const express = require('express');
const router = express.Router();
const declarationsController = require('./declarations.controller');
const authMiddleware = require('../../middleware/auth.middleware');

// All routes require authentication
router.use(authMiddleware);

// ==========================================
// DECLARATION CRUD
// ==========================================

/**
 * POST /declarations
 * Create or get existing declaration
 * Body: { taxIdentityId, taxYear, formCode?, declarationKind? }
 */
router.post('/', declarationsController.create);

/**
 * GET /declarations
 * List declarations for user
 * Query: taxIdentityId?, taxYear?, status?, page?, limit?
 */
router.get('/', declarationsController.list);

/**
 * POST /declarations/generate
 * Create and generate declaration from tax events
 * Body: { taxIdentityId, taxYear, formCode?, declarationKind? }
 */
router.post('/generate', declarationsController.createAndGenerate);

/**
 * GET /declarations/:id
 * Get declaration by ID with items
 */
router.get('/:id', declarationsController.getById);

/**
 * PUT /declarations/:id
 * Update declaration header
 * Body: { iin?, fioLast?, fioFirst?, fioMiddle?, payerPhone?, email?, flags? }
 */
router.put('/:id', declarationsController.update);

/**
 * DELETE /declarations/:id
 * Delete draft declaration
 */
router.delete('/:id', declarationsController.delete);

// ==========================================
// GENERATION & CALCULATION
// ==========================================

/**
 * POST /declarations/:id/generate
 * Generate/regenerate declaration items from tax events using rule engine
 */
router.post('/:id/generate', declarationsController.generate);

// ==========================================
// ITEMS
// ==========================================

/**
 * PUT /declarations/:id/items/:field
 * Update specific item value (manual override)
 * Body: { value }
 */
router.put('/:id/items/:field', declarationsController.updateItem);

// ==========================================
// VALIDATION & WORKFLOW
// ==========================================

/**
 * POST /declarations/:id/validate
 * Validate declaration and transition to validated status
 */
router.post('/:id/validate', declarationsController.validate);

/**
 * PUT /declarations/:id/status
 * Manually transition declaration status
 * Body: { status }
 */
router.put('/:id/status', declarationsController.updateStatus);

/**
 * GET /declarations/:id/transitions
 * Get available status transitions
 */
router.get('/:id/transitions', declarationsController.getTransitions);

// ==========================================
// SUMMARY
// ==========================================

/**
 * GET /declarations/:id/summary
 * Get declaration summary for display
 */
router.get('/:id/summary', declarationsController.getSummary);

module.exports = router;
