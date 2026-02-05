const declarationsService = require('./declarations.service');

const declarationsController = {
    // ==========================================
    // DECLARATION CRUD
    // ==========================================

    /**
     * POST /declarations
     * Create or get existing declaration
     */
    async create(req, res, next) {
        try {
            const { taxIdentityId, taxYear, formCode, declarationKind } = req.body;
            const userId = req.user.id;

            if (!taxIdentityId || !taxYear) {
                return res.status(400).json({
                    success: false,
                    error: 'taxIdentityId and taxYear are required',
                });
            }

            const result = await declarationsService.createOrGet(
                taxIdentityId,
                taxYear,
                userId,
                { formCode, declarationKind }
            );

            res.status(result.created ? 201 : 200).json({
                success: true,
                data: result.declaration,
                message: result.message,
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * GET /declarations/:id
     * Get declaration by ID with items
     */
    async getById(req, res, next) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            const declaration = await declarationsService.getById(id, userId);

            res.json({
                success: true,
                data: declaration,
            });
        } catch (error) {
            if (error.message.includes('not found')) {
                return res.status(404).json({ success: false, error: error.message });
            }
            if (error.message.includes('No access')) {
                return res.status(403).json({ success: false, error: error.message });
            }
            next(error);
        }
    },

    /**
     * GET /declarations
     * List declarations for user
     */
    async list(req, res, next) {
        try {
            const userId = req.user.id;
            const { taxIdentityId, taxYear, status, page, limit } = req.query;

            const result = await declarationsService.listForUser(userId, {
                taxIdentityId,
                taxYear: taxYear ? parseInt(taxYear, 10) : undefined,
                status,
                page: page ? parseInt(page, 10) : 1,
                limit: limit ? parseInt(limit, 10) : 20,
            });

            res.json({
                success: true,
                data: result.declarations,
                pagination: result.pagination,
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * PUT /declarations/:id
     * Update declaration header
     */
    async update(req, res, next) {
        try {
            const { id } = req.params;
            const userId = req.user.id;
            const { iin, fioLast, fioFirst, fioMiddle, payerPhone, email, flags } = req.body;

            const updated = await declarationsService.updateHeader(id, {
                iin,
                fio_last: fioLast,
                fio_first: fioFirst,
                fio_middle: fioMiddle,
                payer_phone: payerPhone,
                email,
                flags,
            }, userId);

            res.json({
                success: true,
                data: updated,
            });
        } catch (error) {
            if (error.message.includes('not found')) {
                return res.status(404).json({ success: false, error: error.message });
            }
            if (error.message.includes('No access')) {
                return res.status(403).json({ success: false, error: error.message });
            }
            if (error.message.includes('Cannot update')) {
                return res.status(409).json({ success: false, error: error.message });
            }
            next(error);
        }
    },

    /**
     * DELETE /declarations/:id
     * Delete draft declaration
     */
    async delete(req, res, next) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            await declarationsService.delete(id, userId);

            res.json({
                success: true,
                message: 'Declaration deleted',
            });
        } catch (error) {
            if (error.message.includes('not found')) {
                return res.status(404).json({ success: false, error: error.message });
            }
            if (error.message.includes('No access')) {
                return res.status(403).json({ success: false, error: error.message });
            }
            if (error.message.includes('Only draft')) {
                return res.status(409).json({ success: false, error: error.message });
            }
            next(error);
        }
    },

    // ==========================================
    // GENERATION & CALCULATION
    // ==========================================

    /**
     * POST /declarations/:id/generate
     * Generate declaration items from tax events using rule engine
     */
    async generate(req, res, next) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            // Get declaration to get taxIdentityId and taxYear
            const declaration = await declarationsService.getById(id, userId);

            const result = await declarationsService.generate(
                declaration.tax_identity_id,
                declaration.tax_year,
                userId
            );

            res.json({
                success: true,
                data: result.declaration,
                items: result.items,
                stats: result.stats,
                errors: result.errors,
            });
        } catch (error) {
            if (error.message.includes('not found')) {
                return res.status(404).json({ success: false, error: error.message });
            }
            if (error.message.includes('No access')) {
                return res.status(403).json({ success: false, error: error.message });
            }
            if (error.message.includes('Cannot regenerate')) {
                return res.status(409).json({ success: false, error: error.message });
            }
            next(error);
        }
    },

    /**
     * POST /declarations/generate
     * Create declaration and generate items from tax events
     */
    async createAndGenerate(req, res, next) {
        try {
            const { taxIdentityId, taxYear, formCode, declarationKind } = req.body;
            const userId = req.user.id;

            if (!taxIdentityId || !taxYear) {
                return res.status(400).json({
                    success: false,
                    error: 'taxIdentityId and taxYear are required',
                });
            }

            // Create or get
            await declarationsService.createOrGet(
                taxIdentityId,
                taxYear,
                userId,
                { formCode, declarationKind }
            );

            // Generate
            const result = await declarationsService.generate(
                taxIdentityId,
                taxYear,
                userId
            );

            res.json({
                success: true,
                data: result.declaration,
                items: result.items,
                stats: result.stats,
                errors: result.errors,
            });
        } catch (error) {
            if (error.message.includes('No access')) {
                return res.status(403).json({ success: false, error: error.message });
            }
            next(error);
        }
    },

    // ==========================================
    // ITEMS
    // ==========================================

    /**
     * PUT /declarations/:id/items/:field
     * Update specific item value (manual override)
     */
    async updateItem(req, res, next) {
        try {
            const { id, field } = req.params;
            const { value } = req.body;
            const userId = req.user.id;

            if (value === undefined || value === null) {
                return res.status(400).json({
                    success: false,
                    error: 'value is required',
                });
            }

            const item = await declarationsService.updateItem(id, field, value, userId);

            res.json({
                success: true,
                data: item,
            });
        } catch (error) {
            if (error.message.includes('not found')) {
                return res.status(404).json({ success: false, error: error.message });
            }
            if (error.message.includes('No access')) {
                return res.status(403).json({ success: false, error: error.message });
            }
            if (error.message.includes('Cannot update')) {
                return res.status(409).json({ success: false, error: error.message });
            }
            next(error);
        }
    },

    // ==========================================
    // VALIDATION & WORKFLOW
    // ==========================================

    /**
     * POST /declarations/:id/validate
     * Validate declaration and transition to validated status
     */
    async validate(req, res, next) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            const result = await declarationsService.validate(id, userId);

            res.json({
                success: true,
                data: result.declaration,
                validation: result.validation,
            });
        } catch (error) {
            if (error.message.includes('not found')) {
                return res.status(404).json({ success: false, error: error.message });
            }
            if (error.message.includes('No access')) {
                return res.status(403).json({ success: false, error: error.message });
            }
            if (error.message.includes('Missing required') || error.message.includes('has no items')) {
                return res.status(422).json({ success: false, error: error.message });
            }
            next(error);
        }
    },

    /**
     * PUT /declarations/:id/status
     * Manually transition declaration status
     */
    async updateStatus(req, res, next) {
        try {
            const { id } = req.params;
            const { status } = req.body;
            const userId = req.user.id;

            if (!status) {
                return res.status(400).json({
                    success: false,
                    error: 'status is required',
                });
            }

            const updated = await declarationsService.transitionStatus(id, status, userId);

            res.json({
                success: true,
                data: updated,
            });
        } catch (error) {
            if (error.message.includes('not found')) {
                return res.status(404).json({ success: false, error: error.message });
            }
            if (error.message.includes('No access')) {
                return res.status(403).json({ success: false, error: error.message });
            }
            if (error.message.includes('Cannot transition')) {
                return res.status(409).json({ success: false, error: error.message });
            }
            next(error);
        }
    },

    /**
     * GET /declarations/:id/transitions
     * Get available status transitions
     */
    async getTransitions(req, res, next) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            const declaration = await declarationsService.getById(id, userId);
            const transitions = declarationsService.getAvailableTransitions(declaration.status);

            res.json({
                success: true,
                data: {
                    currentStatus: declaration.status,
                    availableTransitions: transitions,
                },
            });
        } catch (error) {
            if (error.message.includes('not found')) {
                return res.status(404).json({ success: false, error: error.message });
            }
            if (error.message.includes('No access')) {
                return res.status(403).json({ success: false, error: error.message });
            }
            next(error);
        }
    },

    // ==========================================
    // SUMMARY
    // ==========================================

    /**
     * GET /declarations/:id/summary
     * Get declaration summary for display
     */
    async getSummary(req, res, next) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            const summary = await declarationsService.getSummary(id, userId);

            res.json({
                success: true,
                data: summary,
            });
        } catch (error) {
            if (error.message.includes('not found')) {
                return res.status(404).json({ success: false, error: error.message });
            }
            if (error.message.includes('No access')) {
                return res.status(403).json({ success: false, error: error.message });
            }
            next(error);
        }
    },
};

module.exports = declarationsController;
