const express = require('express');
const router = express.Router();
const identitiesController = require('./identities.controller');
const { authenticate } = require('../../middleware/auth.middleware');

// Все маршруты требуют авторизации
router.use(authenticate);

// ==========================================
// CREATE (Register)
// ==========================================

/**
 * @route   POST /api/identities/person
 * @desc    Регистрация физлица
 * @access  Private
 * @body    { iin, lastName, firstName, middleName?, email?, phone?, residencyStatus, maritalStatus, taxObligationStartYear?, role? }
 */
router.post('/person', identitiesController.registerPerson);

/**
 * @route   POST /api/identities/business
 * @desc    Регистрация бизнеса (ИП/ТОО)
 * @access  Private
 * @body    { bin, legalName, entityType, email?, phone?, role? }
 */
router.post('/business', identitiesController.registerBusiness);

// ==========================================
// READ
// ==========================================

/**
 * @route   GET /api/identities
 * @desc    Список всех налогоплательщиков пользователя
 * @access  Private
 */
router.get('/', identitiesController.listIdentities);

/**
 * @route   GET /api/identities/:id
 * @desc    Детали налогоплательщика
 * @access  Private
 */
router.get('/:id', identitiesController.getIdentity);

// ==========================================
// UPDATE
// ==========================================

/**
 * @route   PUT /api/identities/:id/person
 * @desc    Обновить данные физлица
 * @access  Private (owner only)
 * @body    { lastName?, firstName?, middleName?, email?, phone?, residencyStatus?, maritalStatus?, taxObligationStartYear? }
 */
router.put('/:id/person', identitiesController.updatePerson);

/**
 * @route   PUT /api/identities/:id/business
 * @desc    Обновить данные бизнеса
 * @access  Private (owner only)
 * @body    { legalName?, email?, phone? }
 */
router.put('/:id/business', identitiesController.updateBusiness);

// ==========================================
// ROLE MANAGEMENT
// ==========================================

/**
 * @route   POST /api/identities/:id/users
 * @desc    Добавить пользователя к налогоплательщику
 * @access  Private (owner only)
 * @body    { userId, role }
 */
router.post('/:id/users', identitiesController.addUser);

/**
 * @route   PUT /api/identities/:id/users/:userId
 * @desc    Изменить роль пользователя
 * @access  Private (owner only)
 * @body    { role }
 */
router.put('/:id/users/:userId', identitiesController.updateUserRole);

/**
 * @route   DELETE /api/identities/:id/users/:userId
 * @desc    Удалить пользователя из налогоплательщика
 * @access  Private (owner only)
 */
router.delete('/:id/users/:userId', identitiesController.removeUser);

// ==========================================
// DELETE
// ==========================================

/**
 * @route   DELETE /api/identities/:id
 * @desc    Удалить налогоплательщика
 * @access  Private (owner only)
 */
router.delete('/:id', identitiesController.deleteIdentity);

/**
 * @route   POST /api/identities/:id/leave
 * @desc    Отказаться от доступа
 * @access  Private (non-owner)
 */
router.post('/:id/leave', identitiesController.leaveIdentity);

module.exports = router;