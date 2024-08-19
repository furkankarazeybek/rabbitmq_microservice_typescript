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
      const param: string = msgContent.param;
      const correlationId: string = msgContent.correlationId;
      const routeIndex: number = 0;

      const message : {} = {
        correlationId: correlationId,
        param: param,
        msgContent: msgContent,
        routeIndex: routeIndex,
        resultStack: {}
      }

      const routeRaw = routeConfig.find(r => r.actionName === param);

      if (routeRaw) {
        const currentQueue = routeRaw.route[routeIndex];
        channel.assertQueue(currentQueue, { durable: false });
  
        // Gönderilen mesajın doğru olduğundan emin olalım
        channel.sendToQueue(currentQueue, Buffer.from(JSON.stringify(message )));  
      }  

      channel.ack(msg);
    }
  });
}

async function sendToService() {

      await channel.consume('aggregator', async (msg) => {
        if (msg !== null) {
          const message = JSON.parse(msg.content.toString());
          const responseIndex: number = message.routeIndex;

          const routeRaw = routeConfig.find(r => r.actionName === message.param);

          console.log("Received response:", message);
          console.log("Response Index:", responseIndex);

          const getProductListResult = message?.resultStack?.getProductListResult;

          console.log("getProductListResult:", getProductListResult);

          if (routeRaw && responseIndex < routeRaw.route.length) {

            
            const newQueue = routeRaw.route[responseIndex];
            console.log("Next Route Index:", responseIndex);

            const microServiceMesssage : {} = {
              correlationId: message.correlationId,
              param: message.param,
              msgContent: message.msgContent,
              routeIndex: message.routeIndex,
              resultStack: message.resultStack
            }


          await channel.sendToQueue(newQueue, Buffer.from(JSON.stringify(microServiceMesssage)));
          } 
          else {

            if(routeRaw?.finalResult && message.resultStack[routeRaw.finalResult]) {

              await channel.sendToQueue("api_gateway", Buffer.from(JSON.stringify(message.resultStack[routeRaw?.finalResult]))); 
            }

            await channel.sendToQueue("api_gateway", Buffer.from(JSON.stringify("İşlem Başarılı"))); 
          }

          channel.ack(msg);
        }
      }, { noAck: false });
}

// async function processFinalResponse(finalResult: string) {
//   return new Promise((resolve, reject) => {

//     console.log("Response stacksss",responseStacks);
//     const responseStack = responseStacks[finalResult];
    
//     if (responseStack) {
//       console.log("Processing final response for finalResult:", finalResult);
//       console.log("Final response stack:", responseStack);

//       const finalResponse = responseStack;

//       console.log("final RESPOSNE",finalResponse);

//       // İşlem tamamlandıktan sonra temizleme işlemi
//       delete responseStacks[finalResult];
      
//       resolve(finalResponse);
//     } else {
//       reject(new Error(`No response stack found for finalResult: ${finalResult}`));
//     }
//   });
//}

connectRabbitMQ();
