const db = require('../../db/postgres');

const xmlGeneratorRepository = {
    // ==========================================
    // XML FIELD MAPPINGS
    // ==========================================

    /**
     * Get XML field mappings for a form code
     * @param {string} formCode - e.g., '270.00'
     * @returns {Promise<Array>}
     */
    async getXmlFieldMappings(formCode = '270.00') {
        const result = await db.query(
            `SELECT 
                xfm.id,
                xfm.form_code,
                xfm.xml_field_name,
                xfm.xml_field_path,
                xfm.data_type,
                xfm.default_value,
                xfm.is_required,
                xfm.description,
                lf.id AS logical_field_id,
                lf.code AS logical_field_code,
                lf.name AS logical_field_name
            FROM xml_field_mappings xfm
            LEFT JOIN logical_fields lf ON lf.id = xfm.logical_field_id
            WHERE xfm.form_code = $1
            ORDER BY xfm.xml_field_path`,
            [formCode]
        );
        return result.rows;
    },

    /**
     * Get XML field mapping by logical field code
     * @param {string} logicalFieldCode
     * @param {string} formCode
     * @returns {Promise<Object|null>}
     */
    async getXmlFieldByLogicalCode(logicalFieldCode, formCode = '270.00') {
        const result = await db.query(
            `SELECT 
                xfm.*,
                lf.code AS logical_field_code
            FROM xml_field_mappings xfm
            JOIN logical_fields lf ON lf.id = xfm.logical_field_id
            WHERE lf.code = $1 AND xfm.form_code = $2`,
            [logicalFieldCode, formCode]
        );
        return result.rows[0] || null;
    },

    /**
     * Get mappings as object: logical_field_code -> xml_field_name
     * @param {string} formCode
     * @returns {Promise<Object>}
     */
    async getMappingsAsObject(formCode = '270.00') {
        const mappings = await this.getXmlFieldMappings(formCode);
        const obj = {};
        for (const m of mappings) {
            if (m.logical_field_code) {
                obj[m.logical_field_code] = {
                    xmlFieldName: m.xml_field_name,
                    xmlFieldPath: m.xml_field_path,
                    dataType: m.data_type,
                    defaultValue: m.default_value,
                    isRequired: m.is_required,
                };
            }
        }
        return obj;
    },

    // ==========================================
    // GENERATED XML STORAGE (using xml_exports table)
    // ==========================================

    /**
     * Save generated XML to database
     * @param {Object} data
     * @returns {Promise<Object>}
     */
    async saveGeneratedXml(data) {
        const {
            declarationId,
            xmlContent,
            xmlHash,
            version,
            generatedBy,
        } = data;

        const result = await db.query(
            `INSERT INTO xml_exports (
                declaration_id,
                xml_payload,
                xml_hash,
                schema_version
            )
            VALUES ($1, $2, $3, $4)
            RETURNING *`,
            [declarationId, xmlContent, xmlHash, version?.toString() || '1']
        );
        return result.rows[0];
    },

    /**
     * Get latest generated XML for declaration
     * @param {string} declarationId
     * @returns {Promise<Object|null>}
     */
    async getLatestXml(declarationId) {
        const result = await db.query(
            `SELECT 
                id,
                declaration_id,
                xml_payload AS xml_content,
                schema_version AS version,
                xml_hash,
                signed,
                created_at
            FROM xml_exports 
            WHERE declaration_id = $1 
            ORDER BY created_at DESC 
            LIMIT 1`,
            [declarationId]
        );
        return result.rows[0] || null;
    },

    /**
     * Get XML by ID
     * @param {string} id
     * @returns {Promise<Object|null>}
     */
    async getXmlById(id) {
        const result = await db.query(
            `SELECT 
                id,
                declaration_id,
                xml_payload AS xml_content,
                schema_version AS version,
                xml_hash,
                signed,
                created_at
            FROM xml_exports 
            WHERE id = $1`,
            [id]
        );
        return result.rows[0] || null;
    },

    /**
     * List XML versions for declaration
     * @param {string} declarationId
     * @returns {Promise<Array>}
     */
    async listXmlVersions(declarationId) {
        const result = await db.query(
            `SELECT 
                id,
                schema_version AS version,
                xml_hash,
                signed,
                created_at
            FROM xml_exports 
            WHERE declaration_id = $1 
            ORDER BY created_at DESC`,
            [declarationId]
        );
        return result.rows;
    },

    /**
     * Get next version number for declaration
     * @param {string} declarationId
     * @returns {Promise<number>}
     */
    async getNextVersion(declarationId) {
        const result = await db.query(
            `SELECT COUNT(*) + 1 AS next_version 
            FROM xml_exports 
            WHERE declaration_id = $1`,
            [declarationId]
        );
        return parseInt(result.rows[0].next_version, 10);
    },

    // ==========================================
    // FORM TEMPLATES
    // ==========================================

    /**
     * Get XML template for form code
     * @param {string} formCode
     * @returns {Promise<Object|null>}
     */
    async getFormTemplate(formCode) {
        const result = await db.query(
            `SELECT * FROM xml_form_templates WHERE form_code = $1`,
            [formCode]
        );
        return result.rows[0] || null;
    },
};

module.exports = xmlGeneratorRepository;
