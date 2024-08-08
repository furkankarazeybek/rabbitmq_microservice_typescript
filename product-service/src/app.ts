import amqp from 'amqplib';

const RABBITMQ_URL = 'amqp://localhost';

let channel: amqp.Channel;

async function connectRabbitMQ() {
  const connection = await amqp.connect(RABBITMQ_URL);
  channel = await connection.createChannel();
  channel.assertQueue('product', { durable: false });

  channel.consume('product', (msg) => {
    if (msg !== null) {
      const { param } = JSON.parse(msg.content.toString());
      const correlationId = msg.properties.correlationId;

      if (param === 'getProductList') {
        const response = getProductList();
        channel.sendToQueue("aggregator", Buffer.from(JSON.stringify(response)), {
          correlationId,
        });
      }

      channel.ack(msg);
    }
  });
}

function getProductList() {
  return [{ id: 1, name: 'Product A' }, { id: 2, name: 'Product B' }];
}

connectRabbitMQ();
