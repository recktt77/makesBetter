/**
 * Excel Parser
 * Parses Excel-imported data into tax events
 * Similar to CSV but with sheet support
 */

const CsvParser = require('./csv.parser');

const ExcelParser = {
    /**
     * Parse source record with Excel data
     * @param {Object} sourceRecord - Source record from DB
     * @returns {Array<Object>} - Array of TaxEventInput
     */
    parse(sourceRecord) {
        const { id: sourceRecordId, tax_identity_id: taxIdentityId, raw_payload: payload } = sourceRecord;

        if (!payload) {
            throw new Error('Excel parser: raw_payload is required');
        }

        const events = [];

        // Single sheet format: { rows: [...], sheet: '...', filename: '...' }
        if (payload.rows || payload.data) {
            const sheetEvents = this.parseSheet(payload, taxIdentityId, sourceRecordId);
            events.push(...sheetEvents);
        }

        // Multiple sheets format: { sheets: { 'Sheet1': [...], 'Sheet2': [...] } }
        if (payload.sheets && typeof payload.sheets === 'object') {
            for (const [sheetName, rows] of Object.entries(payload.sheets)) {
                const sheetPayload = { rows, sheet: sheetName };
                const sheetEvents = this.parseSheet(sheetPayload, taxIdentityId, sourceRecordId, sheetName);
                events.push(...sheetEvents);
            }
        }

        if (events.length === 0) {
            throw new Error('Excel parser: no valid events found in payload');
        }

        return events;
    },

    /**
     * Parse single sheet
     * @param {Object} sheetData
     * @param {string} taxIdentityId
     * @param {string} sourceRecordId
     * @param {string} sheetName
     * @returns {Array<Object>}
     */
    parseSheet(sheetData, taxIdentityId, sourceRecordId, sheetName = null) {
        const rows = sheetData.rows || sheetData.data || [];
        const events = [];

        if (!Array.isArray(rows)) {
            return events;
        }

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            try {
                // Reuse CSV row parsing logic
                const event = CsvParser.parseRow(row, taxIdentityId, sourceRecordId, i);
                if (event) {
                    // Add sheet info to metadata
                    if (sheetName) {
                        event.metadata = {
                            ...event.metadata,
                            _sheet: sheetName,
                        };
                    }
                    events.push(event);
                }
            } catch (error) {
                const sheetInfo = sheetName ? ` (sheet: ${sheetName})` : '';
                throw new Error(`Excel parser: row ${i + 1}${sheetInfo} - ${error.message}`);
            }
        }

        return events;
    },
};

module.exports = ExcelParser;
