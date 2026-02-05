/**
 * @swagger
 * /api/xml/generate/{declarationId}:
 *   post:
 *     tags: [XML Generator]
 *     summary: Сгенерировать XML для декларации
 *     description: |
 *       Генерирует XML в формате ФНО 270.00 для подачи в налоговую.
 *       Декларация должна быть в статусе validated или выше.
 *     parameters:
 *       - in: path
 *         name: declarationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: XML сгенерирован
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/XmlExport'
 *       400:
 *         description: Декларация в статусе draft
 *
 * /api/xml/latest/{declarationId}:
 *   get:
 *     tags: [XML Generator]
 *     summary: Получить последний XML для декларации
 *     parameters:
 *       - in: path
 *         name: declarationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: XML
 *       404:
 *         description: XML не найден
 *
 * /api/xml/versions/{declarationId}:
 *   get:
 *     tags: [XML Generator]
 *     summary: Список версий XML
 *     parameters:
 *       - in: path
 *         name: declarationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Список версий
 *
 * /api/xml/{id}:
 *   get:
 *     tags: [XML Generator]
 *     summary: Получить XML по ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: XML
 *
 * /api/xml/download/{id}:
 *   get:
 *     tags: [XML Generator]
 *     summary: Скачать XML файл
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: XML файл
 *         content:
 *           application/xml:
 *             schema:
 *               type: string
 *
 * /api/xml/validate/{declarationId}:
 *   post:
 *     tags: [XML Generator]
 *     summary: Валидировать XML (без генерации)
 *     parameters:
 *       - in: path
 *         name: declarationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Результат валидации
 */

/**
 * @swagger
 * /api/sources:
 *   post:
 *     tags: [Sources]
 *     summary: Загрузить источник данных
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [taxIdentityId, sourceType, rawPayload]
 *             properties:
 *               taxIdentityId:
 *                 type: string
 *                 format: uuid
 *               sourceType:
 *                 type: string
 *                 enum: [manual, csv, excel, bank, 1c, api]
 *               rawPayload:
 *                 type: object
 *     responses:
 *       201:
 *         description: Источник создан
 *
 * /api/sources/{taxIdentityId}:
 *   get:
 *     tags: [Sources]
 *     summary: Список источников для identity
 *     parameters:
 *       - in: path
 *         name: taxIdentityId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Список источников
 */

/**
 * @swagger
 * /api/rule-engine/run:
 *   post:
 *     tags: [Rule Engine]
 *     summary: Запустить Rule Engine вручную
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [taxIdentityId, taxYear]
 *             properties:
 *               taxIdentityId:
 *                 type: string
 *                 format: uuid
 *               taxYear:
 *                 type: integer
 *                 example: 2024
 *               persist:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       200:
 *         description: Результат расчета
 */
