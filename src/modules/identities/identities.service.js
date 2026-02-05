const identitiesRepository = require('./identities.repository');

const identitiesService = {
    // ==========================================
    // PERSON + TAX IDENTITY (полный флоу)
    // ==========================================

    /**
     * Регистрация физлица и создание tax_identity
     * @param {string} userId - ID пользователя, который регистрирует
     * @param {Object} personData - данные физлица
     * @param {string} role - роль пользователя (owner/representative/accountant)
     * @returns {Promise<Object>}
     */
    async registerPerson(userId, personData, role = 'owner') {
        const { iin, lastName, firstName, middleName, email, phone, residencyStatus, maritalStatus, taxObligationStartYear } = personData;

        // Проверяем, существует ли уже физлицо с таким ИИН
        let person = await identitiesRepository.findPersonByIin(iin);

        if (person) {
            // Если физлицо существует, проверяем есть ли tax_identity
            const existingTaxIdentity = await identitiesRepository.findTaxIdentityByPersonId(person.id);

            if (existingTaxIdentity) {
                // Проверяем, есть ли уже связь с этим пользователем
                const existingRole = await identitiesRepository.findUserIdentityRole(userId, existingTaxIdentity.id);

                if (existingRole) {
                    throw new Error('Вы уже имеете доступ к этому налогоплательщику');
                }

                // Добавляем пользователю роль для существующего tax_identity
                await identitiesRepository.createUserIdentityRole(userId, existingTaxIdentity.id, role);

                return {
                    taxIdentityId: existingTaxIdentity.id,
                    identityType: 'PERSON',
                    person,
                    role,
                    isNew: false,
                };
            }
        }

        // Создаём нового физлица если не существует
        if (!person) {
            person = await identitiesRepository.createPerson({
                iin,
                lastName,
                firstName,
                middleName,
                email,
                phone,
                residencyStatus,
                maritalStatus,
                taxObligationStartYear,
            });
        }

        // Создаём tax_identity
        const taxIdentity = await identitiesRepository.createTaxIdentity('PERSON', person.id);

        // Привязываем пользователя с ролью
        await identitiesRepository.createUserIdentityRole(userId, taxIdentity.id, role);

        return {
            taxIdentityId: taxIdentity.id,
            identityType: 'PERSON',
            person,
            role,
            isNew: true,
        };
    },

    // ==========================================
    // BUSINESS + TAX IDENTITY (полный флоу)
    // ==========================================

    /**
     * Регистрация бизнеса (ИП/ТОО) и создание tax_identity
     * @param {string} userId - ID пользователя
     * @param {Object} businessData - данные бизнеса
     * @param {string} role - роль пользователя
     * @returns {Promise<Object>}
     */
    async registerBusiness(userId, businessData, role = 'owner') {
        const { bin, legalName, entityType, email, phone } = businessData;

        // Проверяем, существует ли бизнес с таким БИН
        let business = await identitiesRepository.findBusinessByBin(bin);

        if (business) {
            const existingTaxIdentity = await identitiesRepository.findTaxIdentityByBusinessId(business.id);

            if (existingTaxIdentity) {
                const existingRole = await identitiesRepository.findUserIdentityRole(userId, existingTaxIdentity.id);

                if (existingRole) {
                    throw new Error('Вы уже имеете доступ к этому налогоплательщику');
                }

                await identitiesRepository.createUserIdentityRole(userId, existingTaxIdentity.id, role);

                return {
                    taxIdentityId: existingTaxIdentity.id,
                    identityType: 'BUSINESS',
                    business,
                    role,
                    isNew: false,
                };
            }
        }

        if (!business) {
            business = await identitiesRepository.createBusiness({
                bin,
                legalName,
                entityType,
                email,
                phone,
            });
        }

        const taxIdentity = await identitiesRepository.createTaxIdentity('BUSINESS', business.id);
        await identitiesRepository.createUserIdentityRole(userId, taxIdentity.id, role);

        return {
            taxIdentityId: taxIdentity.id,
            identityType: 'BUSINESS',
            business,
            role,
            isNew: true,
        };
    },

    // ==========================================
    // READ OPERATIONS
    // ==========================================

    /**
     * Получить список всех tax_identities пользователя
     * @param {string} userId
     * @returns {Promise<Array>}
     */
    async getUserIdentities(userId) {
        return await identitiesRepository.listUserIdentities(userId);
    },

    /**
     * Получить детали конкретного tax_identity
     * @param {string} userId
     * @param {string} taxIdentityId
     * @returns {Promise<Object>}
     */
    async getTaxIdentityDetails(userId, taxIdentityId) {
        // Проверяем доступ
        const hasAccess = await identitiesRepository.userHasAccess(userId, taxIdentityId);
        if (!hasAccess) {
            throw new Error('Нет доступа к этому налогоплательщику');
        }

        const taxIdentity = await identitiesRepository.findTaxIdentityById(taxIdentityId);
        if (!taxIdentity) {
            throw new Error('Налогоплательщик не найден');
        }

        // Получаем роль текущего пользователя
        const userRole = await identitiesRepository.findUserIdentityRole(userId, taxIdentityId);

        // Получаем всех пользователей с доступом
        const users = await identitiesRepository.listIdentityUsers(taxIdentityId);

        return {
            ...taxIdentity,
            currentUserRole: userRole?.role,
            users,
        };
    },

    // ==========================================
    // UPDATE OPERATIONS
    // ==========================================

    /**
     * Обновить данные физлица
     * @param {string} userId
     * @param {string} taxIdentityId
     * @param {Object} updateData
     * @returns {Promise<Object>}
     */
    async updatePerson(userId, taxIdentityId, updateData) {
        // Проверяем доступ (только owner может редактировать)
        const hasAccess = await identitiesRepository.userHasAccess(userId, taxIdentityId, ['owner']);
        if (!hasAccess) {
            throw new Error('Нет прав для редактирования');
        }

        const taxIdentity = await identitiesRepository.findTaxIdentityById(taxIdentityId);
        if (!taxIdentity || taxIdentity.identity_type !== 'PERSON') {
            throw new Error('Физлицо не найдено');
        }

        const updatedPerson = await identitiesRepository.updatePerson(taxIdentity.person_id, updateData);
        return updatedPerson;
    },

    /**
     * Обновить данные бизнеса
     * @param {string} userId
     * @param {string} taxIdentityId
     * @param {Object} updateData
     * @returns {Promise<Object>}
     */
    async updateBusiness(userId, taxIdentityId, updateData) {
        const hasAccess = await identitiesRepository.userHasAccess(userId, taxIdentityId, ['owner']);
        if (!hasAccess) {
            throw new Error('Нет прав для редактирования');
        }

        const taxIdentity = await identitiesRepository.findTaxIdentityById(taxIdentityId);
        if (!taxIdentity || taxIdentity.identity_type !== 'BUSINESS') {
            throw new Error('Бизнес не найден');
        }

        const updatedBusiness = await identitiesRepository.updateBusiness(taxIdentity.business_id, updateData);
        return updatedBusiness;
    },

    // ==========================================
    // ROLE MANAGEMENT
    // ==========================================

    /**
     * Добавить пользователя к tax_identity
     * @param {string} ownerId - ID владельца, который добавляет
     * @param {string} taxIdentityId
     * @param {string} targetUserId - ID добавляемого пользователя
     * @param {string} role
     * @returns {Promise<Object>}
     */
    async addUserToIdentity(ownerId, taxIdentityId, targetUserId, role) {
        // Только owner может добавлять пользователей
        const hasAccess = await identitiesRepository.userHasAccess(ownerId, taxIdentityId, ['owner']);
        if (!hasAccess) {
            throw new Error('Только владелец может добавлять пользователей');
        }

        // Нельзя назначить owner (владелец только один)
        if (role === 'owner') {
            throw new Error('Нельзя назначить несколько владельцев');
        }

        const result = await identitiesRepository.createUserIdentityRole(targetUserId, taxIdentityId, role);
        return result;
    },

    /**
     * Изменить роль пользователя
     * @param {string} ownerId
     * @param {string} taxIdentityId
     * @param {string} targetUserId
     * @param {string} newRole
     * @returns {Promise<Object>}
     */
    async updateUserRole(ownerId, taxIdentityId, targetUserId, newRole) {
        const hasAccess = await identitiesRepository.userHasAccess(ownerId, taxIdentityId, ['owner']);
        if (!hasAccess) {
            throw new Error('Только владелец может менять роли');
        }

        if (newRole === 'owner') {
            throw new Error('Нельзя назначить несколько владельцев');
        }

        // Нельзя изменить роль владельца
        const targetRole = await identitiesRepository.findUserIdentityRole(targetUserId, taxIdentityId);
        if (targetRole?.role === 'owner') {
            throw new Error('Нельзя изменить роль владельца');
        }

        return await identitiesRepository.createUserIdentityRole(targetUserId, taxIdentityId, newRole);
    },

    /**
     * Удалить пользователя из tax_identity
     * @param {string} ownerId
     * @param {string} taxIdentityId
     * @param {string} targetUserId
     * @returns {Promise<boolean>}
     */
    async removeUserFromIdentity(ownerId, taxIdentityId, targetUserId) {
        const hasAccess = await identitiesRepository.userHasAccess(ownerId, taxIdentityId, ['owner']);
        if (!hasAccess) {
            throw new Error('Только владелец может удалять пользователей');
        }

        // Нельзя удалить владельца
        const targetRole = await identitiesRepository.findUserIdentityRole(targetUserId, taxIdentityId);
        if (targetRole?.role === 'owner') {
            throw new Error('Нельзя удалить владельца');
        }

        return await identitiesRepository.deleteUserIdentityRole(targetUserId, taxIdentityId);
    },

    // ==========================================
    // DELETE OPERATIONS
    // ==========================================

    /**
     * Удалить tax_identity (только owner)
     * @param {string} userId
     * @param {string} taxIdentityId
     * @returns {Promise<boolean>}
     */
    async deleteTaxIdentity(userId, taxIdentityId) {
        const hasAccess = await identitiesRepository.userHasAccess(userId, taxIdentityId, ['owner']);
        if (!hasAccess) {
            throw new Error('Только владелец может удалить налогоплательщика');
        }

        // CASCADE удалит связанные записи в user_identity_roles
        // и person/business через tax_identities FK
        return await identitiesRepository.deleteTaxIdentity(taxIdentityId);
    },

    /**
     * Пользователь отказывается от доступа к tax_identity
     * @param {string} userId
     * @param {string} taxIdentityId
     * @returns {Promise<boolean>}
     */
    async leaveIdentity(userId, taxIdentityId) {
        const userRole = await identitiesRepository.findUserIdentityRole(userId, taxIdentityId);

        if (!userRole) {
            throw new Error('Вы не имеете доступа к этому налогоплательщику');
        }

        if (userRole.role === 'owner') {
            throw new Error('Владелец не может отказаться от доступа. Удалите налогоплательщика или передайте права.');
        }

        return await identitiesRepository.deleteUserIdentityRole(userId, taxIdentityId);
    },
};

module.exports = identitiesService;