const declarationsRepository = require('./declarations.repository');
const identitiesRepository = require('../identities/identities.repository');
const ruleEngineService = require('../rule-engine/ruleEngine.service');

const declarationsService = {
    // ==========================================
    // DECLARATION LIFECYCLE
    // ==========================================

    /**
     * Create or get existing declaration for tax identity and year
     * @param {string} taxIdentityId
     * @param {number} taxYear
     * @param {string} userId
     * @param {Object} options
     * @returns {Promise<Object>}
     */
    async createOrGet(taxIdentityId, taxYear, userId, options = {}) {
        // Check access
        const hasAccess = await identitiesRepository.userHasAccess(userId, taxIdentityId);
        if (!hasAccess) {
            throw new Error('No access to this tax identity');
        }

        // Get identity details for header snapshot
        const identity = await identitiesRepository.getFullIdentity(taxIdentityId);
        if (!identity) {
            throw new Error('Tax identity not found');
        }

        // Prepare declaration data
        const declarationData = {
            taxIdentityId,
            taxYear,
            formCode: options.formCode || '270.00',
            declarationKind: options.declarationKind || 'main',
            iin: identity.person?.iin || null,
            fioLast: identity.person?.last_name || null,
            fioFirst: identity.person?.first_name || null,
            fioMiddle: identity.person?.middle_name || null,
            payerPhone: identity.person?.phone || identity.business?.phone || null,
            email: identity.person?.email || identity.business?.email || null,
            flags: {},
        };

        const { declaration, created } = await declarationsRepository.findOrCreate(declarationData);

        return {
            declaration,
            created,
            message: created ? 'Declaration created' : 'Declaration already exists',
        };
    },

    /**
     * Generate declaration from tax events using rule engine
     * @param {string} taxIdentityId
     * @param {number} taxYear
     * @param {string} userId
     * @returns {Promise<Object>}
     */
    async generate(taxIdentityId, taxYear, userId) {
        // Create or get declaration
        const { declaration } = await this.createOrGet(taxIdentityId, taxYear, userId);

        // Check if already submitted
        if (['submitted', 'accepted'].includes(declaration.status)) {
            throw new Error('Cannot regenerate submitted declaration. Create additional declaration instead.');
        }

        // Run rule engine (persist=false, we'll save to declaration_items ourselves)
        const engineResult = await ruleEngineService.runEngine(taxIdentityId, taxYear, userId, {
            persist: false,
            allowEmpty: true,
        });

        // Clear old items and insert new ones
        await declarationsRepository.deleteItems(declaration.id);

        // Insert calculated field values
        if (engineResult.fieldValues && Object.keys(engineResult.fieldValues).length > 0) {
            await declarationsRepository.bulkUpsertItems(
                declaration.id,
                engineResult.fieldValues,
                'rule_engine'
            );
        }

        // Update declaration flags
        if (engineResult.flags && Object.keys(engineResult.flags).length > 0) {
            await declarationsRepository.update(declaration.id, {
                flags: engineResult.flags,
            });
        }

        // Get updated declaration
        const updatedDeclaration = await declarationsRepository.findById(declaration.id);
        const items = await declarationsRepository.getItems(declaration.id);

        return {
            declaration: updatedDeclaration,
            items,
            stats: engineResult.stats,
            errors: engineResult.errors,
        };
    },

    /**
     * Get declaration with all items
     * @param {string} declarationId
     * @param {string} userId
     * @returns {Promise<Object>}
     */
    async getById(declarationId, userId) {
        const declaration = await declarationsRepository.findById(declarationId);
        if (!declaration) {
            throw new Error('Declaration not found');
        }

        // Check access
        const hasAccess = await identitiesRepository.userHasAccess(userId, declaration.tax_identity_id);
        if (!hasAccess) {
            throw new Error('No access to this declaration');
        }

        const items = await declarationsRepository.getItems(declarationId);
        const validation = await declarationsRepository.getLatestValidation(declarationId);

        return {
            ...declaration,
            items,
            validation,
        };
    },

    /**
     * List declarations for user's tax identities
     * @param {string} userId
     * @param {Object} options
     * @returns {Promise<Object>}
     */
    async listForUser(userId, options = {}) {
        // Get user's tax identities
        const identities = await identitiesRepository.listByUser(userId);

        if (identities.length === 0) {
            return { declarations: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } };
        }

        // If specific taxIdentityId provided, use it
        if (options.taxIdentityId) {
            const hasAccess = await identitiesRepository.userHasAccess(userId, options.taxIdentityId);
            if (!hasAccess) {
                throw new Error('No access to this tax identity');
            }
            return declarationsRepository.listByTaxIdentity(options.taxIdentityId, options);
        }

        // Otherwise, get from first identity (could be enhanced for multi-identity)
        return declarationsRepository.listByTaxIdentity(identities[0].tax_identity_id, options);
    },

    /**
     * Update declaration header (personal info)
     * @param {string} declarationId
     * @param {Object} data
     * @param {string} userId
     * @returns {Promise<Object>}
     */
    async updateHeader(declarationId, data, userId) {
        const declaration = await declarationsRepository.findById(declarationId);
        if (!declaration) {
            throw new Error('Declaration not found');
        }

        // Check access
        const hasAccess = await identitiesRepository.userHasAccess(userId, declaration.tax_identity_id);
        if (!hasAccess) {
            throw new Error('No access to this declaration');
        }

        // Check status
        if (!['draft', 'validated'].includes(declaration.status)) {
            throw new Error('Cannot update declaration in current status');
        }

        // Reset status to draft if updating validated declaration
        if (declaration.status === 'validated') {
            data.status = 'draft';
        }

        const updated = await declarationsRepository.update(declarationId, data);
        return updated;
    },

    /**
     * Update specific declaration item (manual override)
     * @param {string} declarationId
     * @param {string} logicalField
     * @param {number} value
     * @param {string} userId
     * @returns {Promise<Object>}
     */
    async updateItem(declarationId, logicalField, value, userId) {
        const declaration = await declarationsRepository.findById(declarationId);
        if (!declaration) {
            throw new Error('Declaration not found');
        }

        // Check access
        const hasAccess = await identitiesRepository.userHasAccess(userId, declaration.tax_identity_id);
        if (!hasAccess) {
            throw new Error('No access to this declaration');
        }

        // Check status
        if (!['draft', 'validated'].includes(declaration.status)) {
            throw new Error('Cannot update declaration in current status');
        }

        // Update item
        const item = await declarationsRepository.updateItem(declarationId, logicalField, value);

        // Reset status to draft
        if (declaration.status === 'validated') {
            await declarationsRepository.updateStatus(declarationId, 'draft');
        }

        return item;
    },

    /**
     * Delete declaration (only drafts)
     * @param {string} declarationId
     * @param {string} userId
     * @returns {Promise<boolean>}
     */
    async delete(declarationId, userId) {
        const declaration = await declarationsRepository.findById(declarationId);
        if (!declaration) {
            throw new Error('Declaration not found');
        }

        // Check access
        const hasAccess = await identitiesRepository.userHasAccess(userId, declaration.tax_identity_id);
        if (!hasAccess) {
            throw new Error('No access to this declaration');
        }

        if (declaration.status !== 'draft') {
            throw new Error('Only draft declarations can be deleted');
        }

        return declarationsRepository.delete(declarationId);
    },

    // ==========================================
    // WORKFLOW TRANSITIONS
    // ==========================================

    /**
     * Get available status transitions
     * @param {string} currentStatus
     * @returns {Array<string>}
     */
    getAvailableTransitions(currentStatus) {
        const transitions = {
            'draft': ['validated'],
            'validated': ['draft', 'awaiting_consent'],
            'awaiting_consent': ['validated', 'signed'],
            'signed': ['submitted'],
            'submitted': ['accepted', 'rejected'],
            'accepted': [],
            'rejected': ['draft'],
        };
        return transitions[currentStatus] || [];
    },

    /**
     * Transition declaration to new status
     * @param {string} declarationId
     * @param {string} newStatus
     * @param {string} userId
     * @returns {Promise<Object>}
     */
    async transitionStatus(declarationId, newStatus, userId) {
        const declaration = await declarationsRepository.findById(declarationId);
        if (!declaration) {
            throw new Error('Declaration not found');
        }

        // Check access
        const hasAccess = await identitiesRepository.userHasAccess(userId, declaration.tax_identity_id);
        if (!hasAccess) {
            throw new Error('No access to this declaration');
        }

        // Check transition is valid
        const availableTransitions = this.getAvailableTransitions(declaration.status);
        if (!availableTransitions.includes(newStatus)) {
            throw new Error(`Cannot transition from ${declaration.status} to ${newStatus}`);
        }

        // Update status
        const updated = await declarationsRepository.updateStatus(declarationId, newStatus);
        return updated;
    },

    /**
     * Validate and transition to validated status
     * @param {string} declarationId
     * @param {string} userId
     * @returns {Promise<Object>}
     */
    async validate(declarationId, userId) {
        const declaration = await this.getById(declarationId, userId);

        // Check has items
        if (!declaration.items || declaration.items.length === 0) {
            throw new Error('Declaration has no items. Generate declaration first.');
        }

        // Check required fields
        const required = ['LF_INCOME_TOTAL', 'LF_TAXABLE_INCOME', 'LF_IPN_CALCULATED'];
        const itemCodes = declaration.items.map(i => i.logical_field);
        const missing = required.filter(r => !itemCodes.includes(r));

        if (missing.length > 0) {
            // Create business validation report
            await declarationsRepository.createValidationReport(
                declarationId,
                'business',
                false,
                { errors: [`Missing required fields: ${missing.join(', ')}`] }
            );
            throw new Error(`Missing required fields: ${missing.join(', ')}`);
        }

        // Create successful validation report
        await declarationsRepository.createValidationReport(
            declarationId,
            'business',
            true,
            { message: 'All business rules passed' }
        );

        // Transition to validated
        const updated = await declarationsRepository.updateStatus(declarationId, 'validated');
        return {
            declaration: updated,
            validation: { isValid: true, message: 'Declaration validated successfully' },
        };
    },

    // ==========================================
    // SUMMARY & STATS
    // ==========================================

    /**
     * Get declaration summary for display
     * @param {string} declarationId
     * @param {string} userId
     * @returns {Promise<Object>}
     */
    async getSummary(declarationId, userId) {
        const declaration = await this.getById(declarationId, userId);
        const items = await declarationsRepository.getItemsAsObject(declarationId);

        return {
            id: declaration.id,
            taxYear: declaration.tax_year,
            formCode: declaration.form_code,
            declarationKind: declaration.declaration_kind,
            status: declaration.status,
            taxpayer: {
                iin: declaration.iin,
                name: [declaration.fio_last, declaration.fio_first, declaration.fio_middle]
                    .filter(Boolean)
                    .join(' '),
                phone: declaration.payer_phone,
                email: declaration.email,
            },
            totals: {
                incomeTotal: items.LF_INCOME_TOTAL || 0,
                adjustmentTotal: items.LF_ADJUSTMENT_TOTAL || 0,
                deductionTotal: items.LF_DEDUCTION_TOTAL || 0,
                taxableIncome: items.LF_TAXABLE_INCOME || 0,
                ipnCalculated: items.LF_IPN_CALCULATED || 0,
                foreignTaxCredit: (items.LF_FOREIGN_TAX_CREDIT_GENERAL || 0) +
                    (items.LF_FOREIGN_TAX_CREDIT_CFC || 0),
                ipnPayable: items.LF_IPN_PAYABLE || 0,
            },
            flags: declaration.flags || {},
            validation: declaration.validation,
            createdAt: declaration.created_at,
            validatedAt: declaration.validated_at,
        };
    },
};

module.exports = declarationsService;
