const db = require('../../db/postgres');

/**
 * Auth Repository - Database operations for users
 */
const authRepository = {
    /**
     * Find user by email, phone or username
     * @param {string} identifier - Email, phone or username
     * @returns {Promise<Object|null>}
     */
    async findByIdentifier(identifier) {
        const result = await db.query(
            `SELECT * FROM users 
       WHERE email = $1 
          OR phone = $1 
          OR username = $1
       LIMIT 1`,
            [identifier]
        );
        return result.rows[0] || null;
    },

    /**
     * Find user by ID
     * @param {string} id - User UUID
     * @returns {Promise<Object|null>}
     */
    async findById(id) {
        const result = await db.query(
            `SELECT * FROM users WHERE id = $1`,
            [id]
        );
        return result.rows[0] || null;
    },

    /**
     * Find user by email
     * @param {string} email - User email
     * @returns {Promise<Object|null>}
     */
    async findByEmail(email) {
        const result = await db.query(
            `SELECT * FROM users WHERE email = $1`,
            [email]
        );
        return result.rows[0] || null;
    },

    /**
     * Create new user
     * @param {Object} data - User data
     * @returns {Promise<Object>}
     */
    async create({ email, phone, username }) {
        const result = await db.query(
            `INSERT INTO users (email, phone, username)
       VALUES ($1, $2, $3)
       RETURNING *`,
            [email, phone, username]
        );
        return result.rows[0];
    },

    /**
     * Update user
     * @param {string} id - User UUID
     * @param {Object} data - Update data
     * @returns {Promise<Object>}
     */
    async update(id, data) {
        const fields = [];
        const values = [];
        let paramIndex = 1;

        for (const [key, value] of Object.entries(data)) {
            if (value !== undefined) {
                fields.push(`${key} = $${paramIndex}`);
                values.push(value);
                paramIndex++;
            }
        }

        if (fields.length === 0) {
            return await this.findById(id);
        }

        values.push(id);
        const result = await db.query(
            `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
            values
        );
        return result.rows[0];
    },
};

module.exports = authRepository;
