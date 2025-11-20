const nodemailer = require('nodemailer');
const { logger } = require('./loggerService');

const EMAIL_ID = process.env.EMAIL_ID || "crazyyiwen2015@gmail.com";
const EMAIL_PWD = process.env.EMAIL_PWD || "tfkszumuruvcjjmn";
const EMAIL_SERVICE = process.env.EMAIL_SERVICE || 'gmail';

// Validate that credentials are provided
// if (!EMAIL_ID || !EMAIL_PWD) {
//     logger.log('fatal', 'Email credentials not provided. Please set EMAIL_ID and EMAIL_PWD environment variables.');
//     logger.log('fatal', 'For Gmail, you need to use an App Password. See: https://support.google.com/accounts/answer/185833');
//     process.exit(1);
// }

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "crazyyiwen2015@gmail.com",
    pass: "tfkszumuruvcjjmn"
  }
});

// Verify transporter configuration on startup
transporter.verify((error, success) => {
    if (error) {
        logger.log('crit', `Email service configuration error: ${error.message}`);
        logger.log('crit', 'If using Gmail, make sure you are using an App Password, not your regular password.');
        logger.log('crit', 'Enable 2-Step Verification and generate an App Password at: https://myaccount.google.com/apppasswords');
    } else {
        logger.info(`Email service is ready to send emails from ${EMAIL_ID}`);
    }
});

/**
 * Send Email.
 */
const sendEmail = (mailOptions, callback) => {
    return transporter.sendMail(mailOptions, callback);
}

module.exports = {
    sendEmail: sendEmail
}

