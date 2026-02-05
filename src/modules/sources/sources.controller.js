const sourcesService = require('./sources.service');

const sourcesController = {
    // ==========================================
    // CREATE
    // ==========================================

    /**
     * Import single source record
     * POST /api/sources/:taxIdentityId
     */
    async importRecord(req, res, next) {
        try {
            const userId = req.user.id;
            const { taxIdentityId } = req.params;
            const { sourceType, externalId, rawPayload } = req.body;

            if (!sourceType || !rawPayload) {
                return res.status(400).json({
                    success: false,
                    error: 'sourceType и rawPayload обязательны',
                });
            }

            const result = await sourcesService.importRecord(userId, taxIdentityId, {
                sourceType,
                externalId,
                rawPayload,
            });

            res.status(201).json({
                success: true,
                data: result,
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Bulk import source records
     * POST /api/sources/:taxIdentityId/bulk
     */
    async bulkImport(req, res, next) {
        try {
            const userId = req.user.id;
            const { taxIdentityId } = req.params;
            const { records } = req.body;

            if (!records || !Array.isArray(records)) {
                return res.status(400).json({
                    success: false,
                    error: 'records должен быть массивом',
                });
            }

            const result = await sourcesService.bulkImport(userId, taxIdentityId, records);

            res.status(201).json({
                success: true,
                data: result,
            });
        } catch (error) {
            next(error);
        }
    },

    // ==========================================
    // READ
    // ==========================================

    /**
     * List source records for tax identity
     * GET /api/sources/:taxIdentityId
     */
    async listRecords(req, res, next) {
        try {
            const userId = req.user.id;
            const { taxIdentityId } = req.params;
            const {
                sourceType,
                isActive,
                startDate,
                endDate,
                page,
                limit,
                sortBy,
                sortOrder,
            } = req.query;

            const options = {
                sourceType,
                isActive: isActive === 'false' ? false : isActive === 'true' ? true : null,
                startDate,
                endDate,
                page: parseInt(page, 10) || 1,
                limit: Math.min(parseInt(limit, 10) || 50, 100),
                sortBy,
                sortOrder,
            };

            const result = await sourcesService.listRecords(userId, taxIdentityId, options);

            res.status(200).json({
                success: true,
                data: result,
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Get single source record
     * GET /api/sources/record/:id
     */
    async getRecord(req, res, next) {
        try {
            const userId = req.user.id;
            const { id } = req.params;

            const record = await sourcesService.getRecord(userId, id);

            res.status(200).json({
                success: true,
                data: record,
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Get source record with full payload
     * GET /api/sources/record/:id/payload
     */
    async getRecordWithPayload(req, res, next) {
        try {
            const userId = req.user.id;
            const { id } = req.params;

            const record = await sourcesService.getRecordWithPayload(userId, id);

            res.status(200).json({
                success: true,
                data: record,
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Get import statistics
     * GET /api/sources/:taxIdentityId/stats
     */
    async getStats(req, res, next) {
        try {
            const userId = req.user.id;
            const { taxIdentityId } = req.params;

            const stats = await sourcesService.getStats(userId, taxIdentityId);

            res.status(200).json({
                success: true,
                data: stats,
            });
        } catch (error) {
            next(error);
        }
    },

    // ==========================================
    // UPDATE (soft operations)
    // ==========================================

    /**
     * Deactivate source record
     * DELETE /api/sources/record/:id
     */
    async deactivateRecord(req, res, next) {
        try {
            const userId = req.user.id;
            const { id } = req.params;

            const record = await sourcesService.deactivateRecord(userId, id);

            res.status(200).json({
                success: true,
                data: record,
                message: 'Запись деактивирована',
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Reactivate source record
     * POST /api/sources/record/:id/reactivate
     */
    async reactivateRecord(req, res, next) {
        try {
            const userId = req.user.id;
            const { id } = req.params;

            const record = await sourcesService.reactivateRecord(userId, id);

            res.status(200).json({
                success: true,
                data: record,
                message: 'Запись активирована',
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Bulk deactivate source records
     * POST /api/sources/:taxIdentityId/bulk-deactivate
     */
    async bulkDeactivate(req, res, next) {
        try {
            const userId = req.user.id;
            const { taxIdentityId } = req.params;
            const { recordIds } = req.body;

            if (!recordIds || !Array.isArray(recordIds)) {
                return res.status(400).json({
                    success: false,
                    error: 'recordIds должен быть массивом',
                });
            }

            const result = await sourcesService.bulkDeactivate(userId, taxIdentityId, recordIds);

            res.status(200).json({
                success: true,
                data: result,
            });
        } catch (error) {
            next(error);
        }
    },
};

module.exports = sourcesController;