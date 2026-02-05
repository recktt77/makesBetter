const db = require('../../db/postgres');

const declarationsRepository = {
    // ==========================================
    // DECLARATIONS CRUD
    // ==========================================

    /**
     * Create new declaration
     * @param {Object} data
     * @returns {Promise<Object>}
     */
    async create(data) {
        const {
            taxIdentityId,
            taxYear,
            formCode = '270.00',
            declarationKind = 'main',
            iin,
            fioLast,
            fioFirst,
            fioMiddle,
            payerPhone,
            email,
            iinSpouse,
            iinLegalRepresentative,
            flags,
        } = data;

        const result = await db.query(
            `INSERT INTO declarations (
                tax_identity_id, tax_year, form_code, declaration_kind,
                iin, fio_last, fio_first, fio_middle,
                payer_phone, email, iin_spouse, iin_legalrepresentative,
                flags, status
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'draft')
            RETURNING *`,
            [
                taxIdentityId,
                taxYear,
                formCode,
                declarationKind,
                iin,
                fioLast,
                fioFirst,
                fioMiddle,
                payerPhone,
                email,
                iinSpouse,
                iinLegalRepresentative,
                flags ? JSON.stringify(flags) : null,
            ]
        );
        return result.rows[0];
    },

    /**
     * Find declaration by ID
     * @param {string} id
     * @returns {Promise<Object|null>}
     */
    async findById(id) {
        const result = await db.query(
            `SELECT d.*,
                    ti.identity_type,
                    CASE 
                        WHEN ti.identity_type = 'PERSON' THEN p.iin
                        ELSE be.bin
                    END as identity_code,
                    CASE 
                        WHEN ti.identity_type = 'PERSON' THEN CONCAT(p.last_name, ' ', p.first_name)
                        ELSE be.legal_name
                    END as identity_name
            FROM declarations d
            JOIN tax_identities ti ON ti.id = d.tax_identity_id
            LEFT JOIN persons p ON p.id = ti.person_id
            LEFT JOIN business_entities be ON be.id = ti.business_id
            WHERE d.id = $1`,
            [id]
        );
        return result.rows[0] || null;
    },

    /**
     * Find declaration by tax identity, year, form and kind
     * @param {string} taxIdentityId
     * @param {number} taxYear
     * @param {string} formCode
     * @param {string} declarationKind
     * @returns {Promise<Object|null>}
     */
    async findByIdentityYearFormKind(taxIdentityId, taxYear, formCode = '270.00', declarationKind = 'main') {
        const result = await db.query(
            `SELECT * FROM declarations 
            WHERE tax_identity_id = $1 
            AND tax_year = $2 
            AND form_code = $3
            AND declaration_kind = $4`,
            [taxIdentityId, taxYear, formCode, declarationKind]
        );
        return result.rows[0] || null;
    },

    /**
     * Find or create declaration
     * @param {Object} data
     * @returns {Promise<Object>}
     */
    async findOrCreate(data) {
        const existing = await this.findByIdentityYearFormKind(
            data.taxIdentityId,
            data.taxYear,
            data.formCode || '270.00',
            data.declarationKind || 'main'
        );

        if (existing) {
            return { declaration: existing, created: false };
        }

        const created = await this.create(data);
        return { declaration: created, created: true };
    },

    /**
     * Update declaration
     * @param {string} id
     * @param {Object} data
     * @returns {Promise<Object>}
     */
    async update(id, data) {
        const fields = [];
        const values = [];
        let paramIndex = 1;

        const allowedFields = [
            'status', 'declaration_kind', 'iin', 'fio_last', 'fio_first', 'fio_middle',
            'payer_phone', 'email', 'iin_spouse', 'iin_legalrepresentative', 'flags',
            'validated_at', 'exported_at'
        ];

        for (const [key, value] of Object.entries(data)) {
            const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
            if (allowedFields.includes(snakeKey)) {
                fields.push(`${snakeKey} = $${paramIndex}`);
                values.push(key === 'flags' ? JSON.stringify(value) : value);
                paramIndex++;
            }
        }

        if (fields.length === 0) {
            return this.findById(id);
        }

        values.push(id);
        const result = await db.query(
            `UPDATE declarations 
            SET ${fields.join(', ')}
            WHERE id = $${paramIndex}
            RETURNING *`,
            values
        );
        return result.rows[0];
    },

    /**
     * Update declaration status
     * @param {string} id
     * @param {string} status
     * @returns {Promise<Object>}
     */
    async updateStatus(id, status) {
        const updates = { status };

        if (status === 'validated') {
            updates.validated_at = new Date();
        }

        return this.update(id, updates);
    },

    /**
     * List declarations by tax identity
     * @param {string} taxIdentityId
     * @param {Object} options
     * @returns {Promise<Object>}
     */
    async listByTaxIdentity(taxIdentityId, options = {}) {
        const { page = 1, limit = 20, status, taxYear } = options;
        const offset = (page - 1) * limit;

        const conditions = ['d.tax_identity_id = $1'];
        const params = [taxIdentityId];
        let paramIndex = 2;

        if (status) {
            conditions.push(`d.status = $${paramIndex}`);
            params.push(status);
            paramIndex++;
        }

        if (taxYear) {
            conditions.push(`d.tax_year = $${paramIndex}`);
            params.push(taxYear);
            paramIndex++;
        }

        const whereClause = conditions.join(' AND ');

        const countResult = await db.query(
            `SELECT COUNT(*) as total FROM declarations d WHERE ${whereClause}`,
            params
        );

        const result = await db.query(
            `SELECT d.*, 
                (SELECT COUNT(*) FROM declaration_items di WHERE di.declaration_id = d.id) as items_count
            FROM declarations d
            WHERE ${whereClause}
            ORDER BY d.tax_year DESC, d.created_at DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            [...params, limit, offset]
        );

        return {
            declarations: result.rows,
            pagination: {
                page,
                limit,
                total: parseInt(countResult.rows[0].total, 10),
                totalPages: Math.ceil(parseInt(countResult.rows[0].total, 10) / limit),
            },
        };
    },

    /**
     * Delete declaration (only drafts)
     * @param {string} id
     * @returns {Promise<boolean>}
     */
    async delete(id) {
        const result = await db.query(
            `DELETE FROM declarations 
            WHERE id = $1 AND status = 'draft'
            RETURNING id`,
            [id]
        );
        return result.rowCount > 0;
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
    async upsertItem(declarationId, logicalField, value, source = 'rule_engine') {
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
     * @param {Object} fieldValues - { logical_field: value }
     * @param {string} source
     * @returns {Promise<Array>}
     */
    async bulkUpsertItems(declarationId, fieldValues, source = 'rule_engine') {
        const client = await db.getClient();
        try {
            await client.query('BEGIN');

            const results = [];
            for (const [logicalField, value] of Object.entries(fieldValues)) {
                if (value !== null && value !== undefined && value !== 0) {
                    const result = await client.query(
                        `INSERT INTO declaration_items (declaration_id, logical_field, value, source)
                        VALUES ($1, $2, $3, $4)
                        ON CONFLICT (declaration_id, logical_field)
                        DO UPDATE SET value = $3, source = $4
                        RETURNING *`,
                        [declarationId, logicalField, value, source]
                    );
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

    /**
     * Get all items for declaration
     * @param {string} declarationId
     * @returns {Promise<Array>}
     */
    async getItems(declarationId) {
        const result = await db.query(
            `SELECT di.*, lf.description as field_description
            FROM declaration_items di
            JOIN logical_fields lf ON lf.code = di.logical_field
            WHERE di.declaration_id = $1
            ORDER BY lf.code`,
            [declarationId]
        );
        return result.rows;
    },

    /**
     * Get items as key-value object
     * @param {string} declarationId
     * @returns {Promise<Object>}
     */
    async getItemsAsObject(declarationId) {
        const items = await this.getItems(declarationId);
        const obj = {};
        for (const item of items) {
            obj[item.logical_field] = parseFloat(item.value);
        }
        return obj;
    },

    /**
     * Delete all items for declaration
     * @param {string} declarationId
     * @returns {Promise<number>}
     */
    async deleteItems(declarationId) {
        const result = await db.query(
            `DELETE FROM declaration_items WHERE declaration_id = $1`,
            [declarationId]
        );
        return result.rowCount;
    },

    /**
     * Update single item value
     * @param {string} declarationId
     * @param {string} logicalField
     * @param {number} value
     * @returns {Promise<Object>}
     */
    async updateItem(declarationId, logicalField, value) {
        return this.upsertItem(declarationId, logicalField, value, 'manual');
    },

    // ==========================================
    // XML FIELD MAPPING
    // ==========================================

    /**
     * Get XML field mappings for form
     * @param {string} formCode
     * @returns {Promise<Array>}
     */
    async getXmlFieldMappings(formCode) {
        const result = await db.query(
            `SELECT * FROM xml_field_map
            WHERE form_code = $1
            ORDER BY application_code, xml_field_name`,
            [formCode]
        );
        return result.rows;
    },

    /**
     * Get declaration with all data for XML generation
     * @param {string} declarationId
     * @returns {Promise<Object>}
     */
    async getFullDeclaration(declarationId) {
        const declaration = await this.findById(declarationId);
        if (!declaration) return null;

        const items = await this.getItemsAsObject(declarationId);
        const xmlMappings = await this.getXmlFieldMappings(declaration.form_code);

        return {
            ...declaration,
            items,
            xmlMappings,
        };
    },

    // ==========================================
    // VALIDATION REPORTS
    // ==========================================

    /**
     * Create validation report
     * @param {string} declarationId
     * @param {string} validationType - 'xsd' or 'business'
     * @param {boolean} isValid
     * @param {Object} report
     * @returns {Promise<Object>}
     */
    async createValidationReport(declarationId, validationType, isValid, report) {
        const result = await db.query(
            `INSERT INTO validation_reports (declaration_id, validation_type, is_valid, report)
            VALUES ($1, $2, $3, $4)
            RETURNING *`,
            [declarationId, validationType, isValid, JSON.stringify(report)]
        );
        return result.rows[0];
    },

    /**
     * Get validation reports for declaration
     * @param {string} declarationId
     * @returns {Promise<Array>}
     */
    async getValidationReports(declarationId) {
        const result = await db.query(
            `SELECT * FROM validation_reports
            WHERE declaration_id = $1
            ORDER BY created_at DESC`,
            [declarationId]
        );
        return result.rows;
    },

    /**
     * Get latest validation status
     * @param {string} declarationId
     * @returns {Promise<Object>}
     */
    async getLatestValidation(declarationId) {
        const result = await db.query(
            `SELECT 
                (SELECT is_valid FROM validation_reports 
                 WHERE declaration_id = $1 AND validation_type = 'xsd' 
                 ORDER BY created_at DESC LIMIT 1) as xsd_valid,
                (SELECT is_valid FROM validation_reports 
                 WHERE declaration_id = $1 AND validation_type = 'business' 
                 ORDER BY created_at DESC LIMIT 1) as business_valid`,
            [declarationId]
        );
        return result.rows[0];
    },
};

module.exports = declarationsRepository;
