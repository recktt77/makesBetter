/**
 * 1C Parser
 * Parses 1C accounting system export data
 */

const OneCParser = {
    /**
     * Parse source record with 1C data
     * @param {Object} sourceRecord - Source record from DB
     * @returns {Array<Object>} - Array of TaxEventInput
     */
    parse(sourceRecord) {
        const { id: sourceRecordId, tax_identity_id: taxIdentityId, raw_payload: payload } = sourceRecord;

        if (!payload) {
            throw new Error('1C parser: raw_payload is required');
        }

        const events = [];

        // 1C documents format
        const documents = payload.documents || payload.docs || payload.data || [];

        if (Array.isArray(documents)) {
            for (let i = 0; i < documents.length; i++) {
                const doc = documents[i];
                try {
                    const docEvents = this.parseDocument(doc, taxIdentityId, sourceRecordId, payload);
                    events.push(...docEvents);
                } catch (error) {
                    throw new Error(`1C parser: document ${i + 1} - ${error.message}`);
                }
            }
        }

        // Single document format
        if (!documents.length && payload.doc_type) {
            const docEvents = this.parseDocument(payload, taxIdentityId, sourceRecordId, payload);
            events.push(...docEvents);
        }

        // Operations format (alternative 1C export)
        if (payload.operations && Array.isArray(payload.operations)) {
            for (let i = 0; i < payload.operations.length; i++) {
                const op = payload.operations[i];
                try {
                    const event = this.parseOperation(op, taxIdentityId, sourceRecordId, payload);
                    if (event) events.push(event);
                } catch (error) {
                    throw new Error(`1C parser: operation ${i + 1} - ${error.message}`);
                }
            }
        }

        if (events.length === 0) {
            throw new Error('1C parser: no valid events found in payload');
        }

        return events;
    },

    /**
     * Parse 1C document
     * @param {Object} doc
     * @param {string} taxIdentityId
     * @param {string} sourceRecordId
     * @param {Object} originalPayload
     * @returns {Array<Object>}
     */
    parseDocument(doc, taxIdentityId, sourceRecordId, originalPayload) {
        const events = [];

        const docType = (doc.doc_type || doc.type || doc.documentType || '').toLowerCase();
        const eventDate = this.extractDate(doc);

        if (!eventDate) {
            throw new Error('date field not found');
        }

        // Skip expense documents for now (only income is relevant for 270.00)
        if (this.isExpenseDocument(docType)) {
            return events;
        }

        // Handle tabular part (multiple items in one document)
        if (doc.items && Array.isArray(doc.items)) {
            for (const item of doc.items) {
                const event = this.createEventFromDocItem(doc, item, taxIdentityId, sourceRecordId, eventDate, originalPayload);
                if (event) events.push(event);
            }
        } else {
            // Single-line document
            const event = this.createEventFromDoc(doc, taxIdentityId, sourceRecordId, eventDate, originalPayload);
            if (event) events.push(event);
        }

        return events;
    },

    /**
     * Create event from document with items
     * @param {Object} doc
     * @param {Object} item
     * @param {string} taxIdentityId
     * @param {string} sourceRecordId
     * @param {string} eventDate
     * @param {Object} originalPayload
     * @returns {Object|null}
     */
    createEventFromDocItem(doc, item, taxIdentityId, sourceRecordId, eventDate, originalPayload) {
        const amount = this.extractAmount(item) || this.extractAmount(doc);
        if (!amount) return null;

        const eventType = this.determineEventType(doc, item);

        return {
            taxIdentityId,
            sourceRecordId,
            eventType,
            eventDate,
            amount,
            currency: this.normalizeCurrency(item.currency || doc.currency),
            metadata: {
                source_system: '1C',
                version: originalPayload.version,
                doc_type: doc.doc_type || doc.type,
                doc_number: doc.number || doc.doc_number,
                doc_date: doc.date,
                item_name: item.name || item.nomenclature,
                item_code: item.code,
                counterparty: doc.counterparty || doc.contractor,
                counterparty_bin: doc.counterparty_bin || doc.bin,
            },
        };
    },

    /**
     * Create event from simple document
     * @param {Object} doc
     * @param {string} taxIdentityId
     * @param {string} sourceRecordId
     * @param {string} eventDate
     * @param {Object} originalPayload
     * @returns {Object|null}
     */
    createEventFromDoc(doc, taxIdentityId, sourceRecordId, eventDate, originalPayload) {
        const amount = this.extractAmount(doc);
        if (!amount) return null;

        const eventType = this.determineEventType(doc);

        return {
            taxIdentityId,
            sourceRecordId,
            eventType,
            eventDate,
            amount,
            currency: this.normalizeCurrency(doc.currency),
            metadata: {
                source_system: '1C',
                version: originalPayload.version,
                doc_type: doc.doc_type || doc.type,
                doc_number: doc.number || doc.doc_number,
                counterparty: doc.counterparty || doc.contractor,
                counterparty_bin: doc.counterparty_bin || doc.bin,
                description: doc.description || doc.comment,
            },
        };
    },

    /**
     * Parse 1C operation (alternative format)
     * @param {Object} op
     * @param {string} taxIdentityId
     * @param {string} sourceRecordId
     * @param {Object} originalPayload
     * @returns {Object|null}
     */
    parseOperation(op, taxIdentityId, sourceRecordId, originalPayload) {
        const eventDate = this.extractDate(op);
        if (!eventDate) {
            throw new Error('date field not found');
        }

        const amount = this.extractAmount(op);
        if (!amount) return null;

        const eventType = this.determineEventType(op);

        return {
            taxIdentityId,
            sourceRecordId,
            eventType,
            eventDate,
            amount,
            currency: this.normalizeCurrency(op.currency),
            metadata: {
                source_system: '1C',
                version: originalPayload.version,
                operation_type: op.operation_type || op.type,
                debit_account: op.debit_account || op.dt,
                credit_account: op.credit_account || op.kt,
                description: op.description || op.content,
            },
        };
    },

    /**
     * Check if document is expense type
     * @param {string} docType
     * @returns {boolean}
     */
    isExpenseDocument(docType) {
        const expenseTypes = [
            'рко', 'расходный', 'expense', 'payment', 'выплата',
            'списание', 'write-off', 'расход'
        ];
        return expenseTypes.some(t => docType.includes(t));
    },

    /**
     * Determine event type from 1C document
     * @param {Object} doc
     * @param {Object} item
     * @returns {string}
     */
    determineEventType(doc, item = null) {
        const docType = (doc.doc_type || doc.type || '').toLowerCase();
        const description = (doc.description || doc.comment || item?.name || '').toLowerCase();

        // Income types
        if (docType.includes('пко') || docType.includes('приходный') || docType.includes('income')) {
            if (description.includes('аренд') || description.includes('rent')) {
                return 'INCOME_RENT';
            }
            if (description.includes('имущество') || description.includes('property')) {
                return 'INCOME_PROPERTY_KZ';
            }
            return 'INCOME_OTHER';
        }

        // Sales
        if (docType.includes('реализация') || docType.includes('sale') || docType.includes('продажа')) {
            if (description.includes('имущество') || description.includes('недвижим')) {
                return 'INCOME_PROPERTY_KZ';
            }
            return 'INCOME_OTHER';
        }

        // Services
        if (docType.includes('услуг') || docType.includes('service')) {
            return 'PRIVATE_PRACTICE_INCOME';
        }

        return 'INCOME_OTHER';
    },

    /**
     * Extract date from document
     * @param {Object} doc
     * @returns {string|null}
     */
    extractDate(doc) {
        const dateFields = ['date', 'doc_date', 'document_date', 'дата', 'operation_date'];

        for (const field of dateFields) {
            if (doc[field]) {
                try {
                    return this.normalizeDate(doc[field]);
                } catch {
                    continue;
                }
            }
        }

        return null;
    },

    /**
     * Normalize date
     * @param {string|Date} date
     * @returns {string}
     */
    normalizeDate(date) {
        // 1C often uses DD.MM.YYYY format
        if (typeof date === 'string' && /^\d{2}\.\d{2}\.\d{4}/.test(date)) {
            const datePart = date.split(' ')[0];
            const [day, month, year] = datePart.split('.');
            date = `${year}-${month}-${day}`;
        }

        const parsed = new Date(date);
        if (isNaN(parsed.getTime())) {
            throw new Error(`invalid date: ${date}`);
        }
        return parsed.toISOString().split('T')[0];
    },

    /**
     * Extract amount from document
     * @param {Object} doc
     * @returns {number|null}
     */
    extractAmount(doc) {
        const amountFields = ['amount', 'sum', 'сумма', 'total', 'итого', 'value'];

        for (const field of amountFields) {
            if (doc[field] !== undefined && doc[field] !== null) {
                const cleaned = String(doc[field]).replace(/\s/g, '').replace(',', '.');
                const parsed = parseFloat(cleaned);
                if (!isNaN(parsed) && parsed > 0) {
                    return parsed;
                }
            }
        }

        return null;
    },

    /**
     * Normalize currency
     * @param {string} currency
     * @returns {string}
     */
    normalizeCurrency(currency) {
        if (!currency) return 'KZT';

        const normalized = currency.toUpperCase().trim();

        const currencyMap = {
            'ТЕНГЕ': 'KZT',
            'ТГ': 'KZT',
            '₸': 'KZT',
            'ДОЛЛАР': 'USD',
            'РУБЛЬ': 'RUB',
            'ЕВРО': 'EUR',
        };

        return currencyMap[normalized] || normalized.substring(0, 3);
    },
};

module.exports = OneCParser;
