import amqp from 'amqplib';
import routeConfig from "../route-config";

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


        const response: any = await sendToService(correlationId, param, { msgContent});

        console.log("apigateway request response", response);

        console.log("route raw")

        // const message : {} = {
        //   routeIndex: 0,
        //   action: "method ismi",
        //   resultStack: {
        //   }
        // }; 

      
        channel.sendToQueue(
          'api_gateway',
          Buffer.from(JSON.stringify({ param, response })),
          { correlationId }
        );
        
    

      channel.ack(msg);
    }
  });
}

async function sendToService(correlationId:string, param:string,  message: object) {
  return new Promise((resolve) => {
    responseHandlers.set(correlationId, resolve);
    
    let routeIndex: number = 0; // routeIndex başlangıç olarak 0

    const routeRaw = routeConfig.find(r => r.actionName === param);

    if (routeRaw) {
      const currentQueue = routeRaw.route[routeIndex];
      channel.assertQueue(currentQueue, { durable: false });

      // İlk mesajı gönderiyoruz
      channel.sendToQueue(currentQueue, Buffer.from(JSON.stringify({ ...message, routeIndex })), { correlationId });

      console.log("Routeraw", routeRaw);

      channel.consume(
        'aggregator',
        (msg) => {
          if (msg !== null) {
            const handler = responseHandlers.get(msg.properties.correlationId);
            if (handler) {
              const response = JSON.parse(msg.content.toString());
              handler(response);

              console.log("RESPONSE INDEX", response.routeIndex);
              const responseIndex : number = response.routeIndex;
            

              if (routeIndex < routeRaw.route.length) {
                const newQueue = routeRaw.route[responseIndex];
                console.log("ROUTE INDEX", routeIndex);

                // Artırılmış routeIndex ile yeni mesajı gönderiyoruz
                channel.sendToQueue(newQueue, Buffer.from(JSON.stringify({ response })), { correlationId });
              }

              responseHandlers.delete(msg.properties.correlationId);
              channel.ack(msg);
            }
          }
        },
        { noAck: false }
      );
    }
  });
}



connectRabbitMQ();
