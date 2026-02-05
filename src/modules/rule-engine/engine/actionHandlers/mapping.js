/**
 * Mapping Action Handler
 * Maps tax events to logical fields
 */

const mappingHandler = {
    /**
     * Process mapping action
     * @param {Object} action - Action definition { type: 'map', logical_field, amount_source }
     * @param {Object} event - Tax event
     * @param {Object} rule - Rule that triggered this action
     * @param {Object} context - Engine context
     * @returns {Object|null} Mapping record or null
     */
    handle(action, event, rule, context) {
        if (action.type !== 'map') {
            return null;
        }

        const logicalField = action.logical_field;
        if (!logicalField) {
            throw new Error(`Mapping action missing logical_field in rule ${rule.id}`);
        }

        // Determine amount
        let amount = this.extractAmount(action, event);

        // Apply multiplier if specified
        if (action.multiplier !== undefined) {
            amount *= action.multiplier;
        }

        // Apply rounding if specified
        if (action.round !== undefined) {
            const precision = action.round;
            const multiplier = Math.pow(10, precision);
            amount = Math.round(amount * multiplier) / multiplier;
        }

        // Create mapping record
        const mapping = {
            taxEventId: event.id,
            taxYear: event.tax_year,
            logicalField: logicalField,
            amount: amount,
            ruleId: rule.id,
        };

        // Accumulate into field values
        const currentValue = context.fieldValues.get(logicalField) || 0;
        context.fieldValues.set(logicalField, currentValue + amount);

        // Track mapping
        context.mappings.push(mapping);

        return mapping;
    },

    /**
     * Extract amount from event based on action config
     * @param {Object} action
     * @param {Object} event
     * @returns {number}
     */
    extractAmount(action, event) {
        const source = action.amount_source || 'event.amount';

        // Direct value
        if (typeof action.amount === 'number') {
            return action.amount;
        }

        // Extract from event
        if (source === 'event.amount') {
            return event.amount !== null ? parseFloat(event.amount) : 0;
        }

        // Metadata field
        if (source.startsWith('event.metadata.')) {
            const key = source.replace('event.metadata.', '');
            if (event.metadata && event.metadata[key] !== undefined) {
                const val = parseFloat(event.metadata[key]);
                return isNaN(val) ? 0 : val;
            }
            return 0;
        }

        // Fixed value from action
        if (source === 'fixed' && action.amount !== undefined) {
            return parseFloat(action.amount) || 0;
        }

        return 0;
    },
};

module.exports = mappingHandler;
