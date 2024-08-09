import amqp from 'amqplib';
import routeConfig from "../route-config";

const RABBITMQ_URL = 'amqp://localhost';

let channel: amqp.Channel;
const responseHandlers = new Map<string, (response: any) => void>();

async function connectRabbitMQ() {
  const connection = await amqp.connect(RABBITMQ_URL);
  channel = await connection.createChannel();
  channel.assertQueue('api_gateway_request', { durable: false });

  channel.consume('api_gateway_request', async (msg) => { 
    if (msg !== null) {
      let { param } = JSON.parse(msg.content.toString());
      const correlationId = msg.properties.correlationId;
      console.log("Param değeri ",param);

      const routeName = routeConfig.find(route => route.actionName === param);

     

      if (routeName) {
        const response: any = await sendToService(routeName.serviceName, { param });
        console.log("Response değeri", response);
      
        if (param === 'getUserList') {
          console.log("getUserList eşit");
          const userList = response.data; 
          console.log("User list", userList);

          // if (routeName && routeName.route.length > 1) {
          //   const firstRoute = routeName.route[1];
          //   const productList = firstRoute.split('.')[1];
            
          //   console.log("Product list metod:", productList);
          // }
      

          const productListResponse: any = await sendToService("product", { param: "getProductList" });
          console.log("Product list response", productListResponse);
      
          const mergedResponse = userList.map((user: any) => ({
            ...user,
            products: productListResponse?.filter((product: any) => user?.productIds?.includes(product.id))
          }));

          console.log("Merged response",mergedResponse);
      
          channel.sendToQueue(
            'api_gateway', 
            Buffer.from(JSON.stringify(mergedResponse)), 
            { correlationId }
          );
        } 
      }
      
      channel.ack(msg);
    }
  });
}

async function sendToService(queue: string, message: object) {
  return new Promise((resolve) => {
    const correlationId = generateUuid();
    responseHandlers.set(correlationId, resolve);

    channel.assertQueue('aggregator', { durable: false });

    channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
      correlationId,
    });

    channel.consume(
      "aggregator",
      (msg) => {
        if (msg !== null) {
          const handler = responseHandlers.get(msg.properties.correlationId);

          if (handler) { 
            handler(JSON.parse(msg.content.toString())); 
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
  return Math.random().toString() + Math.random().toString() + Math.random().toString();
}

connectRabbitMQ();
