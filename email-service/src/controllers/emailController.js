const { sendEmail } = require('../services/emailService');
const { logger } = require('../services/loggerService');
const { EMAIL_SUBJECT, EMAIL_TEXT_DEFAULT } = require('../resources/constants');

const EMAIL_ID = process.env.EMAIL_ID;

var mailOptions = {
    from: EMAIL_ID,
    to: '',
    subject: EMAIL_SUBJECT,
    text: EMAIL_TEXT_DEFAULT
  };
  
/**
 * Send an email confirmation.
 */
const sendConfirmation = (order, orderChannel) => {
    const orderContent = JSON.parse(order.content.toString());

    // Create a fresh mailOptions object for each email to avoid text accumulation
    const currentMailOptions = {
        from: mailOptions.from,
        to: orderContent.email,
        subject: mailOptions.subject,
        text: `${EMAIL_TEXT_DEFAULT}Your order ${orderContent._id} amounting to ${orderContent.total} is confirmed and will be delivered shortly.`
    };

    sendEmail(currentMailOptions, (error, info) => {
        if (error) {
            logger.log('crit',`email - failed to send confirmation to ${orderContent.email} for order ${orderContent._id}. Error: ${error.message}`)
            // Reject and requeue the message for retry
            orderChannel.nack(order, false, true);
        } else {
            logger.info(`email - confirmation sent to ${orderContent.email} for order ${orderContent._id}.`);
            orderChannel.ack(order);
        }
      })

}

module.exports = {
    sendConfirmation: sendConfirmation
}