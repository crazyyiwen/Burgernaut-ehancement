const amqp = require("amqplib");
const { sendConfirmation } = require('../controllers/emailController')
const { logger } = require('./loggerService')
const {EXCHANGE, QUEUE} = require('../resources/constants');
const PREFETCH_COUNT = parseInt(process.env.PREFETCH_COUNT) || 2;
const MQ_HOST = process.env.MQ_HOST || 'localhost';
const MQ_URL = `amqp://${MQ_HOST}:5672`;
let orderChannel = null;
let mqConnection = null;

// Retry configuration
const MAX_RETRIES = 10;
const INITIAL_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 30000; // 30 seconds

/**
 * Sleep utility function
 * @param {number} ms - milliseconds to sleep
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Connect to RabbitMQ and consumer orders with retry logic
 */
const amqpConnectAndConsume = async (retryCount = 0) => {
    try {
        mqConnection = await amqp.connect(MQ_URL);
        logger.info(`AMQP - connection established at ${MQ_URL}`)

        orderChannel = await mqConnection.createChannel();

        await orderChannel.assertExchange(EXCHANGE, 'fanout', {
            durable: false
        });

        // Ensure that the queue exists or create one if it doesn't
        await orderChannel.assertQueue(QUEUE);
        await orderChannel.bindQueue(QUEUE, EXCHANGE, '');


        // Only send <PREFETCH_COUNT> emails at a time
        orderChannel.prefetch(PREFETCH_COUNT);

        orderChannel.consume(QUEUE, order => {
            sendConfirmation(order, orderChannel);
        });

        // Handle connection errors and reconnect
        mqConnection.on('error', (err) => {
            logger.error(`AMQP - connection error: ${err.message}`);
        });

        mqConnection.on('close', () => {
            logger.warn('AMQP - connection closed, attempting to reconnect...');
            orderChannel = null;
            mqConnection = null;
            setTimeout(() => amqpConnectAndConsume(), 5000);
        });
    }
    catch (ex) {
        if (retryCount < MAX_RETRIES) {
            const delay = Math.min(INITIAL_RETRY_DELAY * Math.pow(2, retryCount), MAX_RETRY_DELAY);
            logger.warn(`AMQP - connection failed: ${ex.message}. Retrying in ${delay}ms... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
            await sleep(delay);
            return amqpConnectAndConsume(retryCount + 1);
        } else {
            logger.log('fatal', `AMQP - Failed to connect after ${MAX_RETRIES} attempts: ${ex}`);
            process.exit(1);
        }
    }
}

module.exports = {
    amqpConnectAndConsume: amqpConnectAndConsume
}
