/**
 * Rule Engine Runner
 * Orchestrates the transformation of tax_events → tax_mappings → declaration_items
 */

const conditionEvaluator = require('./conditionEvaluator');
const mappingHandler = require('./actionHandlers/mapping');
const calculationHandler = require('./actionHandlers/calculation');
const flagHandler = require('./actionHandlers/flag');

const runEngine = {
    /**
     * Run the rule engine for a tax identity and year
     * 
     * @param {Array} events - Tax events from DB
     * @param {Array} rules - Active rules for the year
     * @param {Object} options - Additional options
     * @returns {Object} Engine result
     */
    run(events, rules, options = {}) {
        // Initialize context
        const context = {
            fieldValues: new Map(),     // logical_field -> accumulated amount
            mappings: [],               // tax_mappings to insert
            calculations: [],           // calculated field results
            flags: {},                  // declaration flags
            flagActions: [],            // flag action audit
            excludedEventIds: new Set(), // events to exclude
            errors: [],                 // processing errors
            stats: {
                eventsProcessed: 0,
                eventsExcluded: 0,
                mappingsCreated: 0,
                rulesMatched: 0,
            },
        };

        // Phase 1: Apply exclusion rules
        const exclusionRules = rules.filter(r => r.rule_type === 'exclusion');
        this.applyExclusions(events, exclusionRules, context);

        // Phase 2: Apply mapping rules
        const mappingRules = rules.filter(r => r.rule_type === 'mapping');
        this.applyMappings(events, mappingRules, context);

        // Phase 3: Auto-calculate base totals (LF_INCOME_TOTAL, etc.) BEFORE custom calculations
        this.autoCalculateBaseTotals(context);

        // Phase 4: Apply calculation rules (order by priority) - for custom formulas
        const calculationRules = rules.filter(r => r.rule_type === 'calculation');
        calculationHandler.processAll(calculationRules, context);

        // Phase 5: Auto-calculate derived fields (taxable income, IPN) if not set by rules
        this.autoCalculateDerivedFields(context);

        // Phase 6: Apply flag rules based on accumulated values
        const flagRules = rules.filter(r => r.rule_type === 'flag');
        flagHandler.processConditionalFlags(flagRules, context);

        // Phase 7: Auto-set flags based on field values
        this.autoSetFlags(context);

        // Convert fieldValues Map to plain object for output
        const fieldValuesObj = {};
        for (const [key, value] of context.fieldValues) {
            fieldValuesObj[key] = value;
        }

        return {
            fieldValues: fieldValuesObj,
            mappings: context.mappings,
            calculations: context.calculations,
            flags: context.flags,
            excludedEventIds: Array.from(context.excludedEventIds),
            stats: context.stats,
            errors: context.errors,
        };
    },

    /**
     * Phase 1: Apply exclusion rules
     * Marks events that should not be mapped
     */
    applyExclusions(events, rules, context) {
        for (const event of events) {
            for (const rule of rules) {
                if (conditionEvaluator.evaluate(rule.conditions, event)) {
                    context.excludedEventIds.add(event.id);
                    context.stats.eventsExcluded++;
                    break; // Event is excluded, no need to check more rules
                }
            }
        }
    },

    /**
     * Phase 2: Apply mapping rules
     * Maps events to logical fields
     */
    applyMappings(events, rules, context) {
        for (const event of events) {
            // Skip excluded events
            if (context.excludedEventIds.has(event.id)) {
                continue;
            }

            context.stats.eventsProcessed++;

            // Find matching rules for this event
            for (const rule of rules) {
                try {
                    if (conditionEvaluator.evaluate(rule.conditions, event)) {
                        context.stats.rulesMatched++;

                        // Process actions
                        const actions = rule.actions;
                        if (!actions) continue;

                        const actionList = Array.isArray(actions) ? actions : [actions];

                        for (const action of actionList) {
                            if (action.type === 'map') {
                                mappingHandler.handle(action, event, rule, context);
                                context.stats.mappingsCreated++;
                            }
                            // Handle inline flags from mapping rules
                            if (action.type === 'flag') {
                                flagHandler.handle(action, rule, context);
                            }
                        }
                    }
                } catch (error) {
                    context.errors.push({
                        ruleId: rule.id,
                        eventId: event.id,
                        error: error.message,
                    });
                }
            }
        }
    },

    /**
     * Phase 3: Calculate base totals from mapped values
     * Must run BEFORE custom calculation rules
     */
    autoCalculateBaseTotals(context) {
        const fv = context.fieldValues;

        // LF_INCOME_PROPERTY_TOTAL = sum of property incomes
        if (!fv.has('LF_INCOME_PROPERTY_TOTAL')) {
            const propertyTotal =
                (fv.get('LF_INCOME_PROPERTY_KZ') || 0) +
                (fv.get('LF_INCOME_PROPERTY_FOREIGN') || 0) +
                (fv.get('LF_INCOME_PROPERTY_CAPITAL_CONTRIBUTION') || 0);
            if (propertyTotal > 0) {
                fv.set('LF_INCOME_PROPERTY_TOTAL', propertyTotal);
            }
        }

        // LF_INCOME_FOREIGN_TOTAL = sum of foreign incomes
        if (!fv.has('LF_INCOME_FOREIGN_TOTAL')) {
            const foreignIncomes = [
                'LF_INCOME_FOREIGN_EMPLOYMENT',
                'LF_INCOME_FOREIGN_GPC',
                'LF_INCOME_FOREIGN_WIN',
                'LF_INCOME_FOREIGN_DIVIDENDS',
                'LF_INCOME_FOREIGN_INTEREST',
                'LF_INCOME_FOREIGN_SCHOLARSHIP',
                'LF_INCOME_FOREIGN_INSURANCE',
                'LF_INCOME_FOREIGN_PENSION',
                'LF_INCOME_FOREIGN_OTHER',
            ];
            const foreignTotal = foreignIncomes.reduce((sum, code) => sum + (fv.get(code) || 0), 0);
            if (foreignTotal > 0) {
                fv.set('LF_INCOME_FOREIGN_TOTAL', foreignTotal);
            }
        }

        // LF_DEDUCTION_TOTAL = sum of deductions
        if (!fv.has('LF_DEDUCTION_TOTAL')) {
            const deductionTotal =
                (fv.get('LF_DEDUCTION_STANDARD') || 0) +
                (fv.get('LF_DEDUCTION_OTHER') || 0);
            if (deductionTotal > 0) {
                fv.set('LF_DEDUCTION_TOTAL', deductionTotal);
            }
        }

        // LF_ADJUSTMENT_TOTAL = sum of adjustments
        if (!fv.has('LF_ADJUSTMENT_TOTAL')) {
            const adjustmentTotal =
                (fv.get('LF_ADJUSTMENT_EXCLUDED_ART_341') || 0) +
                (fv.get('LF_ADJUSTMENT_EXCLUDED_ART_654') || 0) +
                (fv.get('LF_ADJUSTMENT_EXCLUDED_TREATY') || 0) +
                (fv.get('LF_ADJUSTMENT_EXCLUDED_AIFC') || 0);
            if (adjustmentTotal > 0) {
                fv.set('LF_ADJUSTMENT_TOTAL', adjustmentTotal);
            }
        }

        // LF_INCOME_TOTAL = sum of all income categories
        if (!fv.has('LF_INCOME_TOTAL')) {
            const incomeCategories = [
                'LF_INCOME_PROPERTY_TOTAL',
                'LF_INCOME_RENT_NON_AGENT',
                'LF_INCOME_ASSIGNMENT_RIGHTS',
                'LF_INCOME_IP_OTHER_ASSETS',
                'LF_INCOME_FOREIGN_TOTAL',
                'LF_INCOME_DOMESTIC_HELPERS',
                'LF_INCOME_CITIZENS_GPC',
                'LF_INCOME_MEDIATOR',
                'LF_INCOME_SUBSIDIARY_FARM',
                'LF_INCOME_LABOR_MIGRANT',
                'LF_INCOME_OTHER_NON_AGENT',
                'LF_INCOME_CFC_PROFIT',
            ];
            const incomeTotal = incomeCategories.reduce((sum, code) => sum + (fv.get(code) || 0), 0);
            if (incomeTotal > 0) {
                fv.set('LF_INCOME_TOTAL', incomeTotal);
            }
        }
    },

    /**
     * Phase 5: Calculate derived fields (taxable income, IPN)
     * Runs AFTER custom calculation rules
     */
    autoCalculateDerivedFields(context) {
        const fv = context.fieldValues;

        // LF_TAXABLE_INCOME = income - adjustments - deductions
        if (!fv.has('LF_TAXABLE_INCOME') || fv.get('LF_TAXABLE_INCOME') === 0) {
            const taxableIncome =
                (fv.get('LF_INCOME_TOTAL') || 0) -
                (fv.get('LF_ADJUSTMENT_TOTAL') || 0) -
                (fv.get('LF_DEDUCTION_TOTAL') || 0);
            fv.set('LF_TAXABLE_INCOME', Math.max(0, taxableIncome));
        }

        // LF_IPN_CALCULATED = taxable income * 10%
        if (!fv.has('LF_IPN_CALCULATED') || fv.get('LF_IPN_CALCULATED') === 0) {
            const taxableIncome = fv.get('LF_TAXABLE_INCOME') || 0;
            const ipn = Math.round(taxableIncome * 0.1);
            fv.set('LF_IPN_CALCULATED', ipn);
        }

        // LF_IPN_PAYABLE = calculated - foreign credits
        if (!fv.has('LF_IPN_PAYABLE') || fv.get('LF_IPN_PAYABLE') === 0) {
            const ipnCalculated = fv.get('LF_IPN_CALCULATED') || 0;
            const foreignCredit =
                (fv.get('LF_FOREIGN_TAX_CREDIT_GENERAL') || 0) +
                (fv.get('LF_FOREIGN_TAX_CREDIT_CFC') || 0);
            fv.set('LF_IPN_PAYABLE', Math.max(0, ipnCalculated - foreignCredit));
        }
    },

    /**
     * Phase 7: Auto-set flags based on calculated values
     */
    autoSetFlags(context) {
        const fv = context.fieldValues;

        if ((fv.get('LF_INCOME_TOTAL') || 0) > 0) {
            context.flags['has_income'] = true;
        }

        if ((fv.get('LF_INCOME_FOREIGN_TOTAL') || 0) > 0) {
            context.flags['has_foreign_income'] = true;
            context.flags['pril_2'] = true;
        }

        if ((fv.get('LF_INCOME_CFC_PROFIT') || 0) > 0) {
            context.flags['has_cfc'] = true;
            context.flags['pril_3'] = true;
        }

        if ((fv.get('LF_DEDUCTION_TOTAL') || 0) > 0) {
            context.flags['has_deductions'] = true;
        }

        if ((fv.get('LF_INCOME_PROPERTY_TOTAL') || 0) > 0 ||
            (fv.get('LF_INCOME_RENT_NON_AGENT') || 0) > 0 ||
            (fv.get('LF_INCOME_OTHER_NON_AGENT') || 0) > 0) {
            context.flags['pril_1'] = true;
        }
    },
};

module.exports = runEngine;
