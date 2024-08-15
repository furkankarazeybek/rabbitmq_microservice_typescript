import amqp from 'amqplib';
import routeConfig from "../route-config";

const RABBITMQ_URL = 'amqp://localhost';

let channel: amqp.Channel;
const responseHandlers = new Map<string, (response: any) => void>();
const responseStacks = new Map<string, any[]>(); // To store response stacks

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

      try {
        const response: any = await sendToService(correlationId, param, { msgContent });
        //route 0 index 
        console.log("API Gateway request response", response);
        
        channel.sendToQueue(
          'api_gateway',
          Buffer.from(JSON.stringify({ param, response })),
          { correlationId }
        );
      } catch (error) {
        console.error("Error handling API Gateway request:", error);
      }

      channel.ack(msg);
    }
  });
}

async function sendToService(correlationId: string, param: string, message: object) {
  return new Promise((resolve, reject) => {
    responseHandlers.set(correlationId, (response: any) => {
      responseHandlers.delete(correlationId); // Clean up the handler
      resolve(response); // Resolve with the final response
    });

    let routeIndex: number = 0;
    const routeRaw = routeConfig.find(r => r.actionName === param);

    if (routeRaw) {
      const currentQueue = routeRaw.route[routeIndex];
      channel.assertQueue(currentQueue, { durable: false });

      channel.sendToQueue(currentQueue, Buffer.from(JSON.stringify({ ...message, routeIndex })), { correlationId });

      console.log("Route Raw", routeRaw);

      channel.consume('aggregator', async (msg) => {
        if (msg !== null) {
          const response = JSON.parse(msg.content.toString());
          const responseIndex: number = response.routeIndex;

          let responseStack = responseStacks.get(correlationId) || [];
          responseStack.push(response);
          responseStacks.set(correlationId, responseStack);

          console.log("Received response:", response);
          console.log("Response Index:", responseIndex);

          if (responseIndex  < routeRaw.route.length) {
            const newQueue = routeRaw.route[responseIndex];
            console.log("Next Route Index:", responseIndex);

            channel.sendToQueue(newQueue, Buffer.from(JSON.stringify({ response, routeIndex: responseIndex })), { correlationId });
          } else {
            processFinalResponse(correlationId).then(resolve).catch(reject);
          }

          channel.ack(msg);
        }
      },
      { noAck: false });


    } else {
      reject(new Error(`No route configuration found for action: ${param}`));
    }
  });
}

async function processFinalResponse(correlationId: string) {
  return new Promise((resolve, reject) => {
    const responseStack = responseStacks.get(correlationId);
    if (responseStack) {
      console.log("Processing final response for correlationId:", correlationId);
      console.log("Final response stack:", responseStack);

      const finalResponse = responseStack[responseStack.length - 1];

      responseStacks.delete(correlationId);
      
      resolve(finalResponse);
    } else {
      reject(new Error(`No response stack found for correlationId: ${correlationId}`));
    }
  });
}

connectRabbitMQ();
