/**
 * Formula Evaluator
 * Evaluates calculation formulas for derived logical fields
 */

const formulaEvaluator = {
    /**
     * Evaluate a formula against accumulated values
     * @param {Object} formula - Formula definition
     * @param {Map<string, number>} fieldValues - Current logical field values
     * @returns {number}
     */
    evaluate(formula, fieldValues) {
        if (!formula) {
            return 0;
        }

        // Direct numeric value
        if (typeof formula === 'number') {
            return formula;
        }

        // Reference to another field
        if (formula.ref) {
            return this.getFieldValue(formula.ref, fieldValues);
        }

        // Operation
        if (formula.op) {
            return this.evaluateOperation(formula, fieldValues);
        }

        return 0;
    },

    /**
     * Evaluate an operation
     * @param {Object} formula - { op, a, b, refs }
     * @param {Map<string, number>} fieldValues
     * @returns {number}
     */
    evaluateOperation(formula, fieldValues) {
        const { op, a, b, refs } = formula;

        switch (op) {
            case 'sum': {
                // Sum multiple refs
                if (refs && Array.isArray(refs)) {
                    return refs.reduce((sum, ref) => {
                        const val = typeof ref === 'string'
                            ? this.getFieldValue(ref, fieldValues)
                            : this.evaluate(ref, fieldValues);
                        return sum + val;
                    }, 0);
                }
                // Sum of two operands
                return this.evaluate(a, fieldValues) + this.evaluate(b, fieldValues);
            }

            case 'sub': {
                const aVal = this.evaluate(a, fieldValues);
                const bVal = this.evaluate(b, fieldValues);
                return aVal - bVal;
            }

            case 'mul': {
                const aVal = this.evaluate(a, fieldValues);
                const bVal = this.evaluate(b, fieldValues);
                return aVal * bVal;
            }

            case 'div': {
                const aVal = this.evaluate(a, fieldValues);
                const bVal = this.evaluate(b, fieldValues);
                if (bVal === 0) {
                    return 0; // Avoid division by zero
                }
                return aVal / bVal;
            }

            case 'max': {
                if (refs && Array.isArray(refs)) {
                    const values = refs.map(ref =>
                        typeof ref === 'string'
                            ? this.getFieldValue(ref, fieldValues)
                            : this.evaluate(ref, fieldValues)
                    );
                    return Math.max(...values, 0);
                }
                return Math.max(
                    this.evaluate(a, fieldValues),
                    this.evaluate(b, fieldValues)
                );
            }

            case 'min': {
                if (refs && Array.isArray(refs)) {
                    const values = refs.map(ref =>
                        typeof ref === 'string'
                            ? this.getFieldValue(ref, fieldValues)
                            : this.evaluate(ref, fieldValues)
                    );
                    return values.length > 0 ? Math.min(...values) : 0;
                }
                return Math.min(
                    this.evaluate(a, fieldValues),
                    this.evaluate(b, fieldValues)
                );
            }

            case 'round': {
                const val = this.evaluate(a, fieldValues);
                const precision = b !== undefined ? this.evaluate(b, fieldValues) : 0;
                const multiplier = Math.pow(10, precision);
                return Math.round(val * multiplier) / multiplier;
            }

            case 'floor': {
                return Math.floor(this.evaluate(a, fieldValues));
            }

            case 'ceil': {
                return Math.ceil(this.evaluate(a, fieldValues));
            }

            case 'abs': {
                return Math.abs(this.evaluate(a, fieldValues));
            }

            case 'percent': {
                // Calculate percentage: a * b / 100
                const base = this.evaluate(a, fieldValues);
                const rate = this.evaluate(b, fieldValues);
                return base * rate / 100;
            }

            case 'if': {
                // Conditional: { op: 'if', condition, then, else }
                const condValue = this.evaluate(formula.condition, fieldValues);
                if (condValue > 0) {
                    return this.evaluate(formula.then, fieldValues);
                }
                return this.evaluate(formula.else || 0, fieldValues);
            }

            case 'gt': {
                return this.evaluate(a, fieldValues) > this.evaluate(b, fieldValues) ? 1 : 0;
            }

            case 'gte': {
                return this.evaluate(a, fieldValues) >= this.evaluate(b, fieldValues) ? 1 : 0;
            }

            case 'lt': {
                return this.evaluate(a, fieldValues) < this.evaluate(b, fieldValues) ? 1 : 0;
            }

            case 'lte': {
                return this.evaluate(a, fieldValues) <= this.evaluate(b, fieldValues) ? 1 : 0;
            }

            case 'eq': {
                return this.evaluate(a, fieldValues) === this.evaluate(b, fieldValues) ? 1 : 0;
            }

            default:
                console.warn(`Unknown formula operation: ${op}`);
                return 0;
        }
    },

    /**
     * Get value of a logical field
     * @param {string} fieldCode
     * @param {Map<string, number>} fieldValues
     * @returns {number}
     */
    getFieldValue(fieldCode, fieldValues) {
        if (fieldValues.has(fieldCode)) {
            return fieldValues.get(fieldCode);
        }
        return 0;
    },
};

module.exports = formulaEvaluator;
