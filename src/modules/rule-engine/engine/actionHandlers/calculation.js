/**
 * Calculation Action Handler
 * Computes derived logical fields using formulas
 */

const formulaEvaluator = require('../formulaEvaluator');

const calculationHandler = {
    /**
     * Process calculation action
     * @param {Object} action - Action definition { type: 'calc', target, formula }
     * @param {Object} rule - Rule that triggered this action
     * @param {Object} context - Engine context
     * @returns {Object|null} Calculation result
     */
    handle(action, rule, context) {
        if (action.type !== 'calc') {
            return null;
        }

        const target = action.target;
        if (!target) {
            throw new Error(`Calculation action missing target in rule ${rule.id}`);
        }

        const formula = action.formula;
        if (!formula) {
            throw new Error(`Calculation action missing formula in rule ${rule.id}`);
        }

        // Evaluate formula
        let result = formulaEvaluator.evaluate(formula, context.fieldValues);

        // Apply rounding if specified
        if (action.round !== undefined) {
            const precision = action.round;
            const multiplier = Math.pow(10, precision);
            result = Math.round(result * multiplier) / multiplier;
        }

        // Ensure non-negative if specified
        if (action.min !== undefined && result < action.min) {
            result = action.min;
        }

        if (action.max !== undefined && result > action.max) {
            result = action.max;
        }

        // Store result
        context.fieldValues.set(target, result);

        // Track calculation
        context.calculations.push({
            logicalField: target,
            value: result,
            ruleId: rule.id,
        });

        return { logicalField: target, value: result };
    },

    /**
     * Process multiple calculations in order
     * @param {Array} rules - Calculation rules
     * @param {Object} context - Engine context
     */
    processAll(rules, context) {
        for (const rule of rules) {
            const actions = rule.actions;
            if (!actions) continue;

            // Actions can be single object or array
            const actionList = Array.isArray(actions) ? actions : [actions];

            for (const action of actionList) {
                if (action.type === 'calc') {
                    this.handle(action, rule, context);
                }
            }
        }
    },
};

module.exports = calculationHandler;
