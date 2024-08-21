import amqp from 'amqplib';
import routeConfig from "../route-config";

const RABBITMQ_URL = 'amqp://localhost';

let channel: amqp.Channel;

async function connectRabbitMQ() {
  const connection = await amqp.connect(RABBITMQ_URL);
  channel = await connection.createChannel();
  await channel.assertQueue('api_gateway_request', { durable: false });
  await channel.assertQueue('aggregator', { durable: false });

  await sendToService();

  await channel.consume('api_gateway_request', async (msg) => {
    if (msg !== null) {
      const msgContent = JSON.parse(msg.content.toString());
      console.log("api_gateway_request e gelen ilk mesaj", msgContent);

      const param: string = msgContent.param;
      const correlationId: string = msgContent.correlationId;
      const routeIndex: number = 0;

      const message = {
        correlationId: correlationId,
        param: param,
        msgContent: msgContent,
        routeIndex: routeIndex,
        resultStack: {}
      };

      console.log("mikroservise gönderilen mesaj", message);

      const routeRaw = routeConfig.find(r => r.actionName === param);

      if (routeRaw) {
        const currentQueue = routeRaw.route[routeIndex];
        await channel.assertQueue(currentQueue, { durable: false });

        channel.sendToQueue(currentQueue, Buffer.from(JSON.stringify(message)));
      }

      channel.ack(msg);
    }
  });
}

async function sendToService() {
  await channel.consume('aggregator', async (msg) => {
    if (msg !== null) {
      const parsedMessage = JSON.parse(msg.content.toString());
      console.log("aggregatora gelen ilk mesaj", parsedMessage);

      const message = parsedMessage?.message || parsedMessage;

      const responseIndex: number = message?.routeIndex ?? 0;
      const param: string = message?.msgContent?.param ?? '';

      console.log("Full message received:", parsedMessage);

      const routeRaw = routeConfig.find(r => r.actionName === param);

      if (!message?.resultStack) {
        console.error("Error: 'resultStack' is undefined or null in message");
        return;
      }

      console.log("routeraw", routeRaw);
      const keys = Object.keys(message.resultStack);
      console.log("Available keys in resultStack:", keys);

      const finalResultKey : any= routeRaw?.finalResult;
      if (keys.includes(finalResultKey)) {
        const currentFinalResult = message.resultStack[finalResultKey];
        console.log("Final Result:", currentFinalResult);
        await channel.sendToQueue("api_gateway_response", Buffer.from(JSON.stringify(currentFinalResult)));

      }

      console.log("route raw", routeRaw);
      console.log("response index", responseIndex);
      console.log("routeRaw.route.length", routeRaw?.route.length);


      if (routeRaw && responseIndex < routeRaw.route.length) {
        const newQueue = routeRaw.route[responseIndex];
        console.log("Next Route Index:", responseIndex);

        const microServiceMessage = {
          correlationId: message.correlationId,
          param: message.param,
          msgContent: message.msgContent,
          routeIndex: message.routeIndex,
          resultStack: message.resultStack
        };

        console.log("Mikro servis message", microServiceMessage);
        await channel.sendToQueue(newQueue, Buffer.from(JSON.stringify(microServiceMessage)));
      } else {
        if (routeRaw?.finalResult && message?.resultStack[routeRaw.finalResult]) {
          const sentMessage = {
            correlationId : message.correlationId,
            response : message.resultStack[finalResultKey]
          }
          await channel.sendToQueue("api_gateway_response", Buffer.from(JSON.stringify(sentMessage)));
          console.log("gönderilen mesaj",message.correlationId, message.resultStack[finalResultKey])
          const queue = await channel.checkQueue('api_gateway_response');
          console.log("api_gateway_response kuyruğundaki mesaj sayısı:", queue.messageCount);
        } else {
          await channel.sendToQueue("api_gateway_response", Buffer.from(JSON.stringify("İşlem Başarılı")));
        }
      }

      channel.ack(msg);
    }
  }, { noAck: false });
}

connectRabbitMQ();
