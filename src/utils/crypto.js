const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const SALT_ROUNDS = 10;

/**
 * Hash a string using bcrypt
 * @param {string} value - Value to hash
 * @returns {Promise<string>}
 */
const hashValue = async (value) => {
    return await bcrypt.hash(value, SALT_ROUNDS);
};

/**
 * Compare value with hash
 * @param {string} value - Plain value
 * @param {string} hash - Hashed value
 * @returns {Promise<boolean>}
 */
const compareHash = async (value, hash) => {
    return await bcrypt.compare(value, hash);
};

/**
 * Generate a random string
 * @param {number} length - Length of the string
 * @returns {string}
 */
const generateRandomString = (length = 32) => {
    return crypto.randomBytes(length).toString('hex');
};

module.exports = {
    hashValue,
    compareHash,
    generateRandomString,
};
