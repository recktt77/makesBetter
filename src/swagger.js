const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Tax Declaration API - Form 270.00',
            version: '1.0.0',
            description: 'API для формирования налоговой декларации 270.00 (ИПН) Республики Казахстан',
        },
        servers: [
            {
                url: 'http://localhost:3000',
                description: 'Development server',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
            schemas: {
                Error: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: false },
                        error: { type: 'string' },
                    },
                },
                Success: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: true },
                        data: { type: 'object' },
                    },
                },
                User: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        email: { type: 'string', format: 'email' },
                        phone: { type: 'string' },
                        is_active: { type: 'boolean' },
                        created_at: { type: 'string', format: 'date-time' },
                    },
                },
                TaxIdentity: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        identity_type: { type: 'string', enum: ['PERSON', 'BUSINESS'] },
                        person_id: { type: 'string', format: 'uuid' },
                        business_id: { type: 'string', format: 'uuid' },
                    },
                },
                TaxEvent: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        tax_identity_id: { type: 'string', format: 'uuid' },
                        event_type: { type: 'string', example: 'EV_FOREIGN_DIVIDENDS' },
                        event_date: { type: 'string', format: 'date' },
                        amount: { type: 'number', example: 500000 },
                        currency: { type: 'string', example: 'KZT' },
                        tax_year: { type: 'integer', example: 2024 },
                        metadata: { type: 'object' },
                    },
                },
                TaxEventCreate: {
                    type: 'object',
                    required: ['taxIdentityId', 'eventType', 'eventDate'],
                    properties: {
                        taxIdentityId: { type: 'string', format: 'uuid' },
                        eventType: { type: 'string', example: 'EV_FOREIGN_DIVIDENDS' },
                        eventDate: { type: 'string', format: 'date', example: '2024-06-15' },
                        amount: { type: 'number', example: 500000 },
                        currency: { type: 'string', example: 'KZT', default: 'KZT' },
                        metadata: { type: 'object' },
                    },
                },
                Declaration: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        tax_identity_id: { type: 'string', format: 'uuid' },
                        tax_year: { type: 'integer', example: 2024 },
                        form_code: { type: 'string', example: '270.00' },
                        declaration_kind: { type: 'string', enum: ['main', 'regular', 'additional', 'notice'] },
                        status: { type: 'string', enum: ['draft', 'validated', 'awaiting_consent', 'signed', 'submitted', 'accepted', 'rejected'] },
                        iin: { type: 'string', example: '040104550208' },
                        fio_last: { type: 'string' },
                        fio_first: { type: 'string' },
                        fio_middle: { type: 'string' },
                        payer_phone: { type: 'string' },
                        email: { type: 'string' },
                        flags: { type: 'object' },
                    },
                },
                DeclarationGenerate: {
                    type: 'object',
                    required: ['taxIdentityId', 'taxYear'],
                    properties: {
                        taxIdentityId: { type: 'string', format: 'uuid' },
                        taxYear: { type: 'integer', example: 2024 },
                        formCode: { type: 'string', example: '270.00', default: '270.00' },
                        declarationKind: { type: 'string', enum: ['main', 'regular', 'additional', 'notice'], default: 'main' },
                    },
                },
                XmlExport: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        version: { type: 'integer' },
                        xmlHash: { type: 'string' },
                        xmlContent: { type: 'string' },
                        createdAt: { type: 'string', format: 'date-time' },
                    },
                },
            },
        },
        security: [{ bearerAuth: [] }],
    },
    apis: ['./src/swagger-docs/*.js'],
};

const specs = swaggerJsdoc(options);

module.exports = specs;
