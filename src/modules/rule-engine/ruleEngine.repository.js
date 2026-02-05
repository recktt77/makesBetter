const db = require('../../db/postgres');

const ruleEngineRepository = {
    // ==========================================
    // LOGICAL FIELDS
    // ==========================================

    /**
     * Get all logical fields
     * @returns {Promise<Array>}
     */
    async getAllLogicalFields() {
        const result = await db.query(
            `SELECT code, description FROM logical_fields ORDER BY code`
        );
        return result.rows;
    },

    /**
     * Check if logical field exists
     * @param {string} code
     * @returns {Promise<boolean>}
     */
    async logicalFieldExists(code) {
        const result = await db.query(
            `SELECT 1 FROM logical_fields WHERE code = $1`,
            [code]
        );
        return result.rowCount > 0;
    },

    /**
     * Create logical field
     * @param {string} code
     * @param {string} description
     * @returns {Promise<Object>}
     */
    async createLogicalField(code, description) {
        const result = await db.query(
            `INSERT INTO logical_fields (code, description)
            VALUES ($1, $2)
            ON CONFLICT (code) DO UPDATE SET description = $2
            RETURNING *`,
            [code, description]
        );
        return result.rows[0];
    },

    // ==========================================
    // TAX RULES CRUD
    // ==========================================

    /**
     * Get all active rules for tax year, ordered by priority
     * @param {number} taxYear
     * @returns {Promise<Array>}
     */
    async getActiveRules(taxYear) {
        const result = await db.query(
            `SELECT * FROM tax_rules 
            WHERE is_active = true 
            AND (tax_year = $1 OR tax_year IS NULL)
            ORDER BY priority ASC, created_at ASC`,
            [taxYear]
        );
        return result.rows;
    },

    /**
     * Get rules by type
     * @param {number} taxYear
     * @param {string} ruleType
     * @returns {Promise<Array>}
     */
    async getRulesByType(taxYear, ruleType) {
        const result = await db.query(
            `SELECT * FROM tax_rules 
            WHERE is_active = true 
            AND rule_type = $2
            AND (tax_year = $1 OR tax_year IS NULL)
            ORDER BY priority ASC`,
            [taxYear, ruleType]
        );
        return result.rows;
    },

    /**
     * Get rule by ID
     * @param {string} id
     * @returns {Promise<Object|null>}
     */
    async getRuleById(id) {
        const result = await db.query(
            `SELECT * FROM tax_rules WHERE id = $1`,
            [id]
        );
        return result.rows[0] || null;
    },

    /**
     * Create tax rule
     * @param {Object} rule
     * @returns {Promise<Object>}
     */
    async createRule({ ruleCode, taxYear, ruleType, conditions, actions, priority, isActive }) {
        const result = await db.query(
            `INSERT INTO tax_rules (rule_code, tax_year, rule_type, conditions, actions, priority, is_active)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *`,
            [
                ruleCode,
                taxYear || null,
                ruleType,
                conditions || null,
                actions || null,
                priority || 100,
                isActive !== false
            ]
        );
        return result.rows[0];
    },

    /**
     * Update tax rule
     * @param {string} id
     * @param {Object} updates
     * @returns {Promise<Object>}
     */
    async updateRule(id, { ruleCode, taxYear, ruleType, conditions, actions, priority, isActive }) {
        const result = await db.query(
            `UPDATE tax_rules SET
                rule_code = COALESCE($2, rule_code),
                tax_year = COALESCE($3, tax_year),
                rule_type = COALESCE($4, rule_type),
                conditions = COALESCE($5, conditions),
                actions = COALESCE($6, actions),
                priority = COALESCE($7, priority),
                is_active = COALESCE($8, is_active)
            WHERE id = $1
            RETURNING *`,
            [id, ruleCode, taxYear, ruleType, conditions, actions, priority, isActive]
        );
        return result.rows[0];
    },

    /**
     * Delete rule
     * @param {string} id
     * @returns {Promise<boolean>}
     */
    async deleteRule(id) {
        const result = await db.query(
            `DELETE FROM tax_rules WHERE id = $1`,
            [id]
        );
        return result.rowCount > 0;
    },

    /**
     * List all rules with pagination
     * @param {Object} options
     * @returns {Promise<Object>}
     */
    async listRules({ taxYear, ruleType, isActive, page = 1, limit = 50 }) {
        const conditions = [];
        const params = [];
        let paramIndex = 1;

        if (taxYear !== undefined) {
            conditions.push(`(tax_year = $${paramIndex} OR tax_year IS NULL)`);
            params.push(taxYear);
            paramIndex++;
        }

        if (ruleType) {
            conditions.push(`rule_type = $${paramIndex}`);
            params.push(ruleType);
            paramIndex++;
        }

        if (isActive !== undefined) {
            conditions.push(`is_active = $${paramIndex}`);
            params.push(isActive);
            paramIndex++;
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const offset = (page - 1) * limit;

        const countResult = await db.query(
            `SELECT COUNT(*) as total FROM tax_rules ${whereClause}`,
            params
        );

        const result = await db.query(
            `SELECT * FROM tax_rules ${whereClause}
            ORDER BY priority ASC, created_at DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            [...params, limit, offset]
        );

        return {
            rules: result.rows,
            pagination: {
                page,
                limit,
                total: parseInt(countResult.rows[0].total, 10),
                totalPages: Math.ceil(countResult.rows[0].total / limit),
            },
        };
    },

    // ==========================================
    // TAX MAPPINGS
    // ==========================================

    /**
     * Insert tax mapping
     * @param {Object} mapping
     * @returns {Promise<Object>}
     */
    async insertMapping({ taxEventId, taxYear, logicalField, amount, ruleId }) {
        const result = await db.query(
            `INSERT INTO tax_mappings (tax_event_id, tax_year, logical_field, amount, rule_id)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *`,
            [taxEventId, taxYear, logicalField, amount, ruleId]
        );
        return result.rows[0];
    },

    /**
     * Bulk insert tax mappings
     * @param {Array} mappings
     * @returns {Promise<Array>}
     */
    async bulkInsertMappings(mappings) {
        if (!mappings || mappings.length === 0) return [];

        const client = await db.getClient();
        try {
            await client.query('BEGIN');

            const results = [];
            for (const m of mappings) {
                const result = await client.query(
                    `INSERT INTO tax_mappings (tax_event_id, tax_year, logical_field, amount, rule_id)
                    VALUES ($1, $2, $3, $4, $5)
                    RETURNING *`,
                    [m.taxEventId, m.taxYear, m.logicalField, m.amount, m.ruleId]
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
     * Get mappings for tax identity and year
     * @param {string} taxIdentityId
     * @param {number} taxYear
     * @returns {Promise<Array>}
     */
    async getMappingsByIdentityYear(taxIdentityId, taxYear) {
        const result = await db.query(
            `SELECT tm.*, te.event_type, te.event_date, te.amount as event_amount
            FROM tax_mappings tm
            JOIN tax_events te ON te.id = tm.tax_event_id
            WHERE te.tax_identity_id = $1 AND tm.tax_year = $2
            ORDER BY te.event_date`,
            [taxIdentityId, taxYear]
        );
        return result.rows;
    },

    /**
     * Delete mappings for declaration recalculation
     * @param {string} taxIdentityId
     * @param {number} taxYear
     * @returns {Promise<number>}
     */
    async deleteMappingsByIdentityYear(taxIdentityId, taxYear) {
        const result = await db.query(
            `DELETE FROM tax_mappings tm
            USING tax_events te
            WHERE tm.tax_event_id = te.id
            AND te.tax_identity_id = $1
            AND tm.tax_year = $2`,
            [taxIdentityId, taxYear]
        );
        return result.rowCount;
    },

    // ==========================================
    // DECLARATIONS
    // ==========================================

    /**
     * Get or create declaration
     * @param {string} taxIdentityId
     * @param {number} taxYear
     * @param {string} formCode
     * @returns {Promise<Object>}
     */
    async getOrCreateDeclaration(taxIdentityId, taxYear, formCode = '270.00') {
        // Try to find existing
        let result = await db.query(
            `SELECT * FROM declarations 
            WHERE tax_identity_id = $1 AND tax_year = $2 AND form_code = $3`,
            [taxIdentityId, taxYear, formCode]
        );

        if (result.rows[0]) {
            return result.rows[0];
        }

        // Create new
        result = await db.query(
            `INSERT INTO declarations (tax_identity_id, tax_year, form_code, status)
            VALUES ($1, $2, $3, 'draft')
            RETURNING *`,
            [taxIdentityId, taxYear, formCode]
        );
        return result.rows[0];
    },

    /**
     * Get declaration by ID
     * @param {string} id
     * @returns {Promise<Object|null>}
     */
    async getDeclarationById(id) {
        const result = await db.query(
            `SELECT * FROM declarations WHERE id = $1`,
            [id]
        );
        return result.rows[0] || null;
    },

    /**
     * Update declaration flags
     * @param {string} id
     * @param {Object} flags
     * @returns {Promise<Object>}
     */
    async updateDeclarationFlags(id, flags) {
        const result = await db.query(
            `UPDATE declarations 
            SET flags = COALESCE(flags, '{}'::jsonb) || $2::jsonb
            WHERE id = $1
            RETURNING *`,
            [id, JSON.stringify(flags)]
        );
        return result.rows[0];
    },

    /**
     * Set declaration header snapshot
     * @param {string} id
     * @param {Object} header
     * @returns {Promise<Object>}
     */
    async setDeclarationHeader(id, { iin, fioLast, fioFirst, fioMiddle, phone, email }) {
        const result = await db.query(
            `UPDATE declarations SET
                iin = COALESCE($2, iin),
                fio_last = COALESCE($3, fio_last),
                fio_first = COALESCE($4, fio_first),
                fio_middle = COALESCE($5, fio_middle),
                payer_phone = COALESCE($6, payer_phone),
                email = COALESCE($7, email)
            WHERE id = $1
            RETURNING *`,
            [id, iin, fioLast, fioFirst, fioMiddle, phone, email]
        );
        return result.rows[0];
    },

    // ==========================================
    // DECLARATION ITEMS
    // ==========================================

    /**
     * Upsert declaration item
     * @param {string} declarationId
     * @param {string} logicalField
     * @param {number} value
     * @param {string} source
     * @returns {Promise<Object>}
     */
    async upsertDeclarationItem(declarationId, logicalField, value, source = 'rule_engine') {
        const result = await db.query(
            `INSERT INTO declaration_items (declaration_id, logical_field, value, source)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (declaration_id, logical_field) 
            DO UPDATE SET value = $3, source = $4
            RETURNING *`,
            [declarationId, logicalField, value, source]
        );
        return result.rows[0];
    },

    /**
     * Bulk upsert declaration items
     * @param {string} declarationId
     * @param {Array} items - Array of { logicalField, value }
     * @returns {Promise<Array>}
     */
    async bulkUpsertDeclarationItems(declarationId, items) {
        if (!items || items.length === 0) return [];

        const client = await db.getClient();
        try {
            await client.query('BEGIN');

            const results = [];
            for (const item of items) {
                const result = await client.query(
                    `INSERT INTO declaration_items (declaration_id, logical_field, value, source)
                    VALUES ($1, $2, $3, 'rule_engine')
                    ON CONFLICT (declaration_id, logical_field) 
                    DO UPDATE SET value = $3, source = 'rule_engine'
                    RETURNING *`,
                    [declarationId, item.logicalField, item.value]
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
     * Get declaration items
     * @param {string} declarationId
     * @returns {Promise<Array>}
     */
    async getDeclarationItems(declarationId) {
        const result = await db.query(
            `SELECT di.*, lf.description as field_description
            FROM declaration_items di
            JOIN logical_fields lf ON lf.code = di.logical_field
            WHERE di.declaration_id = $1
            ORDER BY di.logical_field`,
            [declarationId]
        );
        return result.rows;
    },

    /**
     * Delete declaration items for recalculation
     * @param {string} declarationId
     * @returns {Promise<number>}
     */
    async deleteDeclarationItems(declarationId) {
        const result = await db.query(
            `DELETE FROM declaration_items WHERE declaration_id = $1`,
            [declarationId]
        );
        return result.rowCount;
    },

    // ==========================================
    // TAX EVENTS (for engine)
    // ==========================================

    /**
     * Get tax events for engine processing
     * @param {string} taxIdentityId
     * @param {number} taxYear
     * @returns {Promise<Array>}
     */
    async getTaxEventsForEngine(taxIdentityId, taxYear) {
        const result = await db.query(
            `SELECT 
                te.*,
                tet.description as event_type_description
            FROM tax_events te
            JOIN tax_event_types tet ON tet.code = te.event_type
            WHERE te.tax_identity_id = $1 AND te.tax_year = $2
            ORDER BY te.event_date`,
            [taxIdentityId, taxYear]
        );
        return result.rows;
    },

    /**
     * Get person data for declaration header
     * @param {string} taxIdentityId
     * @returns {Promise<Object|null>}
     */
    async getPersonByTaxIdentity(taxIdentityId) {
        const result = await db.query(
            `SELECT p.* 
            FROM persons p
            JOIN tax_identities ti ON ti.person_id = p.id
            WHERE ti.id = $1`,
            [taxIdentityId]
        );
        return result.rows[0] || null;
    },
};

module.exports = ruleEngineRepository;
