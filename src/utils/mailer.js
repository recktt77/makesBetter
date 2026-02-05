const nodemailer = require('nodemailer');
require('dotenv').config();

/**
 * Create nodemailer transporter
 */
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

/**
 * Send OTP code via email
 * @param {string} to - Recipient email
 * @param {string} code - OTP code
 * @returns {Promise<Object>}
 */
const sendOTPEmail = async (to, code) => {
    const mailOptions = {
        from: `"Tax Declaration Platform" <${process.env.SMTP_USER}>`,
        to,
        subject: 'Ваш код подтверждения',
        html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; padding: 40px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .code { font-size: 36px; font-weight: bold; color: #2563eb; letter-spacing: 8px; text-align: center; padding: 20px; background: #f0f7ff; border-radius: 8px; margin: 20px 0; }
          .warning { color: #ef4444; font-size: 14px; margin-top: 20px; }
          .footer { color: #6b7280; font-size: 12px; margin-top: 30px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Код подтверждения</h2>
          <p>Вы запросили вход в систему налогового декларирования.</p>
          <p>Ваш код подтверждения:</p>
          <div class="code">${code}</div>
          <p class="warning">⚠️ Код действителен ${process.env.OTP_EXPIRES_MINUTES || 5} минут. Никому не сообщайте этот код!</p>
          <p>Если вы не запрашивали код, просто проигнорируйте это письмо.</p>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Tax Declaration Platform</p>
          </div>
        </div>
      </body>
      </html>
    `,
        text: `Ваш код подтверждения: ${code}. Код действителен ${process.env.OTP_EXPIRES_MINUTES || 5} минут.`,
    };

    return await transporter.sendMail(mailOptions);
};

/**
 * Verify transporter connection
 * @returns {Promise<boolean>}
 */
const verifyConnection = async () => {
    try {
        await transporter.verify();
        console.log('✅ Email transporter is ready');
        return true;
    } catch (error) {
        console.error('❌ Email transporter error:', error);
        return false;
    }
};

module.exports = {
    transporter,
    sendOTPEmail,
    verifyConnection,
};
