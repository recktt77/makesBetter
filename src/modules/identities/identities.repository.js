const db = require('../../db/postgres');

const identitiesRepository = {
    // ==========================================
    // PERSONS CRUD
    // ==========================================

    /**
     * Find person by IIN
     * @param {string} iin
     * @returns {Promise<Object|null>}
     */
    async findPersonByIin(iin) {
        const result = await db.query(
            `SELECT * FROM persons WHERE iin = $1`,
            [iin]
        );
        return result.rows[0] || null;
    },

    /**
     * Find person by ID
     * @param {string} id
     * @returns {Promise<Object|null>}
     */
    async findPersonById(id) {
        const result = await db.query(
            `SELECT * FROM persons WHERE id = $1`,
            [id]
        );
        return result.rows[0] || null;
    },

    /**
     * Create new person
     * @param {Object} data - Person data
     * @returns {Promise<Object>}
     */
    async createPerson({ iin, lastName, firstName, middleName, email, phone, residencyStatus, maritalStatus, taxObligationStartYear }) {
        const result = await db.query(
            `INSERT INTO persons (
                iin, last_name, first_name, middle_name,
                email, phone, residency_status, marital_status, tax_obligation_start_year
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *`,
            [iin, lastName, firstName, middleName || null, email || null, phone || null, residencyStatus, maritalStatus, taxObligationStartYear]
        );
        return result.rows[0];
    },

    /**
     * Update person
     * @param {string} id - Person UUID
     * @param {Object} data - Update data
     * @returns {Promise<Object>}
     */
    async updatePerson(id, { lastName, firstName, middleName, email, phone, residencyStatus, maritalStatus, taxObligationStartYear }) {
        const result = await db.query(
            `UPDATE persons SET
                last_name = COALESCE($2, last_name),
                first_name = COALESCE($3, first_name),
                middle_name = COALESCE($4, middle_name),
                email = COALESCE($5, email),
                phone = COALESCE($6, phone),
                residency_status = COALESCE($7, residency_status),
                marital_status = COALESCE($8, marital_status),
                tax_obligation_start_year = COALESCE($9, tax_obligation_start_year)
            WHERE id = $1
            RETURNING *`,
            [id, lastName, firstName, middleName, email, phone, residencyStatus, maritalStatus, taxObligationStartYear]
        );
        return result.rows[0];
    },

    /**
     * Delete person
     * @param {string} id - Person UUID
     * @returns {Promise<boolean>}
     */
    async deletePerson(id) {
        const result = await db.query(
            `DELETE FROM persons WHERE id = $1`,
            [id]
        );
        return result.rowCount > 0;
    },

    // ==========================================
    // BUSINESS ENTITIES CRUD
    // ==========================================

    /**
     * Find business by BIN
     * @param {string} bin
     * @returns {Promise<Object|null>}
     */
    async findBusinessByBin(bin) {
        const result = await db.query(
            `SELECT * FROM business_entities WHERE bin = $1`,
            [bin]
        );
        return result.rows[0] || null;
    },

    /**
     * Find business by ID
     * @param {string} id
     * @returns {Promise<Object|null>}
     */
    async findBusinessById(id) {
        const result = await db.query(
            `SELECT * FROM business_entities WHERE id = $1`,
            [id]
        );
        return result.rows[0] || null;
    },

    /**
     * Create business entity (IP/TOO)
     * @param {Object} data - Business data
     * @returns {Promise<Object>}
     */
    async createBusiness({ bin, legalName, entityType, email, phone }) {
        const result = await db.query(
            `INSERT INTO business_entities (bin, legal_name, entity_type, email, phone)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *`,
            [bin, legalName, entityType, email || null, phone || null]
        );
        return result.rows[0];
    },

    /**
     * Update business entity
     * @param {string} id - Business UUID
     * @param {Object} data - Update data
     * @returns {Promise<Object>}
     */
    async updateBusiness(id, { legalName, email, phone }) {
        const result = await db.query(
            `UPDATE business_entities SET
                legal_name = COALESCE($2, legal_name),
                email = COALESCE($3, email),
                phone = COALESCE($4, phone)
            WHERE id = $1
            RETURNING *`,
            [id, legalName, email, phone]
        );
        return result.rows[0];
    },

    /**
     * Delete business entity
     * @param {string} id - Business UUID
     * @returns {Promise<boolean>}
     */
    async deleteBusiness(id) {
        const result = await db.query(
            `DELETE FROM business_entities WHERE id = $1`,
            [id]
        );
        return result.rowCount > 0;
    },

    // ==========================================
    // TAX IDENTITIES CRUD
    // ==========================================

    /**
     * Create tax identity
     * @param {string} identityType - 'PERSON' or 'BUSINESS'
     * @param {string} entityId - person_id or business_id
     * @returns {Promise<Object>}
     */
    async createTaxIdentity(identityType, entityId) {
        const personId = identityType === 'PERSON' ? entityId : null;
        const businessId = identityType === 'BUSINESS' ? entityId : null;

        const result = await db.query(
            `INSERT INTO tax_identities (identity_type, person_id, business_id)
            VALUES ($1, $2, $3)
            RETURNING *`,
            [identityType, personId, businessId]
        );
        return result.rows[0];
    },

    /**
     * Find tax identity by ID
     * @param {string} id
     * @returns {Promise<Object|null>}
     */
    async findTaxIdentityById(id) {
        const result = await db.query(
            `SELECT 
                ti.*,
                p.iin, p.last_name, p.first_name, p.middle_name,
                p.email AS person_email, p.phone AS person_phone,
                p.residency_status, p.marital_status, p.tax_obligation_start_year,
                b.bin, b.legal_name, b.entity_type,
                b.email AS business_email, b.phone AS business_phone
            FROM tax_identities ti
            LEFT JOIN persons p ON p.id = ti.person_id
            LEFT JOIN business_entities b ON b.id = ti.business_id
            WHERE ti.id = $1`,
            [id]
        );
        return result.rows[0] || null;
    },

    /**
     * Find tax identity by person_id
     * @param {string} personId
     * @returns {Promise<Object|null>}
     */
    async findTaxIdentityByPersonId(personId) {
        const result = await db.query(
            `SELECT * FROM tax_identities WHERE person_id = $1`,
            [personId]
        );
        return result.rows[0] || null;
    },

    /**
     * Find tax identity by business_id
     * @param {string} businessId
     * @returns {Promise<Object|null>}
     */
    async findTaxIdentityByBusinessId(businessId) {
        const result = await db.query(
            `SELECT * FROM tax_identities WHERE business_id = $1`,
            [businessId]
        );
        return result.rows[0] || null;
    },

    /**
     * Delete tax identity
     * @param {string} id
     * @returns {Promise<boolean>}
     */
    async deleteTaxIdentity(id) {
        const result = await db.query(
            `DELETE FROM tax_identities WHERE id = $1`,
            [id]
        );
        return result.rowCount > 0;
    },

    // ==========================================
    // USER IDENTITY ROLES CRUD
    // ==========================================

    /**
     * Assign role to user for tax identity
     * @param {string} userId
     * @param {string} taxIdentityId
     * @param {string} role - 'owner' | 'representative' | 'accountant'
     * @returns {Promise<Object>}
     */
    async createUserIdentityRole(userId, taxIdentityId, role) {
        const result = await db.query(
            `INSERT INTO user_identity_roles (user_id, tax_identity_id, role)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id, tax_identity_id) DO UPDATE SET role = $3
            RETURNING *`,
            [userId, taxIdentityId, role]
        );
        return result.rows[0];
    },

    /**
     * Get user's role for specific tax identity
     * @param {string} userId
     * @param {string} taxIdentityId
     * @returns {Promise<Object|null>}
     */
    async findUserIdentityRole(userId, taxIdentityId) {
        const result = await db.query(
            `SELECT * FROM user_identity_roles 
            WHERE user_id = $1 AND tax_identity_id = $2`,
            [userId, taxIdentityId]
        );
        return result.rows[0] || null;
    },

    /**
     * Remove user's role for tax identity
     * @param {string} userId
     * @param {string} taxIdentityId
     * @returns {Promise<boolean>}
     */
    async deleteUserIdentityRole(userId, taxIdentityId) {
        const result = await db.query(
            `DELETE FROM user_identity_roles 
            WHERE user_id = $1 AND tax_identity_id = $2`,
            [userId, taxIdentityId]
        );
        return result.rowCount > 0;
    },

    /**
     * List all tax identities for a user with full details
     * @param {string} userId
     * @returns {Promise<Array>}
     */
    async listUserIdentities(userId) {
        const result = await db.query(
            `SELECT
                ti.id AS tax_identity_id,
                ti.identity_type,
                uir.role,
                p.id AS person_id,
                p.iin,
                p.last_name,
                p.first_name,
                p.middle_name,
                p.email AS person_email,
                p.phone AS person_phone,
                p.residency_status,
                p.marital_status,
                b.id AS business_id,
                b.bin,
                b.legal_name,
                b.entity_type,
                b.email AS business_email,
                b.phone AS business_phone,
                ti.created_at
            FROM user_identity_roles uir
            JOIN tax_identities ti ON ti.id = uir.tax_identity_id
            LEFT JOIN persons p ON p.id = ti.person_id
            LEFT JOIN business_entities b ON b.id = ti.business_id
            WHERE uir.user_id = $1
            ORDER BY ti.created_at DESC`,
            [userId]
        );
        return result.rows;
    },

    /**
     * List all users with access to a tax identity
     * @param {string} taxIdentityId
     * @returns {Promise<Array>}
     */
    async listIdentityUsers(taxIdentityId) {
        const result = await db.query(
            `SELECT
                u.id AS user_id,
                u.email,
                u.phone,
                u.username,
                uir.role,
                uir.created_at
            FROM user_identity_roles uir
            JOIN users u ON u.id = uir.user_id
            WHERE uir.tax_identity_id = $1
            ORDER BY uir.created_at DESC`,
            [taxIdentityId]
        );
        return result.rows;
    },

    /**
     * Check if user has access to tax identity
     * @param {string} userId
     * @param {string} taxIdentityId
     * @param {Array<string>} allowedRoles - optional role filter
     * @returns {Promise<boolean>}
     */
    async userHasAccess(userId, taxIdentityId, allowedRoles = null) {
        let queryText = `SELECT 1 FROM user_identity_roles 
                     WHERE user_id = $1 AND tax_identity_id = $2`;
        const params = [userId, taxIdentityId];

        if (allowedRoles && allowedRoles.length > 0) {
            queryText += ` AND role = ANY($3)`;
            params.push(allowedRoles);
        }

        const result = await db.query(queryText, params);
        return result.rowCount > 0;
    },

    /**
     * List tax identities by user ID
     * @param {string} userId
     * @returns {Promise<Array>}
     */
    async listByUser(userId) {
        const result = await db.query(
            `SELECT 
                ti.*,
                uir.role,
                p.iin, p.last_name, p.first_name, p.middle_name,
                p.email AS person_email, p.phone AS person_phone,
                b.bin, b.legal_name, b.entity_type,
                b.email AS business_email, b.phone AS business_phone
            FROM user_identity_roles uir
            JOIN tax_identities ti ON ti.id = uir.tax_identity_id
            LEFT JOIN persons p ON p.id = ti.person_id
            LEFT JOIN business_entities b ON b.id = ti.business_id
            WHERE uir.user_id = $1
            ORDER BY ti.created_at DESC`,
            [userId]
        );
        return result.rows;
    },

    /**
     * Get full identity with person or business details
     * @param {string} taxIdentityId
     * @returns {Promise<Object|null>}
     */
    async getFullIdentity(taxIdentityId) {
        const result = await db.query(
            `SELECT 
                ti.id AS tax_identity_id,
                ti.identity_type,
                ti.created_at,
                CASE 
                    WHEN ti.person_id IS NOT NULL THEN json_build_object(
                        'id', p.id,
                        'iin', p.iin,
                        'last_name', p.last_name,
                        'first_name', p.first_name,
                        'middle_name', p.middle_name,
                        'email', p.email,
                        'phone', p.phone,
                        'residency_status', p.residency_status,
                        'marital_status', p.marital_status
                    )
                    ELSE NULL
                END AS person,
                CASE 
                    WHEN ti.business_id IS NOT NULL THEN json_build_object(
                        'id', b.id,
                        'bin', b.bin,
                        'legal_name', b.legal_name,
                        'entity_type', b.entity_type,
                        'email', b.email,
                        'phone', b.phone
                    )
                    ELSE NULL
                END AS business
            FROM tax_identities ti
            LEFT JOIN persons p ON p.id = ti.person_id
            LEFT JOIN business_entities b ON b.id = ti.business_id
            WHERE ti.id = $1`,
            [taxIdentityId]
        );
        return result.rows[0] || null;
    },
};

module.exports = identitiesRepository;