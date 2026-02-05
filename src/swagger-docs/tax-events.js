/**
 * @swagger
 * /api/tax-events:
 *   post:
 *     tags: [Tax Events]
 *     summary: Создать налоговое событие вручную
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TaxEventCreate'
 *           examples:
 *             dividends:
 *               summary: Дивиденды из-за рубежа
 *               value:
 *                 taxIdentityId: "0178ac40-5db3-4846-8b2c-a08358334564"
 *                 eventType: "EV_FOREIGN_DIVIDENDS"
 *                 eventDate: "2024-06-15"
 *                 amount: 500000
 *                 currency: "KZT"
 *             property_sale:
 *               summary: Продажа имущества в РК
 *               value:
 *                 taxIdentityId: "0178ac40-5db3-4846-8b2c-a08358334564"
 *                 eventType: "EV_PROPERTY_SALE_KZ"
 *                 eventDate: "2024-08-20"
 *                 amount: 1000000
 *                 currency: "KZT"
 *             foreign_employment:
 *               summary: Доход по трудовому договору из-за рубежа
 *               value:
 *                 taxIdentityId: "0178ac40-5db3-4846-8b2c-a08358334564"
 *                 eventType: "EV_FOREIGN_EMPLOYMENT_INCOME"
 *                 eventDate: "2024-03-01"
 *                 amount: 2000000
 *                 currency: "KZT"
 *     responses:
 *       201:
 *         description: Событие создано
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/TaxEvent'
 *       400:
 *         description: Ошибка валидации
 *
 * /api/tax-events/types:
 *   get:
 *     tags: [Tax Events]
 *     summary: Список всех типов событий
 *     responses:
 *       200:
 *         description: Типы событий
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       code:
 *                         type: string
 *                         example: "EV_FOREIGN_DIVIDENDS"
 *                       description:
 *                         type: string
 *                         example: "Дивиденды из иностранных источников"
 *
 * /api/tax-events/{taxIdentityId}:
 *   get:
 *     tags: [Tax Events]
 *     summary: Список событий для налогового субъекта
 *     parameters:
 *       - in: path
 *         name: taxIdentityId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: taxYear
 *         schema:
 *           type: integer
 *           example: 2024
 *       - in: query
 *         name: eventType
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Список событий
 *
 * /api/tax-events/{taxIdentityId}/summary/{taxYear}:
 *   get:
 *     tags: [Tax Events]
 *     summary: Сводка по году
 *     parameters:
 *       - in: path
 *         name: taxIdentityId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: taxYear
 *         required: true
 *         schema:
 *           type: integer
 *           example: 2024
 *     responses:
 *       200:
 *         description: Сводка
 */
