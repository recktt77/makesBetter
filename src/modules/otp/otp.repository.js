const db = require('../../db/postgres');

/**
 * OTP Repository - Database operations for OTP codes
 */
const otpRepository = {
    /**
     * Create new OTP record
     * @param {Object} data - OTP data
     * @returns {Promise<Object>}
     */
    async create({ userId, codeHash, expiresAt, ipAddress, userAgent }) {
        const result = await db.query(
            `INSERT INTO otp_codes (user_id, code_hash, expires_at, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
            [userId, codeHash, expiresAt, ipAddress, userAgent]
        );
        return result.rows[0];
    },

    /**
     * Find active OTP by user ID (not used, not expired)
     * @param {string} userId - User UUID
     * @returns {Promise<Object|null>}
     */
    async findActiveByUserId(userId) {
        const result = await db.query(
            `SELECT * FROM otp_codes 
       WHERE user_id = $1 
         AND used = false 
         AND expires_at > NOW() AT TIME ZONE 'UTC'
       ORDER BY created_at DESC
       LIMIT 1`,
            [userId]
        );
        return result.rows[0] || null;
    },

    /**
     * Mark OTP as used
     * @param {string} otpId - OTP UUID
     * @returns {Promise<Object>}
     */
    async markAsUsed(otpId) {
        const result = await db.query(
            `UPDATE otp_codes 
       SET used = true 
       WHERE id = $1 
       RETURNING *`,
            [otpId]
        );
        return result.rows[0];
    },

    /**
     * Increment attempt counter
     * @param {string} otpId - OTP UUID
     * @returns {Promise<Object>}
     */
    async incrementAttempts(otpId) {
        const result = await db.query(
            `UPDATE otp_codes 
       SET attempts = attempts + 1 
       WHERE id = $1 
       RETURNING *`,
            [otpId]
        );
        return result.rows[0];
    },

    /**
     * Invalidate all OTPs for a user
     * @param {string} userId - User UUID
     * @returns {Promise<number>}
     */
    async invalidateAllForUser(userId) {
        const result = await db.query(
            `UPDATE otp_codes 
       SET used = true 
       WHERE user_id = $1 AND used = false`,
            [userId]
        );
        return result.rowCount;
    },

    /**
     * Delete expired OTPs (cleanup job)
     * @returns {Promise<number>}
     */
    async deleteExpired() {
        const result = await db.query(
            `DELETE FROM otp_codes 
       WHERE expires_at < NOW() OR used = true`
        );
        return result.rowCount;
    },

    /**
     * Count recent OTP requests (rate limiting)
     * @param {string} userId - User UUID
     * @param {number} minutes - Time window in minutes
     * @returns {Promise<number>}
     */
    async countRecentRequests(userId, minutes = 60) {
        const result = await db.query(
            `SELECT COUNT(*) as count 
       FROM otp_codes 
       WHERE user_id = $1 
         AND created_at > NOW() - INTERVAL '${minutes} minutes'`,
            [userId]
        );
        return parseInt(result.rows[0].count, 10);
    },
};

module.exports = otpRepository;
