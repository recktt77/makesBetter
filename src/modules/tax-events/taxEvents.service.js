const taxEventsRepository = require('./taxEvents.repository');
const taxEventsParser = require('./taxEvents.parser');
const sourcesRepository = require('../sources/sources.repository');
const identitiesRepository = require('../identities/identities.repository');

const taxEventsService = {
    // ==========================================
    // PARSING (MAIN ORCHESTRATION)
    // ==========================================

    /**
     * Parse source record and create tax events
     * This is the main entry point for converting raw data to tax events
     * 
     * @param {string} sourceRecordId - Source record UUID
     * @param {string} userId - User performing the operation
     * @returns {Promise<Object>}
     */
    async parseSourceRecord(sourceRecordId, userId) {
        // 1. Get source record
        const sourceRecord = await sourcesRepository.getWithPayload(sourceRecordId);

        if (!sourceRecord) {
            throw new Error('Source record not found');
        }

        // 2. Check if source is active
        if (!sourceRecord.is_active) {
            throw new Error('Source record is deactivated');
        }

        // 3. Check user access to tax identity
        const hasAccess = await identitiesRepository.userHasAccess(userId, sourceRecord.tax_identity_id);
        if (!hasAccess) {
            throw new Error('No access to this tax identity');
        }

        // 4. IDEMPOTENCY CHECK - if events already exist, return them
        const existingEvents = await taxEventsRepository.existsBySourceRecord(sourceRecordId);
        if (existingEvents) {
            const events = await taxEventsRepository.findBySourceRecord(sourceRecordId);
            return {
                created: 0,
                skipped: events.length,
                message: 'Source record already parsed',
                events,
            };
        }

        // 5. Parse source record into events
        const parsedEvents = taxEventsParser.parse(sourceRecord);

        // 6. Validate all event types exist
        for (const event of parsedEvents) {
            const typeExists = await taxEventsRepository.eventTypeExists(event.eventType);
            if (!typeExists) {
                throw new Error(`Unknown event type: ${event.eventType}`);
            }
        }

        // 7. Insert events (transactional)
        const insertedEvents = await taxEventsRepository.bulkInsert(parsedEvents);

        return {
            created: insertedEvents.length,
            skipped: 0,
            message: `Created ${insertedEvents.length} tax events`,
            events: insertedEvents,
        };
    },

    /**
     * Re-parse source record (delete existing events and parse again)
     * Use with caution - only for fixing parsing errors
     * 
     * @param {string} sourceRecordId
     * @param {string} userId
     * @returns {Promise<Object>}
     */
    async reparseSourceRecord(sourceRecordId, userId) {
        // Get source record
        const sourceRecord = await sourcesRepository.getWithPayload(sourceRecordId);

        if (!sourceRecord) {
            throw new Error('Source record not found');
        }

        // Only owner can re-parse
        const hasAccess = await identitiesRepository.userHasAccess(userId, sourceRecord.tax_identity_id, ['owner']);
        if (!hasAccess) {
            throw new Error('Only owner can re-parse source records');
        }

        // Delete existing events
        const deletedCount = await taxEventsRepository.deleteBySourceRecord(sourceRecordId);

        // Parse again
        const result = await this.parseSourceRecord(sourceRecordId, userId);

        return {
            ...result,
            deleted: deletedCount,
            message: `Deleted ${deletedCount} old events, created ${result.created} new events`,
        };
    },

    /**
     * Parse all unparsed source records for a tax identity
     * @param {string} taxIdentityId
     * @param {string} userId
     * @returns {Promise<Object>}
     */
    async parseAllForIdentity(taxIdentityId, userId) {
        // Check access
        const hasAccess = await identitiesRepository.userHasAccess(userId, taxIdentityId);
        if (!hasAccess) {
            throw new Error('No access to this tax identity');
        }

        // Get all active source records
        const sourcesResult = await sourcesRepository.listByTaxIdentity(taxIdentityId, {
            isActive: true,
            limit: 1000,
        });

        const results = {
            total: sourcesResult.records.length,
            parsed: 0,
            skipped: 0,
            errors: [],
        };

        for (const source of sourcesResult.records) {
            try {
                const parseResult = await this.parseSourceRecord(source.id, userId);
                if (parseResult.created > 0) {
                    results.parsed++;
                } else {
                    results.skipped++;
                }
            } catch (error) {
                results.errors.push({
                    sourceId: source.id,
                    error: error.message,
                });
            }
        }

        return results;
    },

    // ==========================================
    // READ OPERATIONS
    // ==========================================

    /**
     * Get tax events for a tax identity
     * @param {string} userId
     * @param {string} taxIdentityId
     * @param {Object} options
     * @returns {Promise<Object>}
     */
    async listEvents(userId, taxIdentityId, options = {}) {
        // Check access
        const hasAccess = await identitiesRepository.userHasAccess(userId, taxIdentityId);
        if (!hasAccess) {
            throw new Error('No access to this tax identity');
        }

        return await taxEventsRepository.listByTaxIdentity(taxIdentityId, options);
    },

    /**
     * Get single tax event
     * @param {string} userId
     * @param {string} eventId
     * @returns {Promise<Object>}
     */
    async getEvent(userId, eventId) {
        const event = await taxEventsRepository.findById(eventId);

        if (!event) {
            throw new Error('Tax event not found');
        }

        // Check access
        const hasAccess = await identitiesRepository.userHasAccess(userId, event.tax_identity_id);
        if (!hasAccess) {
            throw new Error('No access to this tax event');
        }

        return event;
    },

    /**
     * Get events by source record
     * @param {string} userId
     * @param {string} sourceRecordId
     * @returns {Promise<Array>}
     */
    async getEventsBySource(userId, sourceRecordId) {
        // Get source record to check access
        const sourceRecord = await sourcesRepository.findById(sourceRecordId);

        if (!sourceRecord) {
            throw new Error('Source record not found');
        }

        const hasAccess = await identitiesRepository.userHasAccess(userId, sourceRecord.tax_identity_id);
        if (!hasAccess) {
            throw new Error('No access to this source record');
        }

        return await taxEventsRepository.findBySourceRecord(sourceRecordId);
    },

    /**
     * Get summary for tax year
     * @param {string} userId
     * @param {string} taxIdentityId
     * @param {number} taxYear
     * @returns {Promise<Object>}
     */
    async getSummary(userId, taxIdentityId, taxYear) {
        // Check access
        const hasAccess = await identitiesRepository.userHasAccess(userId, taxIdentityId);
        if (!hasAccess) {
            throw new Error('No access to this tax identity');
        }

        return await taxEventsRepository.getSummaryByYear(taxIdentityId, taxYear);
    },

    /**
     * Get available tax years
     * @param {string} userId
     * @param {string} taxIdentityId
     * @returns {Promise<Array>}
     */
    async getAvailableYears(userId, taxIdentityId) {
        // Check access
        const hasAccess = await identitiesRepository.userHasAccess(userId, taxIdentityId);
        if (!hasAccess) {
            throw new Error('No access to this tax identity');
        }

        return await taxEventsRepository.getAvailableYears(taxIdentityId);
    },

    // ==========================================
    // EVENT TYPES
    // ==========================================

    /**
     * Get all event types
     * @returns {Promise<Array>}
     */
    async getEventTypes() {
        return await taxEventsRepository.getAllEventTypes();
    },

    /**
     * Create event type (admin only)
     * @param {string} code
     * @param {string} description
     * @returns {Promise<Object>}
     */
    async createEventType(code, description) {
        if (!code || !description) {
            throw new Error('Code and description are required');
        }

        // Validate code format
        if (!/^[A-Z_]+$/.test(code)) {
            throw new Error('Code must be uppercase letters and underscores only');
        }

        return await taxEventsRepository.createEventType(code, description);
    },

    /**
     * Create single tax event manually
     * @param {string} userId - User creating the event
     * @param {Object} eventData - Event data
     * @returns {Promise<Object>}
     */
    async createEvent(userId, eventData) {
        const { taxIdentityId, eventType, eventDate, amount, currency, metadata } = eventData;

        // Validate required fields
        if (!taxIdentityId) throw new Error('taxIdentityId is required');
        if (!eventType) throw new Error('eventType is required');
        if (!eventDate) throw new Error('eventDate is required');

        // Check access
        const hasAccess = await identitiesRepository.userHasAccess(userId, taxIdentityId);
        if (!hasAccess) {
            throw new Error('No access to this tax identity');
        }

        // Validate event type exists
        const typeExists = await taxEventsRepository.eventTypeExists(eventType);
        if (!typeExists) {
            throw new Error(`Unknown event type: ${eventType}`);
        }

        // Create source record for manual entry
        const sourceRecord = await sourcesRepository.create({
            taxIdentityId,
            sourceType: 'manual',
            rawPayload: { ...eventData, createdBy: userId },
            importedBy: userId,
        });

        // Insert the event
        const event = await taxEventsRepository.insert({
            taxIdentityId,
            sourceRecordId: sourceRecord.id,
            eventType,
            eventDate,
            amount: amount || 0,
            currency: currency || 'KZT',
            metadata: metadata || {},
        });

        return event;
    },
};

module.exports = taxEventsService;
