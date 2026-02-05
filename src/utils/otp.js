const crypto = require('crypto');

/**
 * Generate a 6-digit OTP code
 * @returns {string}
 */
const generateOTP = () => {
    // Generate cryptographically secure random number
    const randomBytes = crypto.randomBytes(4);
    const randomNumber = randomBytes.readUInt32BE(0);

    // Convert to 6-digit code (100000 - 999999)
    const otp = 100000 + (randomNumber % 900000);
    return otp.toString();
};

/**
 * Calculate OTP expiration time
 * @param {number} minutes - Minutes until expiration
 * @returns {Date}
 */
const getOTPExpiration = (minutes = 5) => {
    const now = Date.now();
    const expirationTime = now + minutes * 60 * 1000;
    return new Date(expirationTime);
};

/**
 * Check if OTP is expired
 * @param {Date} expiresAt - Expiration timestamp
 * @returns {boolean}
 */
const isOTPExpired = (expiresAt) => {
    return new Date() > new Date(expiresAt);
};

module.exports = {
    generateOTP,
    getOTPExpiration,
    isOTPExpired,
};
