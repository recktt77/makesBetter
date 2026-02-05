const taxEventsService = require('./taxEvents.service');

const taxEventsController = {
    // ==========================================
    // PARSING ENDPOINTS
    // ==========================================

    /**
     * Parse source record into tax events
     * POST /api/tax-events/parse/:sourceRecordId
     */
    async parseSourceRecord(req, res, next) {
        try {
            const userId = req.user.id;
            const { sourceRecordId } = req.params;

            const result = await taxEventsService.parseSourceRecord(sourceRecordId, userId);

            res.status(201).json({
                success: true,
                data: result,
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Re-parse source record (delete and parse again)
     * POST /api/tax-events/reparse/:sourceRecordId
     */
    async reparseSourceRecord(req, res, next) {
        try {
            const userId = req.user.id;
            const { sourceRecordId } = req.params;

            const result = await taxEventsService.reparseSourceRecord(sourceRecordId, userId);

            res.status(200).json({
                success: true,
                data: result,
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Parse all unparsed sources for tax identity
     * POST /api/tax-events/parse-all/:taxIdentityId
     */
    async parseAllForIdentity(req, res, next) {
        try {
            const userId = req.user.id;
            const { taxIdentityId } = req.params;

            const result = await taxEventsService.parseAllForIdentity(taxIdentityId, userId);

            res.status(200).json({
                success: true,
                data: result,
            });
        } catch (error) {
            next(error);
        }
    },

    // ==========================================
    // READ ENDPOINTS
    // ==========================================

    /**
     * List tax events for tax identity
     * GET /api/tax-events/:taxIdentityId
     */
    async listEvents(req, res, next) {
        try {
            const userId = req.user.id;
            const { taxIdentityId } = req.params;
            const { taxYear, eventType, startDate, endDate, page, limit, sortBy, sortOrder } = req.query;

            const options = {
                taxYear: taxYear ? parseInt(taxYear, 10) : null,
                eventType,
                startDate,
                endDate,
                page: parseInt(page, 10) || 1,
                limit: Math.min(parseInt(limit, 10) || 50, 100),
                sortBy,
                sortOrder,
            };

            const result = await taxEventsService.listEvents(userId, taxIdentityId, options);

            res.status(200).json({
                success: true,
                data: result,
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Get single tax event
     * GET /api/tax-events/event/:id
     */
    async getEvent(req, res, next) {
        try {
            const userId = req.user.id;
            const { id } = req.params;

            const event = await taxEventsService.getEvent(userId, id);

            res.status(200).json({
                success: true,
                data: event,
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Get events by source record
     * GET /api/tax-events/by-source/:sourceRecordId
     */
    async getEventsBySource(req, res, next) {
        try {
            const userId = req.user.id;
            const { sourceRecordId } = req.params;

            const events = await taxEventsService.getEventsBySource(userId, sourceRecordId);

            res.status(200).json({
                success: true,
                data: events,
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Get summary for tax year
     * GET /api/tax-events/:taxIdentityId/summary/:taxYear
     */
    async getSummary(req, res, next) {
        try {
            const userId = req.user.id;
            const { taxIdentityId, taxYear } = req.params;

            const summary = await taxEventsService.getSummary(userId, taxIdentityId, parseInt(taxYear, 10));

            res.status(200).json({
                success: true,
                data: summary,
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Get available tax years
     * GET /api/tax-events/:taxIdentityId/years
     */
    async getAvailableYears(req, res, next) {
        try {
            const userId = req.user.id;
            const { taxIdentityId } = req.params;

            const years = await taxEventsService.getAvailableYears(userId, taxIdentityId);

            res.status(200).json({
                success: true,
                data: years,
            });
        } catch (error) {
            next(error);
        }
    },

    // ==========================================
    // EVENT TYPES ENDPOINTS
    // ==========================================

    /**
     * Get all event types
     * GET /api/tax-events/types
     */
    async getEventTypes(req, res, next) {
        try {
            const types = await taxEventsService.getEventTypes();

            res.status(200).json({
                success: true,
                data: types,
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Create event type (admin)
     * POST /api/tax-events/types
     */
    async createEventType(req, res, next) {
        try {
            const { code, description } = req.body;

            if (!code || !description) {
                return res.status(400).json({
                    success: false,
                    error: 'code and description are required',
                });
            }

            const eventType = await taxEventsService.createEventType(code, description);

            res.status(201).json({
                success: true,
                data: eventType,
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Create single tax event manually
     * POST /api/tax-events
     */
    async createEvent(req, res, next) {
        try {
            const userId = req.user.id;
            const { taxIdentityId, eventType, eventDate, amount, currency, metadata } = req.body;

            if (!taxIdentityId || !eventType || !eventDate) {
                return res.status(400).json({
                    success: false,
                    error: 'taxIdentityId, eventType and eventDate are required',
                });
            }

            const event = await taxEventsService.createEvent(userId, {
                taxIdentityId,
                eventType,
                eventDate,
                amount,
                currency,
                metadata,
            });

            res.status(201).json({
                success: true,
                data: event,
            });
        } catch (error) {
            next(error);
        }
    },
};

module.exports = taxEventsController;
