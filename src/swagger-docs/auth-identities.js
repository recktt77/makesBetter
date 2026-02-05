/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: Аутентификация и авторизация
 *   - name: Identities
 *     description: Налоговые субъекты (физ. лица, ИП, ТОО)
 *   - name: Sources
 *     description: Источники данных (загрузка файлов)
 *   - name: Tax Events
 *     description: Налоговые события
 *   - name: Declarations
 *     description: Декларации (270.00)
 *   - name: XML Generator
 *     description: Генерация XML для подачи в налоговую
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Регистрация пользователя
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               phone:
 *                 type: string
 *                 example: "+77771234567"
 *     responses:
 *       201:
 *         description: OTP отправлен
 *       400:
 *         description: Ошибка валидации
 */

/**
 * @swagger
 * /api/auth/verify:
 *   post:
 *     tags: [Auth]
 *     summary: Подтверждение OTP и получение токена
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, code]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               code:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: JWT токен
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
 *                     token:
 *                       type: string
 *                     user:
 *                       $ref: '#/components/schemas/User'
 */

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Получить текущего пользователя
 *     responses:
 *       200:
 *         description: Данные пользователя
 */

/**
 * @swagger
 * /api/identities:
 *   get:
 *     tags: [Identities]
 *     summary: Список налоговых субъектов пользователя
 *     responses:
 *       200:
 *         description: Список identities
 *
 *   post:
 *     tags: [Identities]
 *     summary: Создать налоговый субъект (физ. лицо)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [iin, lastName, firstName]
 *             properties:
 *               iin:
 *                 type: string
 *                 example: "040104550208"
 *               lastName:
 *                 type: string
 *                 example: "ШӘКЕН"
 *               firstName:
 *                 type: string
 *                 example: "ДАНИЯЛ"
 *               middleName:
 *                 type: string
 *                 example: "ДӘУЛЕТҰЛЫ"
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *     responses:
 *       201:
 *         description: Identity создан
 */

/**
 * @swagger
 * /api/identities/{id}:
 *   get:
 *     tags: [Identities]
 *     summary: Получить налоговый субъект по ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Identity
 */
