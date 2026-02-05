const sourcesRepository = require('./sources.repository');
const identitiesRepository = require('../identities/identities.repository');

const VALID_SOURCE_TYPES = ['manual', 'csv', 'excel', 'bank', '1c', 'api'];

const sourcesService = {
    // ==========================================
    // CREATE
    // ==========================================

    /**
     * Import source record (single entry)
     * @param {string} userId - Importing user ID
     * @param {string} taxIdentityId - Tax identity UUID
     * @param {Object} data - Import data
     * @returns {Promise<Object>}
     */
    async importRecord(userId, taxIdentityId, data) {
        const { sourceType, externalId, rawPayload } = data;

        // Validate source type
        if (!VALID_SOURCE_TYPES.includes(sourceType)) {
            throw new Error(`Неверный тип источника. Допустимые: ${VALID_SOURCE_TYPES.join(', ')}`);
        }

        // Validate payload
        if (!rawPayload || typeof rawPayload !== 'object') {
            throw new Error('raw_payload обязателен и должен быть объектом');
        }

        // Check access to tax identity
        const hasAccess = await identitiesRepository.userHasAccess(userId, taxIdentityId);
        if (!hasAccess) {
            throw new Error('Нет доступа к этому налогоплательщику');
        }

        // Check for duplicate by checksum
        const checksum = sourcesRepository.generateChecksum(rawPayload);
        const existing = await sourcesRepository.findByChecksum(taxIdentityId, checksum);
        if (existing) {
            throw new Error('Запись с такими данными уже существует');
        }

        // Check for duplicate by external ID
        if (externalId) {
            const existingByExtId = await sourcesRepository.findByExternalId(taxIdentityId, externalId);
            if (existingByExtId) {
                throw new Error(`Запись с external_id "${externalId}" уже существует`);
            }
        }

        // Create record
        const record = await sourcesRepository.create({
            taxIdentityId,
            sourceType,
            externalId,
            rawPayload,
            importedBy: userId,
        });

        return {
            id: record.id,
            sourceType: record.source_type,
            externalId: record.external_id,
            checksum: record.checksum,
            importedAt: record.imported_at,
        };
    },

    /**
     * Bulk import source records
     * @param {string} userId - Importing user ID
     * @param {string} taxIdentityId - Tax identity UUID
     * @param {Array} records - Array of records to import
     * @returns {Promise<Object>}
     */
    async bulkImport(userId, taxIdentityId, records) {
        // Check access
        const hasAccess = await identitiesRepository.userHasAccess(userId, taxIdentityId);
        if (!hasAccess) {
            throw new Error('Нет доступа к этому налогоплательщику');
        }

        if (!Array.isArray(records) || records.length === 0) {
            throw new Error('Требуется непустой массив записей');
        }

        if (records.length > 1000) {
            throw new Error('Максимум 1000 записей за раз');
        }

        // Validate all records
        for (let i = 0; i < records.length; i++) {
            const record = records[i];
            if (!VALID_SOURCE_TYPES.includes(record.sourceType)) {
                throw new Error(`Запись ${i + 1}: неверный тип источника`);
            }
            if (!record.rawPayload || typeof record.rawPayload !== 'object') {
                throw new Error(`Запись ${i + 1}: raw_payload обязателен`);
            }
        }

        // Prepare records with user ID
        const preparedRecords = records.map(r => ({
            taxIdentityId,
            sourceType: r.sourceType,
            externalId: r.externalId,
            rawPayload: r.rawPayload,
            importedBy: userId,
        }));

        const imported = await sourcesRepository.bulkCreate(preparedRecords);

        return {
            imported: imported.length,
            skipped: records.length - imported.length,
            records: imported.map(r => ({
                id: r.id,
                sourceType: r.source_type,
                externalId: r.external_id,
            })),
        };
    },

    // ==========================================
    // READ
    // ==========================================

    /**
     * Get source records list for tax identity
     * @param {string} userId
     * @param {string} taxIdentityId
     * @param {Object} options
     * @returns {Promise<Object>}
     */
    async listRecords(userId, taxIdentityId, options = {}) {
        // Check access
        const hasAccess = await identitiesRepository.userHasAccess(userId, taxIdentityId);
        if (!hasAccess) {
            throw new Error('Нет доступа к этому налогоплательщику');
        }

        return await sourcesRepository.listByTaxIdentity(taxIdentityId, options);
    },

    /**
     * Get single source record details
     * @param {string} userId
     * @param {string} recordId
     * @returns {Promise<Object>}
     */
    async getRecord(userId, recordId) {
        const record = await sourcesRepository.findById(recordId);

        if (!record) {
            throw new Error('Запись не найдена');
        }

        // Check access
        const hasAccess = await identitiesRepository.userHasAccess(userId, record.tax_identity_id);
        if (!hasAccess) {
            throw new Error('Нет доступа к этой записи');
        }

        return record;
    },

    /**
     * Get source record with full payload
     * @param {string} userId
     * @param {string} recordId
     * @returns {Promise<Object>}
     */
    async getRecordWithPayload(userId, recordId) {
        const record = await sourcesRepository.getWithPayload(recordId);

        if (!record) {
            throw new Error('Запись не найдена');
        }

        // Check access
        const hasAccess = await identitiesRepository.userHasAccess(userId, record.tax_identity_id);
        if (!hasAccess) {
            throw new Error('Нет доступа к этой записи');
        }

        return record;
    },

    /**
     * Get import statistics for tax identity
     * @param {string} userId
     * @param {string} taxIdentityId
     * @returns {Promise<Object>}
     */
    async getStats(userId, taxIdentityId) {
        // Check access
        const hasAccess = await identitiesRepository.userHasAccess(userId, taxIdentityId);
        if (!hasAccess) {
            throw new Error('Нет доступа к этому налогоплательщику');
        }

        return await sourcesRepository.getStatsByTaxIdentity(taxIdentityId);
    },

    // ==========================================
    // UPDATE (soft operations)
    // ==========================================

    /**
     * Deactivate source record (soft delete)
     * @param {string} userId
     * @param {string} recordId
     * @returns {Promise<Object>}
     */
    async deactivateRecord(userId, recordId) {
        const record = await sourcesRepository.findById(recordId);

        if (!record) {
            throw new Error('Запись не найдена');
        }

        // Only owner can deactivate
        const hasAccess = await identitiesRepository.userHasAccess(userId, record.tax_identity_id, ['owner']);
        if (!hasAccess) {
            throw new Error('Только владелец может деактивировать записи');
        }

        return await sourcesRepository.deactivate(recordId);
    },

    /**
     * Reactivate source record
     * @param {string} userId
     * @param {string} recordId
     * @returns {Promise<Object>}
     */
    async reactivateRecord(userId, recordId) {
        const record = await sourcesRepository.findById(recordId);

        if (!record) {
            throw new Error('Запись не найдена');
        }

        // Only owner can reactivate
        const hasAccess = await identitiesRepository.userHasAccess(userId, record.tax_identity_id, ['owner']);
        if (!hasAccess) {
            throw new Error('Только владелец может активировать записи');
        }

        return await sourcesRepository.reactivate(recordId);
    },

    /**
     * Bulk deactivate source records
     * @param {string} userId
     * @param {string} taxIdentityId
     * @param {Array<string>} recordIds
     * @returns {Promise<Object>}
     */
    async bulkDeactivate(userId, taxIdentityId, recordIds) {
        // Only owner can bulk deactivate
        const hasAccess = await identitiesRepository.userHasAccess(userId, taxIdentityId, ['owner']);
        if (!hasAccess) {
            throw new Error('Только владелец может деактивировать записи');
        }

        const count = await sourcesRepository.bulkDeactivate(recordIds);

        return {
            deactivated: count,
        };
    },
};

module.exports = sourcesService;