const ruleEngineRepository = require('./ruleEngine.repository');
const runEngine = require('./engine/runEngine');
const identitiesRepository = require('../identities/identities.repository');

const ruleEngineService = {
    // ==========================================
    // MAIN ENGINE EXECUTION
    // ==========================================

    /**
     * Run the rule engine for a tax identity and year
     * This is the main entry point for calculating declaration
     * 
     * @param {string} taxIdentityId
     * @param {number} taxYear
     * @param {string} userId
     * @param {Object} options
     * @returns {Promise<Object>}
     */
    async runEngine(taxIdentityId, taxYear, userId, options = {}) {
        // 1. Check access
        const hasAccess = await identitiesRepository.userHasAccess(userId, taxIdentityId);
        if (!hasAccess) {
            throw new Error('No access to this tax identity');
        }

        // 2. Get tax events for the year
        const events = await ruleEngineRepository.getTaxEventsForEngine(taxIdentityId, taxYear);

        if (events.length === 0 && !options.allowEmpty) {
            throw new Error(`No tax events found for year ${taxYear}`);
        }

        // 3. Get active rules
        const rules = await ruleEngineRepository.getActiveRules(taxYear);

        // 4. Run the engine
        const result = runEngine.run(events, rules, options);

        // 5. If persist mode, save results to DB
        if (options.persist !== false) {
            await this.persistResults(taxIdentityId, taxYear, result, options.formCode);
        }

        return {
            taxIdentityId,
            taxYear,
            ...result,
        };
    },

    /**
     * Preview engine results without persisting
     * @param {string} taxIdentityId
     * @param {number} taxYear
     * @param {string} userId
     * @returns {Promise<Object>}
     */
    async previewEngine(taxIdentityId, taxYear, userId) {
        return this.runEngine(taxIdentityId, taxYear, userId, { persist: false, allowEmpty: true });
    },

    /**
     * Recalculate declaration (delete old, calculate new)
     * @param {string} taxIdentityId
     * @param {number} taxYear
     * @param {string} userId
     * @returns {Promise<Object>}
     */
    async recalculate(taxIdentityId, taxYear, userId) {
        // Check access (owner only for recalculation)
        const hasAccess = await identitiesRepository.userHasAccess(userId, taxIdentityId, ['owner']);
        if (!hasAccess) {
            throw new Error('Only owner can recalculate declaration');
        }

        // Delete existing mappings
        const deletedMappings = await ruleEngineRepository.deleteMappingsByIdentityYear(taxIdentityId, taxYear);

        // Run engine with persist
        const result = await this.runEngine(taxIdentityId, taxYear, userId, {
            persist: true,
            allowEmpty: true,
        });

        return {
            ...result,
            previousMappingsDeleted: deletedMappings,
        };
    },

    /**
     * Persist engine results to database
     * @param {string} taxIdentityId
     * @param {number} taxYear
     * @param {Object} result
     * @param {string} formCode
     */
    async persistResults(taxIdentityId, taxYear, result, formCode = '270.00') {
        // 1. Get or create declaration
        const declaration = await ruleEngineRepository.getOrCreateDeclaration(taxIdentityId, taxYear, formCode);

        // 2. Insert tax mappings
        if (result.mappings && result.mappings.length > 0) {
            await ruleEngineRepository.bulkInsertMappings(result.mappings);
        }

        // 3. Prepare declaration items from field values
        const items = [];
        for (const [logicalField, value] of Object.entries(result.fieldValues)) {
            if (value !== 0 && value !== null) {
                items.push({ logicalField, value });
            }
        }

        // 4. Delete old items and insert new
        await ruleEngineRepository.deleteDeclarationItems(declaration.id);
        if (items.length > 0) {
            await ruleEngineRepository.bulkUpsertDeclarationItems(declaration.id, items);
        }

        // 5. Update declaration flags
        if (result.flags && Object.keys(result.flags).length > 0) {
            await ruleEngineRepository.updateDeclarationFlags(declaration.id, result.flags);
        }

        // 6. Set declaration header from person data
        const person = await ruleEngineRepository.getPersonByTaxIdentity(taxIdentityId);
        if (person) {
            await ruleEngineRepository.setDeclarationHeader(declaration.id, {
                iin: person.iin,
                fioLast: person.last_name,
                fioFirst: person.first_name,
                fioMiddle: person.middle_name,
                phone: person.phone,
                email: person.email,
            });
        }

        return declaration;
    },

    // ==========================================
    // RULES CRUD
    // ==========================================

    /**
     * Create a new tax rule
     * @param {Object} ruleData
     * @returns {Promise<Object>}
     */
    async createRule(ruleData) {
        // Validate rule type
        const validTypes = ['mapping', 'exclusion', 'calculation', 'flag'];
        if (!validTypes.includes(ruleData.ruleType)) {
            throw new Error(`Invalid rule type. Must be one of: ${validTypes.join(', ')}`);
        }

        // Validate logical field exists for mapping rules
        if (ruleData.ruleType === 'mapping' && ruleData.actions) {
            const actions = Array.isArray(ruleData.actions) ? ruleData.actions : [ruleData.actions];
            for (const action of actions) {
                if (action.type === 'map' && action.logical_field) {
                    const exists = await ruleEngineRepository.logicalFieldExists(action.logical_field);
                    if (!exists) {
                        throw new Error(`Logical field not found: ${action.logical_field}`);
                    }
                }
            }
        }

        return await ruleEngineRepository.createRule(ruleData);
    },

    /**
     * Update a tax rule
     * @param {string} id
     * @param {Object} updates
     * @returns {Promise<Object>}
     */
    async updateRule(id, updates) {
        const existing = await ruleEngineRepository.getRuleById(id);
        if (!existing) {
            throw new Error('Rule not found');
        }

        return await ruleEngineRepository.updateRule(id, updates);
    },

    /**
     * Delete a tax rule
     * @param {string} id
     * @returns {Promise<boolean>}
     */
    async deleteRule(id) {
        return await ruleEngineRepository.deleteRule(id);
    },

    /**
     * Get rule by ID
     * @param {string} id
     * @returns {Promise<Object>}
     */
    async getRule(id) {
        const rule = await ruleEngineRepository.getRuleById(id);
        if (!rule) {
            throw new Error('Rule not found');
        }
        return rule;
    },

    /**
     * List rules with filters
     * @param {Object} options
     * @returns {Promise<Object>}
     */
    async listRules(options = {}) {
        return await ruleEngineRepository.listRules(options);
    },

    /**
     * Bulk create rules
     * @param {Array} rules
     * @returns {Promise<Array>}
     */
    async bulkCreateRules(rules) {
        const results = [];
        for (const ruleData of rules) {
            try {
                const rule = await this.createRule(ruleData);
                results.push({ success: true, rule });
            } catch (error) {
                results.push({ success: false, error: error.message, ruleData });
            }
        }
        return results;
    },

    // ==========================================
    // LOGICAL FIELDS
    // ==========================================

    /**
     * Get all logical fields
     * @returns {Promise<Array>}
     */
    async getLogicalFields() {
        return await ruleEngineRepository.getAllLogicalFields();
    },

    /**
     * Create logical field
     * @param {string} code
     * @param {string} description
     * @returns {Promise<Object>}
     */
    async createLogicalField(code, description) {
        if (!code || !description) {
            throw new Error('Code and description are required');
        }

        if (!/^LF_[A-Z_]+$/.test(code)) {
            throw new Error('Code must match pattern LF_[A-Z_]+');
        }

        return await ruleEngineRepository.createLogicalField(code, description);
    },

    /**
     * Bulk create logical fields
     * @param {Array} fields - Array of { code, description }
     * @returns {Promise<Array>}
     */
    async bulkCreateLogicalFields(fields) {
        const results = [];
        for (const field of fields) {
            const result = await ruleEngineRepository.createLogicalField(field.code, field.description);
            results.push(result);
        }
        return results;
    },

    // ==========================================
    // DECLARATION & MAPPINGS READ
    // ==========================================

    /**
     * Get declaration with items
     * @param {string} userId
     * @param {string} taxIdentityId
     * @param {number} taxYear
     * @returns {Promise<Object>}
     */
    async getDeclaration(userId, taxIdentityId, taxYear) {
        // Check access
        const hasAccess = await identitiesRepository.userHasAccess(userId, taxIdentityId);
        if (!hasAccess) {
            throw new Error('No access to this tax identity');
        }

        const declaration = await ruleEngineRepository.getOrCreateDeclaration(taxIdentityId, taxYear);
        const items = await ruleEngineRepository.getDeclarationItems(declaration.id);
        const mappings = await ruleEngineRepository.getMappingsByIdentityYear(taxIdentityId, taxYear);

        return {
            declaration,
            items,
            mappingsCount: mappings.length,
        };
    },

    /**
     * Get tax mappings for identity and year
     * @param {string} userId
     * @param {string} taxIdentityId
     * @param {number} taxYear
     * @returns {Promise<Array>}
     */
    async getMappings(userId, taxIdentityId, taxYear) {
        const hasAccess = await identitiesRepository.userHasAccess(userId, taxIdentityId);
        if (!hasAccess) {
            throw new Error('No access to this tax identity');
        }

        return await ruleEngineRepository.getMappingsByIdentityYear(taxIdentityId, taxYear);
    },
};

module.exports = ruleEngineService;
