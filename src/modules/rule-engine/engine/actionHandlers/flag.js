/**
 * Flag Action Handler
 * Sets boolean flags for declaration
 */

const flagHandler = {
    /**
     * Process flag action
     * @param {Object} action - Action definition { type: 'flag', set: { pril_1: true } }
     * @param {Object} rule - Rule that triggered this action
     * @param {Object} context - Engine context
     * @returns {Object|null}
     */
    handle(action, rule, context) {
        if (action.type !== 'flag') {
            return null;
        }

        const flagsToSet = action.set;
        if (!flagsToSet || typeof flagsToSet !== 'object') {
            throw new Error(`Flag action missing 'set' object in rule ${rule.id}`);
        }

        // Merge flags into context
        for (const [key, value] of Object.entries(flagsToSet)) {
            context.flags[key] = value;
        }

        // Track flag setting
        context.flagActions.push({
            ruleId: rule.id,
            flags: { ...flagsToSet },
        });

        return { flags: flagsToSet };
    },

    /**
     * Process flag rules that depend on accumulated field values
     * These are evaluated after all mappings are done
     * @param {Array} rules - Flag rules
     * @param {Object} context - Engine context
     */
    processConditionalFlags(rules, context) {
        for (const rule of rules) {
            // Check if rule conditions match against field values
            if (!this.evaluateFlagConditions(rule.conditions, context)) {
                continue;
            }

            const actions = rule.actions;
            if (!actions) continue;

            const actionList = Array.isArray(actions) ? actions : [actions];

            for (const action of actionList) {
                if (action.type === 'flag') {
                    this.handle(action, rule, context);
                }
            }
        }
    },

    /**
     * Evaluate flag conditions against field values
     * @param {Object} conditions
     * @param {Object} context
     * @returns {boolean}
     */
    evaluateFlagConditions(conditions, context) {
        if (!conditions) {
            return true;
        }

        // Handle "all" conditions
        if (conditions.all && Array.isArray(conditions.all)) {
            return conditions.all.every(cond => this.evaluateSingleFlagCondition(cond, context));
        }

        // Handle "any" conditions
        if (conditions.any && Array.isArray(conditions.any)) {
            return conditions.any.some(cond => this.evaluateSingleFlagCondition(cond, context));
        }

        // Single condition
        return this.evaluateSingleFlagCondition(conditions, context);
    },

    /**
     * Evaluate single flag condition
     * @param {Object} condition
     * @param {Object} context
     * @returns {boolean}
     */
    evaluateSingleFlagCondition(condition, context) {
        const { field, op, value } = condition;

        // Get field value - support both event fields and logical fields
        let fieldValue;

        if (field && field.startsWith('field.')) {
            // Logical field reference
            const logicalField = field.replace('field.', '');
            fieldValue = context.fieldValues.get(logicalField) || 0;
        } else if (field && field.startsWith('LF_')) {
            // Direct logical field code
            fieldValue = context.fieldValues.get(field) || 0;
        } else {
            return true; // Unknown field type, pass
        }

        switch (op) {
            case '>':
            case 'gt':
                return fieldValue > value;
            case '>=':
            case 'gte':
                return fieldValue >= value;
            case '<':
            case 'lt':
                return fieldValue < value;
            case '<=':
            case 'lte':
                return fieldValue <= value;
            case '=':
            case 'eq':
                return fieldValue === value;
            case '!=':
            case 'neq':
                return fieldValue !== value;
            case 'exists':
                return fieldValue > 0;
            default:
                return true;
        }
    },
};

module.exports = flagHandler;
