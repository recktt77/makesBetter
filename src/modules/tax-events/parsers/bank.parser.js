/**
 * Bank Parser
 * Parses bank statement data into tax events
 */

const BankParser = {
    /**
     * Parse source record with bank statement data
     * @param {Object} sourceRecord - Source record from DB
     * @returns {Array<Object>} - Array of TaxEventInput
     */
    parse(sourceRecord) {
        const { id: sourceRecordId, tax_identity_id: taxIdentityId, raw_payload: payload } = sourceRecord;

        if (!payload) {
            throw new Error('Bank parser: raw_payload is required');
        }

        const events = [];

        // Expected format: { transactions: [...], bank_name: '...', account: '...' }
        const transactions = payload.transactions || payload.operations || payload.rows || [];

        if (!Array.isArray(transactions)) {
            throw new Error('Bank parser: transactions array is required in payload');
        }

        const bankMeta = {
            bank_name: payload.bank_name || payload.bankName,
            account: payload.account || payload.account_number,
            period_start: payload.period_start,
            period_end: payload.period_end,
        };

        for (let i = 0; i < transactions.length; i++) {
            const txn = transactions[i];
            try {
                const event = this.parseTransaction(txn, taxIdentityId, sourceRecordId, bankMeta, i);
                if (event) {
                    events.push(event);
                }
            } catch (error) {
                throw new Error(`Bank parser: transaction ${i + 1} - ${error.message}`);
            }
        }

        return events;
    },

    /**
     * Parse single bank transaction
     * @param {Object} txn - Transaction data
     * @param {string} taxIdentityId
     * @param {string} sourceRecordId
     * @param {Object} bankMeta
     * @param {number} index
     * @returns {Object|null} TaxEventInput
     */
    parseTransaction(txn, taxIdentityId, sourceRecordId, bankMeta, index) {
        // Skip empty transactions
        if (!txn || Object.keys(txn).length === 0) {
            return null;
        }

        // Find date field
        const dateValue = txn.date || txn.transaction_date || txn.operation_date || txn.дата;
        if (!dateValue) {
            throw new Error('date field not found');
        }

        const eventDate = this.normalizeDate(dateValue);

        // Find amount
        const amount = this.extractAmount(txn);
        if (amount === null) {
            return null; // Skip transactions without amount
        }

        // Determine event type based on transaction type
        const eventType = this.determineEventType(txn, amount);

        // Currency
        const currency = this.normalizeCurrency(txn.currency || txn.валюта || bankMeta.currency);

        return {
            taxIdentityId,
            sourceRecordId,
            eventType,
            eventDate,
            amount: Math.abs(amount), // Store absolute value, type indicates direction
            currency,
            metadata: {
                bank_name: bankMeta.bank_name,
                account: bankMeta.account,
                transaction_id: txn.id || txn.transaction_id || txn.ref,
                type: txn.type || txn.transaction_type,
                description: txn.description || txn.purpose || txn.назначение,
                counterparty: txn.counterparty || txn.sender || txn.recipient,
                counterparty_bin: txn.counterparty_bin || txn.bin,
                is_credit: amount > 0,
                _row_index: index,
            },
        };
    },

    /**
     * Extract amount from transaction
     * @param {Object} txn
     * @returns {number|null}
     */
    extractAmount(txn) {
        // Try credit/debit fields first
        if (txn.credit !== undefined && txn.credit !== null && txn.credit !== '') {
            return Math.abs(parseFloat(txn.credit));
        }

        if (txn.debit !== undefined && txn.debit !== null && txn.debit !== '') {
            return -Math.abs(parseFloat(txn.debit));
        }

        // Try single amount field with type indicator
        const amountValue = txn.amount || txn.sum || txn.сумма;
        if (amountValue !== undefined && amountValue !== null && amountValue !== '') {
            let amount = parseFloat(String(amountValue).replace(/\s/g, '').replace(',', '.'));

            // Check if type indicates debit
            const type = (txn.type || txn.transaction_type || '').toLowerCase();
            if (type === 'debit' || type === 'расход' || type === 'списание') {
                amount = -Math.abs(amount);
            }

            return isNaN(amount) ? null : amount;
        }

        return null;
    },

    /**
     * Determine event type based on transaction
     * @param {Object} txn
     * @param {number} amount
     * @returns {string}
     */
    determineEventType(txn, amount) {
        const description = (txn.description || txn.purpose || txn.назначение || '').toLowerCase();
        const type = (txn.type || txn.transaction_type || '').toLowerCase();

        // Rent income
        if (description.includes('аренд') || description.includes('rent')) {
            return 'INCOME_RENT';
        }

        // Foreign income indicators
        if (description.includes('иностран') || description.includes('foreign') ||
            description.includes('swift') || description.includes('international')) {
            return 'INCOME_FOREIGN_GENERAL';
        }

        // Property related
        if (description.includes('имущество') || description.includes('property') ||
            description.includes('недвижим')) {
            return 'INCOME_PROPERTY_KZ';
        }

        // Default: classify as income for credits
        if (amount > 0) {
            return 'INCOME_OTHER';
        }

        // We don't create events for expenses by default
        // But if needed, could be handled here
        return 'INCOME_OTHER';
    },

    /**
     * Normalize date
     * @param {string|Date} date
     * @returns {string}
     */
    normalizeDate(date) {
        if (!date) {
            throw new Error('date is required');
        }

        // Handle DD.MM.YYYY format
        if (typeof date === 'string' && /^\d{2}\.\d{2}\.\d{4}$/.test(date)) {
            const [day, month, year] = date.split('.');
            date = `${year}-${month}-${day}`;
        }

        // Handle DD/MM/YYYY format
        if (typeof date === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(date)) {
            const [day, month, year] = date.split('/');
            date = `${year}-${month}-${day}`;
        }

        // Handle DD.MM.YYYY HH:MM:SS format
        if (typeof date === 'string' && /^\d{2}\.\d{2}\.\d{4}\s/.test(date)) {
            const datePart = date.split(' ')[0];
            const [day, month, year] = datePart.split('.');
            date = `${year}-${month}-${day}`;
        }

        const parsed = new Date(date);
        if (isNaN(parsed.getTime())) {
            throw new Error(`invalid date format: ${date}`);
        }

        return parsed.toISOString().split('T')[0];
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
            'TENGE': 'KZT',
            'ТГ': 'KZT',
            'ТЕНГЕ': 'KZT',
            '398': 'KZT', // ISO numeric code
            'DOLLAR': 'USD',
            'ДОЛЛАР': 'USD',
            '$': 'USD',
            '840': 'USD',
            'EURO': 'EUR',
            'ЕВРО': 'EUR',
            '€': 'EUR',
            '978': 'EUR',
            'RUBLE': 'RUB',
            'РУБЛЬ': 'RUB',
            '643': 'RUB',
        };

        return currencyMap[normalized] || normalized;
    },
};

module.exports = BankParser;
