/**
 * Condition Evaluator
 * Evaluates rule conditions against tax events
 */

const conditionEvaluator = {
    /**
     * Evaluate conditions against an event
     * @param {Object} conditions - Conditions JSON from rule
     * @param {Object} event - Tax event from DB
     * @returns {boolean}
     */
    evaluate(conditions, event) {
        if (!conditions) {
            return true; // No conditions = always match
        }

        // Handle "always" condition
        if (conditions.always === true) {
            return true;
        }

        // Handle "all" (AND) conditions
        if (conditions.all && Array.isArray(conditions.all)) {
            return conditions.all.every(cond => this.evaluateSingle(cond, event));
        }

        // Handle "any" (OR) conditions
        if (conditions.any && Array.isArray(conditions.any)) {
            return conditions.any.some(cond => this.evaluateSingle(cond, event));
        }

        // Single condition old format: { field, op, value }
        if (conditions.field && conditions.op) {
            return this.evaluateSingle(conditions, event);
        }

        // Compact format: { "field_name": { "op": "value" } }
        // e.g. { "event_type": { "=": "EV_FOREIGN_DIVIDENDS" } }
        const keys = Object.keys(conditions);
        if (keys.length === 1) {
            const field = keys[0];
            const opValue = conditions[field];
            if (opValue && typeof opValue === 'object') {
                const ops = Object.keys(opValue);
                if (ops.length === 1) {
                    const op = ops[0];
                    const value = opValue[op];
                    // Add "event." prefix if not present for event fields
                    const fullField = field.startsWith('event.') ? field : `event.${field}`;
                    return this.evaluateSingle({ field: fullField, op, value }, event);
                }
            }
        }

        return true;
    },

    /**
     * Evaluate a single condition
     * @param {Object} condition - { field, op, value }
     * @param {Object} event - Tax event
     * @returns {boolean}
     */
    evaluateSingle(condition, event) {
        const { field, op, value } = condition;

        const fieldValue = this.getFieldValue(field, event);

        switch (op) {
            case '=':
            case 'eq':
                return fieldValue === value;

            case '!=':
            case 'neq':
                return fieldValue !== value;

            case 'in':
                return Array.isArray(value) && value.includes(fieldValue);

            case 'not_in':
                return Array.isArray(value) && !value.includes(fieldValue);

            case '>':
            case 'gt':
                return this.toNumber(fieldValue) > this.toNumber(value);

            case '>=':
            case 'gte':
                return this.toNumber(fieldValue) >= this.toNumber(value);

            case '<':
            case 'lt':
                return this.toNumber(fieldValue) < this.toNumber(value);

            case '<=':
            case 'lte':
                return this.toNumber(fieldValue) <= this.toNumber(value);

            case 'exists':
                return fieldValue !== null && fieldValue !== undefined;

            case 'not_exists':
                return fieldValue === null || fieldValue === undefined;

            case 'contains':
                return typeof fieldValue === 'string' && fieldValue.includes(value);

            case 'starts_with':
                return typeof fieldValue === 'string' && fieldValue.startsWith(value);

            case 'ends_with':
                return typeof fieldValue === 'string' && fieldValue.endsWith(value);

            default:
                console.warn(`Unknown operator: ${op}`);
                return false;
        }
    },

    /**
     * Get field value from event using dot notation
     * Supported fields:
     * - event.event_type
     * - event.amount
     * - event.currency
     * - event.event_date
     * - event.tax_year
     * - event.metadata.<key>
     * 
     * @param {string} fieldPath
     * @param {Object} event
     * @returns {*}
     */
    getFieldValue(fieldPath, event) {
        if (!fieldPath || typeof fieldPath !== 'string') {
            return null;
        }

        const parts = fieldPath.split('.');

        // Must start with 'event'
        if (parts[0] !== 'event') {
            return null;
        }

        // Direct event fields
        if (parts.length === 2) {
            const field = parts[1];

            // Map to DB column names
            const fieldMap = {
                'event_type': event.event_type,
                'eventType': event.event_type,
                'amount': event.amount !== null ? parseFloat(event.amount) : null,
                'currency': event.currency,
                'event_date': event.event_date,
                'eventDate': event.event_date,
                'tax_year': event.tax_year,
                'taxYear': event.tax_year,
                'id': event.id,
                'source_record_id': event.source_record_id,
            };

            return fieldMap[field] !== undefined ? fieldMap[field] : null;
        }

        // Metadata fields: event.metadata.<key>
        if (parts.length >= 3 && parts[1] === 'metadata') {
            if (!event.metadata) {
                return null;
            }

            // Support nested metadata paths
            let value = event.metadata;
            for (let i = 2; i < parts.length; i++) {
                if (value && typeof value === 'object') {
                    value = value[parts[i]];
                } else {
                    return null;
                }
            }
            return value;
        }

        return null;
    },

    /**
     * Convert value to number for comparison
     * @param {*} value
     * @returns {number}
     */
    toNumber(value) {
        if (typeof value === 'number') {
            return value;
        }
        if (typeof value === 'string') {
            const parsed = parseFloat(value);
            return isNaN(parsed) ? 0 : parsed;
        }
        return 0;
    },
};

module.exports = conditionEvaluator;
