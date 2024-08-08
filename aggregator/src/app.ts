import amqp from 'amqplib';
import routeConfig from "../route-config"

const RABBITMQ_URL = 'amqp://localhost';

let channel: amqp.Channel;
const responseHandlers = new Map<string, (response: any) => void>();


async function connectRabbitMQ() {
  const connection = await amqp.connect(RABBITMQ_URL);
  channel = await connection.createChannel();
  channel.assertQueue('api_gateway_request', { durable: false });

  channel.consume('api_gateway_request', async (msg) => { 
    if (msg !== null) {
      const { param } = JSON.parse(msg.content.toString());
      const correlationId = msg.properties.correlationId;

      // routeConfig'te param'a karşılık gelen serviceName'i bulalım
      const route = routeConfig.find((route:any) => route.actionName === param);

      if (route) {
        const response = await sendToService(route.serviceName, { param });
        channel.sendToQueue(
          'api_gateway', 
          Buffer.from(JSON.stringify(response)), 
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
    // resolve fonksiyonunu correlationId ile birlikte responseHandlers Map'i eklenir
    const deger = responseHandlers.set(correlationId, resolve);

    channel.assertQueue('aggregator', { durable: false });

    channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
      correlationId,
    });

    console.log("Mesaj buraya gönderildi:", queue);

    channel.consume(
      "aggregator",
      (msg) => {
        if (msg !== null) {
          const correlationId = msg.properties.correlationId;
          const handler = responseHandlers.get(correlationId);

          if (handler) { 
            handler(JSON.parse(msg.content.toString()));  // Bu handler aslında resolve fonksiyonu. resolve çağırıldığında promise tamamlanmış oldu.
            responseHandlers.delete(correlationId); // reponnseHandler isimli mapten correlationId'yi siliyoruz
            channel.ack(msg);
          }
        }
      },
      { noAck: false }
    );
  });
}


function generateUuid() {
  return Math.random().toString() + Math.random().toString() + Math.random().toString();
}

connectRabbitMQ();
