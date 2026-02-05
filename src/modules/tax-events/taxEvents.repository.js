const db = require('../../db/postgres');

const taxEventsRepository = {
    // ==========================================
    // TAX EVENT TYPES
    // ==========================================

    /**
     * Get all tax event types
     * @returns {Promise<Array>}
     */
    async getAllEventTypes() {
        const result = await db.query(
            `SELECT code, description FROM tax_event_types ORDER BY code`
        );
        return result.rows;
    },

    /**
     * Check if event type exists
     * @param {string} code
     * @returns {Promise<boolean>}
     */
    async eventTypeExists(code) {
        const result = await db.query(
            `SELECT 1 FROM tax_event_types WHERE code = $1`,
            [code]
        );
        return result.rowCount > 0;
    },

    /**
     * Create event type (admin only)
     * @param {string} code
     * @param {string} description
     * @returns {Promise<Object>}
     */
    async createEventType(code, description) {
        const result = await db.query(
            `INSERT INTO tax_event_types (code, description)
            VALUES ($1, $2)
            ON CONFLICT (code) DO NOTHING
            RETURNING *`,
            [code, description]
        );
        return result.rows[0];
    },

    // ==========================================
    // TAX EVENTS CRUD
    // ==========================================

    /**
     * Insert single tax event
     * @param {Object} event - Tax event data
     * @returns {Promise<Object>}
     */
    async insert(event) {
        const {
            taxIdentityId,
            sourceRecordId,
            eventType,
            eventDate,
            amount,
            currency,
            metadata
        } = event;

        const result = await db.query(
            `INSERT INTO tax_events (
                tax_identity_id, source_record_id, event_type,
                event_date, amount, currency, metadata
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *`,
            [
                taxIdentityId,
                sourceRecordId,
                eventType,
                eventDate,
                amount || null,
                currency || null,
                metadata || null
            ]
        );
        return result.rows[0];
    },

    /**
     * Bulk insert tax events (transactional)
     * @param {Array} events - Array of tax events
     * @returns {Promise<Array>}
     */
    async bulkInsert(events) {
        if (!events || events.length === 0) {
            return [];
        }

        const client = await db.getClient();
        try {
            await client.query('BEGIN');

            const results = [];
            for (const event of events) {
                const result = await client.query(
                    `INSERT INTO tax_events (
                        tax_identity_id, source_record_id, event_type,
                        event_date, amount, currency, metadata
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    RETURNING *`,
                    [
                        event.taxIdentityId,
                        event.sourceRecordId,
                        event.eventType,
                        event.eventDate,
                        event.amount || null,
                        event.currency || null,
                        event.metadata || null
                    ]
                );
                results.push(result.rows[0]);
            }

            await client.query('COMMIT');
            return results;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Check if events exist for source record (idempotency)
     * @param {string} sourceRecordId
     * @returns {Promise<boolean>}
     */
    async existsBySourceRecord(sourceRecordId) {
        const result = await db.query(
            `SELECT 1 FROM tax_events WHERE source_record_id = $1 LIMIT 1`,
            [sourceRecordId]
        );
        return result.rowCount > 0;
    },

    /**
     * Find all events by source record
     * @param {string} sourceRecordId
     * @returns {Promise<Array>}
     */
    async findBySourceRecord(sourceRecordId) {
        const result = await db.query(
            `SELECT * FROM tax_events 
            WHERE source_record_id = $1
            ORDER BY event_date`,
            [sourceRecordId]
        );
        return result.rows;
    },

    /**
     * Find event by ID
     * @param {string} id
     * @returns {Promise<Object|null>}
     */
    async findById(id) {
        const result = await db.query(
            `SELECT 
                te.*,
                tet.description AS event_type_description
            FROM tax_events te
            JOIN tax_event_types tet ON tet.code = te.event_type
            WHERE te.id = $1`,
            [id]
        );
        return result.rows[0] || null;
    },

    /**
     * List events by tax identity with filters
     * @param {string} taxIdentityId
     * @param {Object} options
     * @returns {Promise<Object>}
     */
    async listByTaxIdentity(taxIdentityId, options = {}) {
        const {
            taxYear,
            eventType,
            startDate,
            endDate,
            page = 1,
            limit = 50,
            sortBy = 'event_date',
            sortOrder = 'DESC'
        } = options;

        const conditions = ['te.tax_identity_id = $1'];
        const params = [taxIdentityId];
        let paramIndex = 2;

        if (taxYear) {
            conditions.push(`te.tax_year = $${paramIndex}`);
            params.push(taxYear);
            paramIndex++;
        }

        if (eventType) {
            conditions.push(`te.event_type = $${paramIndex}`);
            params.push(eventType);
            paramIndex++;
        }

        if (startDate) {
            conditions.push(`te.event_date >= $${paramIndex}`);
            params.push(startDate);
            paramIndex++;
        }

        if (endDate) {
            conditions.push(`te.event_date <= $${paramIndex}`);
            params.push(endDate);
            paramIndex++;
        }

        const whereClause = conditions.join(' AND ');
        const offset = (page - 1) * limit;

        // Validate sort column
        const allowedSortColumns = ['event_date', 'amount', 'created_at', 'event_type'];
        const sortColumn = allowedSortColumns.includes(sortBy) ? sortBy : 'event_date';
        const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        // Get total count
        const countResult = await db.query(
            `SELECT COUNT(*) as total FROM tax_events te WHERE ${whereClause}`,
            params
        );
        const total = parseInt(countResult.rows[0].total, 10);

        // Get events
        const result = await db.query(
            `SELECT 
                te.*,
                tet.description AS event_type_description
            FROM tax_events te
            JOIN tax_event_types tet ON tet.code = te.event_type
            WHERE ${whereClause}
            ORDER BY te.${sortColumn} ${order}
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            [...params, limit, offset]
        );

        return {
            events: result.rows,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    },

    /**
     * Get summary by tax year
     * @param {string} taxIdentityId
     * @param {number} taxYear
     * @returns {Promise<Object>}
     */
    async getSummaryByYear(taxIdentityId, taxYear) {
        const result = await db.query(
            `SELECT 
                te.event_type,
                tet.description,
                COUNT(*) as count,
                SUM(te.amount) as total_amount,
                MIN(te.event_date) as first_event,
                MAX(te.event_date) as last_event
            FROM tax_events te
            JOIN tax_event_types tet ON tet.code = te.event_type
            WHERE te.tax_identity_id = $1 AND te.tax_year = $2
            GROUP BY te.event_type, tet.description
            ORDER BY total_amount DESC NULLS LAST`,
            [taxIdentityId, taxYear]
        );

        const totalResult = await db.query(
            `SELECT 
                COUNT(*) as total_events,
                SUM(amount) as total_amount
            FROM tax_events
            WHERE tax_identity_id = $1 AND tax_year = $2`,
            [taxIdentityId, taxYear]
        );

        return {
            taxYear,
            totalEvents: parseInt(totalResult.rows[0].total_events, 10),
            totalAmount: parseFloat(totalResult.rows[0].total_amount) || 0,
            byEventType: result.rows,
        };
    },

    /**
     * Get available tax years for identity
     * @param {string} taxIdentityId
     * @returns {Promise<Array>}
     */
    async getAvailableYears(taxIdentityId) {
        const result = await db.query(
            `SELECT DISTINCT tax_year, COUNT(*) as events_count
            FROM tax_events
            WHERE tax_identity_id = $1
            GROUP BY tax_year
            ORDER BY tax_year DESC`,
            [taxIdentityId]
        );
        return result.rows;
    },

    /**
     * Delete events by source record (for re-parsing)
     * @param {string} sourceRecordId
     * @returns {Promise<number>}
     */
    async deleteBySourceRecord(sourceRecordId) {
        const result = await db.query(
            `DELETE FROM tax_events WHERE source_record_id = $1`,
            [sourceRecordId]
        );
        return result.rowCount;
    },
};

module.exports = taxEventsRepository;
