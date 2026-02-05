const db = require('../../db/postgres');
const crypto = require('crypto');

const sourcesRepository = {
    // ==========================================
    // CREATE
    // ==========================================

    /**
     * Create new source record (immutable audit log entry)
     * @param {Object} data - Source record data
     * @returns {Promise<Object>}
     */
    async create({ taxIdentityId, sourceType, externalId, rawPayload, importedBy }) {
        // Generate checksum from raw payload for deduplication
        const checksum = this.generateChecksum(rawPayload);

        const result = await db.query(
            `INSERT INTO source_records (
                tax_identity_id, source_type, external_id, checksum, raw_payload, imported_by
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *`,
            [taxIdentityId, sourceType, externalId || null, checksum, rawPayload, importedBy]
        );
        return result.rows[0];
    },

    /**
     * Bulk create source records
     * @param {Array} records - Array of source record data
     * @returns {Promise<Array>}
     */
    async bulkCreate(records) {
        const client = await db.getClient();
        try {
            await client.query('BEGIN');

            const results = [];
            for (const record of records) {
                const checksum = this.generateChecksum(record.rawPayload);
                const result = await client.query(
                    `INSERT INTO source_records (
                        tax_identity_id, source_type, external_id, checksum, raw_payload, imported_by
                    )
                    VALUES ($1, $2, $3, $4, $5, $6)
                    ON CONFLICT (tax_identity_id, checksum) WHERE checksum IS NOT NULL
                    DO NOTHING
                    RETURNING *`,
                    [record.taxIdentityId, record.sourceType, record.externalId || null, checksum, record.rawPayload, record.importedBy]
                );
                if (result.rows[0]) {
                    results.push(result.rows[0]);
                }
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

    // ==========================================
    // READ
    // ==========================================

    /**
     * Find source record by ID
     * @param {string} id - Source record UUID
     * @returns {Promise<Object|null>}
     */
    async findById(id) {
        const result = await db.query(
            `SELECT 
                sr.*,
                u.email AS imported_by_email
            FROM source_records sr
            LEFT JOIN users u ON u.id = sr.imported_by
            WHERE sr.id = $1`,
            [id]
        );
        return result.rows[0] || null;
    },

    /**
     * Find source record by external ID
     * @param {string} taxIdentityId
     * @param {string} externalId
     * @returns {Promise<Object|null>}
     */
    async findByExternalId(taxIdentityId, externalId) {
        const result = await db.query(
            `SELECT * FROM source_records 
            WHERE tax_identity_id = $1 AND external_id = $2`,
            [taxIdentityId, externalId]
        );
        return result.rows[0] || null;
    },

    /**
     * Check if record with same checksum exists (deduplication)
     * @param {string} taxIdentityId
     * @param {string} checksum
     * @returns {Promise<Object|null>}
     */
    async findByChecksum(taxIdentityId, checksum) {
        const result = await db.query(
            `SELECT * FROM source_records 
            WHERE tax_identity_id = $1 AND checksum = $2`,
            [taxIdentityId, checksum]
        );
        return result.rows[0] || null;
    },

    /**
     * List source records for tax identity with pagination and filters
     * @param {string} taxIdentityId
     * @param {Object} options - Filter options
     * @returns {Promise<Object>}
     */
    async listByTaxIdentity(taxIdentityId, options = {}) {
        const {
            sourceType,
            isActive = true,
            startDate,
            endDate,
            page = 1,
            limit = 50,
            sortBy = 'imported_at',
            sortOrder = 'DESC'
        } = options;

        const conditions = ['sr.tax_identity_id = $1'];
        const params = [taxIdentityId];
        let paramIndex = 2;

        if (isActive !== null) {
            conditions.push(`sr.is_active = $${paramIndex}`);
            params.push(isActive);
            paramIndex++;
        }

        if (sourceType) {
            conditions.push(`sr.source_type = $${paramIndex}`);
            params.push(sourceType);
            paramIndex++;
        }

        if (startDate) {
            conditions.push(`sr.imported_at >= $${paramIndex}`);
            params.push(startDate);
            paramIndex++;
        }

        if (endDate) {
            conditions.push(`sr.imported_at <= $${paramIndex}`);
            params.push(endDate);
            paramIndex++;
        }

        const whereClause = conditions.join(' AND ');
        const offset = (page - 1) * limit;

        // Validate sort column
        const allowedSortColumns = ['imported_at', 'source_type', 'created_at'];
        const sortColumn = allowedSortColumns.includes(sortBy) ? sortBy : 'imported_at';
        const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        // Get total count
        const countResult = await db.query(
            `SELECT COUNT(*) as total FROM source_records sr WHERE ${whereClause}`,
            params
        );
        const total = parseInt(countResult.rows[0].total, 10);

        // Get records
        const result = await db.query(
            `SELECT 
                sr.id,
                sr.tax_identity_id,
                sr.source_type,
                sr.external_id,
                sr.checksum,
                sr.imported_by,
                sr.imported_at,
                sr.is_active,
                u.email AS imported_by_email
            FROM source_records sr
            LEFT JOIN users u ON u.id = sr.imported_by
            WHERE ${whereClause}
            ORDER BY sr.${sortColumn} ${order}
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            [...params, limit, offset]
        );

        return {
            records: result.rows,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    },

    /**
     * Get source record with full raw_payload
     * @param {string} id
     * @returns {Promise<Object|null>}
     */
    async getWithPayload(id) {
        const result = await db.query(
            `SELECT * FROM source_records WHERE id = $1`,
            [id]
        );
        return result.rows[0] || null;
    },

    /**
     * Get statistics for tax identity
     * @param {string} taxIdentityId
     * @returns {Promise<Object>}
     */
    async getStatsByTaxIdentity(taxIdentityId) {
        const result = await db.query(
            `SELECT 
                source_type,
                COUNT(*) as count,
                MIN(imported_at) as first_import,
                MAX(imported_at) as last_import
            FROM source_records
            WHERE tax_identity_id = $1 AND is_active = true
            GROUP BY source_type
            ORDER BY count DESC`,
            [taxIdentityId]
        );

        const totalResult = await db.query(
            `SELECT COUNT(*) as total FROM source_records 
            WHERE tax_identity_id = $1 AND is_active = true`,
            [taxIdentityId]
        );

        return {
            total: parseInt(totalResult.rows[0].total, 10),
            bySourceType: result.rows,
        };
    },

    // ==========================================
    // UPDATE (soft operations only - immutable log)
    // ==========================================

    /**
     * Deactivate source record (soft delete for audit)
     * @param {string} id
     * @returns {Promise<Object>}
     */
    async deactivate(id) {
        const result = await db.query(
            `UPDATE source_records 
            SET is_active = false 
            WHERE id = $1 
            RETURNING *`,
            [id]
        );
        return result.rows[0];
    },

    /**
     * Reactivate source record
     * @param {string} id
     * @returns {Promise<Object>}
     */
    async reactivate(id) {
        const result = await db.query(
            `UPDATE source_records 
            SET is_active = true 
            WHERE id = $1 
            RETURNING *`,
            [id]
        );
        return result.rows[0];
    },

    /**
     * Bulk deactivate source records
     * @param {Array<string>} ids
     * @returns {Promise<number>}
     */
    async bulkDeactivate(ids) {
        const result = await db.query(
            `UPDATE source_records 
            SET is_active = false 
            WHERE id = ANY($1)`,
            [ids]
        );
        return result.rowCount;
    },

    // ==========================================
    // UTILITIES
    // ==========================================

    /**
     * Generate checksum from payload for deduplication
     * @param {Object} payload
     * @returns {string}
     */
    generateChecksum(payload) {
        const normalized = JSON.stringify(payload, Object.keys(payload).sort());
        return crypto.createHash('sha256').update(normalized).digest('hex');
    },

    /**
     * Check if source record exists and is active
     * @param {string} id
     * @returns {Promise<boolean>}
     */
    async exists(id) {
        const result = await db.query(
            `SELECT 1 FROM source_records WHERE id = $1 AND is_active = true`,
            [id]
        );
        return result.rowCount > 0;
    },
};

module.exports = sourcesRepository;