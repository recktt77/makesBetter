const identitiesService = require('./identities.service');

const identitiesController = {
    // ==========================================
    // REGISTER (CREATE)
    // ==========================================

    /**
     * Регистрация физлица
     * POST /api/identities/person
     */
    async registerPerson(req, res, next) {
        try {
            const userId = req.user.id;
            const { iin, lastName, firstName, middleName, email, phone, residencyStatus, maritalStatus, taxObligationStartYear, role } = req.body;

            if (!iin || !lastName || !firstName) {
                return res.status(400).json({
                    success: false,
                    error: 'ИИН, фамилия и имя обязательны',
                });
            }

            if (!/^\d{12}$/.test(iin)) {
                return res.status(400).json({
                    success: false,
                    error: 'ИИН должен содержать 12 цифр',
                });
            }

            const result = await identitiesService.registerPerson(userId, {
                iin,
                lastName,
                firstName,
                middleName,
                email,
                phone,
                residencyStatus,
                maritalStatus,
                taxObligationStartYear,
            }, role || 'owner');

            res.status(201).json({
                success: true,
                data: result,
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Регистрация бизнеса (ИП/ТОО)
     * POST /api/identities/business
     */
    async registerBusiness(req, res, next) {
        try {
            const userId = req.user.id;
            const { bin, legalName, entityType, email, phone, role } = req.body;

            if (!bin || !legalName || !entityType) {
                return res.status(400).json({
                    success: false,
                    error: 'БИН, название и тип обязательны',
                });
            }

            if (!/^\d{12}$/.test(bin)) {
                return res.status(400).json({
                    success: false,
                    error: 'БИН должен содержать 12 цифр',
                });
            }

            if (!['IP', 'TOO'].includes(entityType)) {
                return res.status(400).json({
                    success: false,
                    error: 'Тип должен быть IP или TOO',
                });
            }

            const result = await identitiesService.registerBusiness(userId, {
                bin,
                legalName,
                entityType,
                email,
                phone,
            }, role || 'owner');

            res.status(201).json({
                success: true,
                data: result,
            });
        } catch (error) {
            next(error);
        }
    },

    // ==========================================
    // READ
    // ==========================================

    /**
     * Получить список всех налогоплательщиков пользователя
     * GET /api/identities
     */
    async listIdentities(req, res, next) {
        try {
            const userId = req.user.id;
            const identities = await identitiesService.getUserIdentities(userId);

            res.status(200).json({
                success: true,
                data: identities,
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Получить детали налогоплательщика
     * GET /api/identities/:id
     */
    async getIdentity(req, res, next) {
        try {
            const userId = req.user.id;
            const { id } = req.params;

            const identity = await identitiesService.getTaxIdentityDetails(userId, id);

            res.status(200).json({
                success: true,
                data: identity,
            });
        } catch (error) {
            next(error);
        }
    },

    // ==========================================
    // UPDATE
    // ==========================================

    /**
     * Обновить данные физлица
     * PUT /api/identities/:id/person
     */
    async updatePerson(req, res, next) {
        try {
            const userId = req.user.id;
            const { id } = req.params;
            const updateData = req.body;

            const updated = await identitiesService.updatePerson(userId, id, updateData);

            res.status(200).json({
                success: true,
                data: updated,
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Обновить данные бизнеса
     * PUT /api/identities/:id/business
     */
    async updateBusiness(req, res, next) {
        try {
            const userId = req.user.id;
            const { id } = req.params;
            const updateData = req.body;

            const updated = await identitiesService.updateBusiness(userId, id, updateData);

            res.status(200).json({
                success: true,
                data: updated,
            });
        } catch (error) {
            next(error);
        }
    },

    // ==========================================
    // ROLE MANAGEMENT
    // ==========================================

    /**
     * Добавить пользователя к налогоплательщику
     * POST /api/identities/:id/users
     */
    async addUser(req, res, next) {
        try {
            const ownerId = req.user.id;
            const { id } = req.params;
            const { userId: targetUserId, role } = req.body;

            if (!targetUserId || !role) {
                return res.status(400).json({
                    success: false,
                    error: 'userId и role обязательны',
                });
            }

            if (!['representative', 'accountant'].includes(role)) {
                return res.status(400).json({
                    success: false,
                    error: 'Роль должна быть representative или accountant',
                });
            }

            const result = await identitiesService.addUserToIdentity(ownerId, id, targetUserId, role);

            res.status(201).json({
                success: true,
                data: result,
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Изменить роль пользователя
     * PUT /api/identities/:id/users/:userId
     */
    async updateUserRole(req, res, next) {
        try {
            const ownerId = req.user.id;
            const { id, userId: targetUserId } = req.params;
            const { role } = req.body;

            if (!role) {
                return res.status(400).json({
                    success: false,
                    error: 'role обязателен',
                });
            }

            const result = await identitiesService.updateUserRole(ownerId, id, targetUserId, role);

            res.status(200).json({
                success: true,
                data: result,
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Удалить пользователя из налогоплательщика
     * DELETE /api/identities/:id/users/:userId
     */
    async removeUser(req, res, next) {
        try {
            const ownerId = req.user.id;
            const { id, userId: targetUserId } = req.params;

            await identitiesService.removeUserFromIdentity(ownerId, id, targetUserId);

            res.status(200).json({
                success: true,
                message: 'Пользователь удалён',
            });
        } catch (error) {
            next(error);
        }
    },

    // ==========================================
    // DELETE
    // ==========================================

    /**
     * Удалить налогоплательщика
     * DELETE /api/identities/:id
     */
    async deleteIdentity(req, res, next) {
        try {
            const userId = req.user.id;
            const { id } = req.params;

            await identitiesService.deleteTaxIdentity(userId, id);

            res.status(200).json({
                success: true,
                message: 'Налогоплательщик удалён',
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Отказаться от доступа к налогоплательщику
     * POST /api/identities/:id/leave
     */
    async leaveIdentity(req, res, next) {
        try {
            const userId = req.user.id;
            const { id } = req.params;

            await identitiesService.leaveIdentity(userId, id);

            res.status(200).json({
                success: true,
                message: 'Вы отказались от доступа',
            });
        } catch (error) {
            next(error);
        }
    },
};

module.exports = identitiesController;
