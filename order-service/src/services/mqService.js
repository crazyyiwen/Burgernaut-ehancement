const amqp = require("amqplib");
const { logger } = require('./loggerService')
const MQ_HOST = process.env.MQ_HOST || 'localhost'; // create MQ connection string using environment variable
const MQ_URL = `amqp://${MQ_HOST}:5672`;
const EXCHANGE = "orders";
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
 * Connect to RabbitMQ with retry logic and exponential backoff
 */
const amqpConnect = async (retryCount = 0) => {
    try {
        mqConnection = await amqp.connect(MQ_URL);
        orderChannel = await mqConnection.createChannel();

        await orderChannel.assertExchange(EXCHANGE, 'fanout', {
            durable: false
        });

        logger.info(`AMQP - connection established at ${MQ_URL}`)

        // Handle connection errors and reconnect
        mqConnection.on('error', (err) => {
            logger.error(`AMQP - connection error: ${err.message}`);
        });

        mqConnection.on('close', () => {
            logger.warn('AMQP - connection closed, attempting to reconnect...');
            orderChannel = null;
            mqConnection = null;
            setTimeout(() => amqpConnect(), 5000);
        });

    }
    catch (ex) {
        if (retryCount < MAX_RETRIES) {
            const delay = Math.min(INITIAL_RETRY_DELAY * Math.pow(2, retryCount), MAX_RETRY_DELAY);
            logger.warn(`AMQP - connection failed: ${ex.message}. Retrying in ${delay}ms... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
            await sleep(delay);
            return amqpConnect(retryCount + 1);
        } else {
            logger.log('fatal', `AMQP - Failed to connect after ${MAX_RETRIES} attempts: ${ex}`);
            process.exit(1);
        }
    }
}


/**
 * Publish order to queue
 * @param {Object} order - order object containing order details
 */
const publishOrderToExchange = (order) => {
    if (!orderChannel) {
        logger.error('AMQP - Cannot publish order: channel not initialized');
        throw new Error('Message queue channel not available');
    }
    orderChannel.publish(EXCHANGE,'', Buffer.from(JSON.stringify(order)));
    logger.info(`AMQP - order ${order._id} placed`);
}

/**
 * An express middleware for injecting queue services into the request object.
 * @param {Object} req - express request object.
 * @param {Object} res - express response object.
 * @param {Function} next - express next() function.
 */
const injectExchangeService = (req, res, next) => {
    // add all exchange operations here
    const exchangeServices = {
        publishOrderToExchange: publishOrderToExchange
    }
    // inject exchangeServices in request object
    req.exchangeServices = exchangeServices;
    next();
}

module.exports = {
    injectExchangeService: injectExchangeService,
    amqpConnect: amqpConnect
}
