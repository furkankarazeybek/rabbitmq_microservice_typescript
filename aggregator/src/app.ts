import amqp from 'amqplib';
import routeConfig from '../route-config';

const RABBITMQ_URL = 'amqp://localhost';

let channel: amqp.Channel;
const responseHandlers = new Map<string, (response: any) => void>();

async function connectRabbitMQ() {
  const connection = await amqp.connect(RABBITMQ_URL);
  channel = await connection.createChannel();
  await channel.assertQueue('api_gateway_request', { durable: false });
  await channel.assertQueue('aggregator', { durable: false });

  channel.consume('api_gateway_request', async (msg) => {
    if (msg !== null) {
      const msgContent = JSON.parse(msg.content.toString());
      const param: string = msgContent.param;
      const correlationId = msg.properties.correlationId;
      let routeIndex: number = 0;

      const routeRaw = routeConfig.find(r => r.actionName === param);

      console.log("Routeraw", routeRaw);

      if (routeRaw) {
        const currentQueue = routeRaw.route[routeIndex];

        // Servisi çağır
        const response: any = await sendToService(currentQueue, { ...msgContent, routeIndex });

        // Sonucu bir sonraki adım için ilet
        if (routeIndex + 1 < routeRaw.route.length) {
          routeIndex += 1;
          const nextQueue = routeRaw.route[routeIndex];
          channel.sendToQueue(nextQueue, Buffer.from(JSON.stringify({ ...msgContent, routeIndex })), { correlationId });
        }

        // Sonuçları API Gateway'e gönder
        channel.sendToQueue(
          'api_gateway',
          Buffer.from(JSON.stringify({ param, response })),
          { correlationId }
        );
      }

      channel.ack(msg);
    }
  });
}

async function sendToService(queue: string, message: object) {
  return new Promise((resolve) => {
    const correlationId = generateUuid();
    responseHandlers.set(correlationId, resolve);

    channel.assertQueue(queue, { durable: false });
    channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), { correlationId });

    channel.consume(
      'aggregator',
      (msg) => {
        if (msg !== null) {
          const msgContent = JSON.parse(msg.content.toString());
          const handler = responseHandlers.get(msg.properties.correlationId);
          if (handler) {
            handler(msgContent);
            responseHandlers.delete(msg.properties.correlationId);
            channel.ack(msg);
          }
        }
      },
      { noAck: false }
    );
  });
}

function generateUuid() {
  return Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
}

connectRabbitMQ();
