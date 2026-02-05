const express = require('express');
const router = express.Router();
const ruleEngineController = require('./ruleEngine.controller');
const { authenticate } = require('../../middleware/auth.middleware');

// All routes require authentication
router.use(authenticate);

// ==========================================
// LOGICAL FIELDS (before parameterized routes)
// ==========================================

/**
 * @route   GET /api/rules/fields
 * @desc    Get all logical fields
 * @access  Private
 */
router.get('/fields', ruleEngineController.getLogicalFields);

/**
 * @route   POST /api/rules/fields
 * @desc    Create logical field
 * @access  Private
 * @body    { code, description }
 */
router.post('/fields', ruleEngineController.createLogicalField);

/**
 * @route   POST /api/rules/fields/bulk
 * @desc    Bulk create logical fields
 * @access  Private
 * @body    { fields: [{ code, description }] }
 */
router.post('/fields/bulk', ruleEngineController.bulkCreateLogicalFields);

// ==========================================
// ENGINE EXECUTION
// ==========================================

/**
 * @route   POST /api/rules/run/:taxIdentityId/:taxYear
 * @desc    Run rule engine (calculate and persist)
 * @access  Private
 * @body    { formCode? }
 */
router.post('/run/:taxIdentityId/:taxYear', ruleEngineController.runEngine);

/**
 * @route   GET /api/rules/preview/:taxIdentityId/:taxYear
 * @desc    Preview engine results without persisting
 * @access  Private
 */
router.get('/preview/:taxIdentityId/:taxYear', ruleEngineController.previewEngine);

/**
 * @route   POST /api/rules/recalculate/:taxIdentityId/:taxYear
 * @desc    Recalculate declaration (delete old + calculate new)
 * @access  Private (owner only)
 */
router.post('/recalculate/:taxIdentityId/:taxYear', ruleEngineController.recalculate);

// ==========================================
// DECLARATION & MAPPINGS
// ==========================================

/**
 * @route   GET /api/rules/declaration/:taxIdentityId/:taxYear
 * @desc    Get declaration with items
 * @access  Private
 */
router.get('/declaration/:taxIdentityId/:taxYear', ruleEngineController.getDeclaration);

/**
 * @route   GET /api/rules/mappings/:taxIdentityId/:taxYear
 * @desc    Get tax mappings
 * @access  Private
 */
router.get('/mappings/:taxIdentityId/:taxYear', ruleEngineController.getMappings);

// ==========================================
// RULES CRUD
// ==========================================

/**
 * @route   POST /api/rules/bulk
 * @desc    Bulk create rules
 * @access  Private
 * @body    { rules: [...] }
 */
router.post('/bulk', ruleEngineController.bulkCreateRules);

/**
 * @route   GET /api/rules
 * @desc    List rules with filters
 * @access  Private
 * @query   taxYear, ruleType, isActive, page, limit
 */
router.get('/', ruleEngineController.listRules);

/**
 * @route   POST /api/rules
 * @desc    Create a new rule
 * @access  Private
 * @body    { ruleCode, taxYear, ruleType, conditions, actions, priority, isActive }
 */
router.post('/', ruleEngineController.createRule);

/**
 * @route   GET /api/rules/:id
 * @desc    Get rule by ID
 * @access  Private
 */
router.get('/:id', ruleEngineController.getRule);

/**
 * @route   PUT /api/rules/:id
 * @desc    Update rule
 * @access  Private
 */
router.put('/:id', ruleEngineController.updateRule);

/**
 * @route   DELETE /api/rules/:id
 * @desc    Delete rule
 * @access  Private
 */
router.delete('/:id', ruleEngineController.deleteRule);

module.exports = router;
