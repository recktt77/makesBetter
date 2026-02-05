/**
 * Tax Events Parser Manager
 * Selects and executes appropriate parser based on source type
 */

const ManualParser = require('./parsers/manual.parser');
const CsvParser = require('./parsers/csv.parser');
const ExcelParser = require('./parsers/excel.parser');
const BankParser = require('./parsers/bank.parser');
const ApiParser = require('./parsers/api.parser');
const OneCParser = require('./parsers/1c.parser');

const taxEventsParser = {
    /**
     * Get parser for source type
     * @param {string} sourceType
     * @returns {Object} Parser module
     */
    getParser(sourceType) {
        const parsers = {
            'manual': ManualParser,
            'csv': CsvParser,
            'excel': ExcelParser,
            'bank': BankParser,
            'api': ApiParser,
            '1c': OneCParser,
        };

        const parser = parsers[sourceType];

        if (!parser) {
            throw new Error(`Unknown source type: ${sourceType}. Supported: ${Object.keys(parsers).join(', ')}`);
        }

        return parser;
    },

    /**
     * Parse source record into tax events
     * @param {Object} sourceRecord - Full source record from DB
     * @returns {Array<Object>} Array of TaxEventInput objects
     */
    parse(sourceRecord) {
        if (!sourceRecord) {
            throw new Error('Source record is required');
        }

        if (!sourceRecord.source_type) {
            throw new Error('Source record must have source_type');
        }

        if (!sourceRecord.raw_payload) {
            throw new Error('Source record must have raw_payload');
        }

        const parser = this.getParser(sourceRecord.source_type);

        try {
            const events = parser.parse(sourceRecord);

            // Validate all events
            for (let i = 0; i < events.length; i++) {
                this.validateEvent(events[i], i);
            }

            return events;
        } catch (error) {
            // Re-throw with more context
            throw new Error(`Parsing failed for source ${sourceRecord.id}: ${error.message}`);
        }
    },

    /**
     * Validate parsed event
     * @param {Object} event
     * @param {number} index
     */
    validateEvent(event, index) {
        const errors = [];

        if (!event.taxIdentityId) {
            errors.push('taxIdentityId is required');
        }

        if (!event.sourceRecordId) {
            errors.push('sourceRecordId is required');
        }

        if (!event.eventType) {
            errors.push('eventType is required');
        }

        if (!event.eventDate) {
            errors.push('eventDate is required');
        }

        // Validate date format
        if (event.eventDate) {
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(event.eventDate)) {
                errors.push(`eventDate must be YYYY-MM-DD format, got: ${event.eventDate}`);
            }
        }

        // Validate currency if present
        if (event.currency && event.currency.length !== 3) {
            errors.push(`currency must be 3-letter ISO code, got: ${event.currency}`);
        }

        // Validate amount if present
        if (event.amount !== null && event.amount !== undefined) {
            if (typeof event.amount !== 'number' || isNaN(event.amount)) {
                errors.push(`amount must be a number, got: ${typeof event.amount}`);
            }
        }

        if (errors.length > 0) {
            throw new Error(`Event ${index + 1} validation failed: ${errors.join('; ')}`);
        }
    },

    /**
     * Get list of supported source types
     * @returns {Array<string>}
     */
    getSupportedTypes() {
        return ['manual', 'csv', 'excel', 'bank', 'api', '1c'];
    },
};

module.exports = taxEventsParser;
