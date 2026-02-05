const ruleEngineService = require('./ruleEngine.service');

const ruleEngineController = {
    // ==========================================
    // ENGINE EXECUTION
    // ==========================================

    /**
     * Run the rule engine
     * POST /api/rules/run/:taxIdentityId/:taxYear
     */
    async runEngine(req, res, next) {
        try {
            const userId = req.user.id;
            const { taxIdentityId, taxYear } = req.params;
            const { formCode } = req.body;

            const result = await ruleEngineService.runEngine(
                taxIdentityId,
                parseInt(taxYear, 10),
                userId,
                { formCode }
            );

            res.status(200).json({
                success: true,
                data: result,
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Preview engine results without persisting
     * GET /api/rules/preview/:taxIdentityId/:taxYear
     */
    async previewEngine(req, res, next) {
        try {
            const userId = req.user.id;
            const { taxIdentityId, taxYear } = req.params;

            const result = await ruleEngineService.previewEngine(
                taxIdentityId,
                parseInt(taxYear, 10),
                userId
            );

            res.status(200).json({
                success: true,
                data: result,
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Recalculate declaration (delete and recalculate)
     * POST /api/rules/recalculate/:taxIdentityId/:taxYear
     */
    async recalculate(req, res, next) {
        try {
            const userId = req.user.id;
            const { taxIdentityId, taxYear } = req.params;

            const result = await ruleEngineService.recalculate(
                taxIdentityId,
                parseInt(taxYear, 10),
                userId
            );

            res.status(200).json({
                success: true,
                data: result,
            });
        } catch (error) {
            next(error);
        }
    },

    // ==========================================
    // RULES CRUD
    // ==========================================

    /**
     * Create a new rule
     * POST /api/rules
     */
    async createRule(req, res, next) {
        try {
            const { ruleCode, taxYear, ruleType, conditions, actions, priority, isActive } = req.body;

            if (!ruleType) {
                return res.status(400).json({
                    success: false,
                    error: 'ruleType is required',
                });
            }

            const rule = await ruleEngineService.createRule({
                ruleCode,
                taxYear,
                ruleType,
                conditions,
                actions,
                priority,
                isActive,
            });

            res.status(201).json({
                success: true,
                data: rule,
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Bulk create rules
     * POST /api/rules/bulk
     */
    async bulkCreateRules(req, res, next) {
        try {
            const { rules } = req.body;

            if (!rules || !Array.isArray(rules)) {
                return res.status(400).json({
                    success: false,
                    error: 'rules array is required',
                });
            }

            const results = await ruleEngineService.bulkCreateRules(rules);

            res.status(201).json({
                success: true,
                data: results,
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Get rule by ID
     * GET /api/rules/:id
     */
    async getRule(req, res, next) {
        try {
            const { id } = req.params;
            const rule = await ruleEngineService.getRule(id);

            res.status(200).json({
                success: true,
                data: rule,
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Update rule
     * PUT /api/rules/:id
     */
    async updateRule(req, res, next) {
        try {
            const { id } = req.params;
            const updates = req.body;

            const rule = await ruleEngineService.updateRule(id, updates);

            res.status(200).json({
                success: true,
                data: rule,
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Delete rule
     * DELETE /api/rules/:id
     */
    async deleteRule(req, res, next) {
        try {
            const { id } = req.params;
            await ruleEngineService.deleteRule(id);

            res.status(200).json({
                success: true,
                message: 'Rule deleted',
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * List rules with filters
     * GET /api/rules
     */
    async listRules(req, res, next) {
        try {
            const { taxYear, ruleType, isActive, page, limit } = req.query;

            const result = await ruleEngineService.listRules({
                taxYear: taxYear ? parseInt(taxYear, 10) : undefined,
                ruleType,
                isActive: isActive !== undefined ? isActive === 'true' : undefined,
                page: parseInt(page, 10) || 1,
                limit: Math.min(parseInt(limit, 10) || 50, 100),
            });

            res.status(200).json({
                success: true,
                data: result,
            });
        } catch (error) {
            next(error);
        }
    },

    // ==========================================
    // LOGICAL FIELDS
    // ==========================================

    /**
     * Get all logical fields
     * GET /api/rules/fields
     */
    async getLogicalFields(req, res, next) {
        try {
            const fields = await ruleEngineService.getLogicalFields();

            res.status(200).json({
                success: true,
                data: fields,
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Create logical field
     * POST /api/rules/fields
     */
    async createLogicalField(req, res, next) {
        try {
            const { code, description } = req.body;

            if (!code || !description) {
                return res.status(400).json({
                    success: false,
                    error: 'code and description are required',
                });
            }

            const field = await ruleEngineService.createLogicalField(code, description);

            res.status(201).json({
                success: true,
                data: field,
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Bulk create logical fields
     * POST /api/rules/fields/bulk
     */
    async bulkCreateLogicalFields(req, res, next) {
        try {
            const { fields } = req.body;

            if (!fields || !Array.isArray(fields)) {
                return res.status(400).json({
                    success: false,
                    error: 'fields array is required',
                });
            }

            const results = await ruleEngineService.bulkCreateLogicalFields(fields);

            res.status(201).json({
                success: true,
                data: results,
            });
        } catch (error) {
            next(error);
        }
    },

    // ==========================================
    // DECLARATION & MAPPINGS
    // ==========================================

    /**
     * Get declaration with items
     * GET /api/rules/declaration/:taxIdentityId/:taxYear
     */
    async getDeclaration(req, res, next) {
        try {
            const userId = req.user.id;
            const { taxIdentityId, taxYear } = req.params;

            const result = await ruleEngineService.getDeclaration(
                userId,
                taxIdentityId,
                parseInt(taxYear, 10)
            );

            res.status(200).json({
                success: true,
                data: result,
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Get tax mappings
     * GET /api/rules/mappings/:taxIdentityId/:taxYear
     */
    async getMappings(req, res, next) {
        try {
            const userId = req.user.id;
            const { taxIdentityId, taxYear } = req.params;

            const mappings = await ruleEngineService.getMappings(
                userId,
                taxIdentityId,
                parseInt(taxYear, 10)
            );

            res.status(200).json({
                success: true,
                data: mappings,
            });
        } catch (error) {
            next(error);
        }
    },
};

module.exports = ruleEngineController;
