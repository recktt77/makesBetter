/**
 * @swagger
 * /api/declarations:
 *   get:
 *     tags: [Declarations]
 *     summary: Список деклараций пользователя
 *     parameters:
 *       - in: query
 *         name: taxIdentityId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: taxYear
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, validated, awaiting_consent, signed, submitted, accepted, rejected]
 *     responses:
 *       200:
 *         description: Список деклараций
 *
 *   post:
 *     tags: [Declarations]
 *     summary: Создать пустую декларацию
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DeclarationGenerate'
 *     responses:
 *       201:
 *         description: Декларация создана
 *
 * /api/declarations/generate:
 *   post:
 *     tags: [Declarations]
 *     summary: Создать и заполнить декларацию (Rule Engine)
 *     description: |
 *       Создает декларацию и запускает Rule Engine для заполнения 
 *       на основе налоговых событий. Требует наличия tax_events за указанный год.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DeclarationGenerate'
 *           example:
 *             taxIdentityId: "0178ac40-5db3-4846-8b2c-a08358334564"
 *             taxYear: 2024
 *     responses:
 *       200:
 *         description: Декларация сгенерирована
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Declaration'
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                 stats:
 *                   type: object
 *                   properties:
 *                     eventsProcessed:
 *                       type: integer
 *                     rulesMatched:
 *                       type: integer
 *                     mappingsCreated:
 *                       type: integer
 *       400:
 *         description: Нет событий для обработки
 *
 * /api/declarations/{id}:
 *   get:
 *     tags: [Declarations]
 *     summary: Получить декларацию по ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Декларация с items
 *
 *   put:
 *     tags: [Declarations]
 *     summary: Обновить заголовок декларации
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               payerPhone:
 *                 type: string
 *                 example: "+77771234567"
 *               email:
 *                 type: string
 *                 example: "user@example.com"
 *               iinSpouse:
 *                 type: string
 *               flags:
 *                 type: object
 *     responses:
 *       200:
 *         description: Обновлено
 *
 *   delete:
 *     tags: [Declarations]
 *     summary: Удалить черновик декларации
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Удалено
 *       400:
 *         description: Можно удалить только draft
 *
 * /api/declarations/{id}/validate:
 *   post:
 *     tags: [Declarations]
 *     summary: Валидировать декларацию
 *     description: Проверяет декларацию и переводит в статус validated
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Результат валидации
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     isValid:
 *                       type: boolean
 *                     errors:
 *                       type: array
 *                       items:
 *                         type: string
 *                     warnings:
 *                       type: array
 *                       items:
 *                         type: string
 *
 * /api/declarations/{id}/regenerate:
 *   post:
 *     tags: [Declarations]
 *     summary: Перегенерировать декларацию
 *     description: Удаляет старые items и пересчитывает из tax_events
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Перегенерировано
 */
