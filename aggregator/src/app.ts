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
      console.log("api_gateway_request e gelen ilk mesaj",msgContent); // 
      // ilk mesaj {
      //   param: 'getUserList',
      //   correlationId: '0.61185015573440340.89072764448299240.7155873550001093'
      // }
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

      console.log("mikroservise gönderilen mesaj", message);
      //mikroservise  gönderilen mesaj {
      //   correlationId: '0.0108634615059670650.128922293410361320.8731129152051664',
      //   param: 'getUserList',
      //   msgContent: {
      //     param: 'getUserList',
      //     correlationId: '0.0108634615059670650.128922293410361320.8731129152051664'
      //   },
      //   routeIndex: 0,
      //   resultStack: {}
      // }

      const routeRaw = routeConfig.find(r => r.actionName === param);

      if (routeRaw) {
        const currentQueue = routeRaw.route[routeIndex];
        await channel.assertQueue(currentQueue, { durable: false });
  
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
          console.log("aggregatora gelen ilk mesaj", message);
          // aggregatora gelen ilk mesaj {
          //   message: {
          //     correlationId: '0.17090044415999750.27904411552918230.007355740900325092',
          //     param: 'getUserList',
          //     msgContent: {
          //       param: 'getUserList',
          //       correlationId: '0.17090044415999750.27904411552918230.007355740900325092'
          //     },
          //     routeIndex: 0,
          //     resultStack: { getProductListResult: [Array] }
          //   }
          // }
          const responseMessage = message.message;

          const responseIndex: number = responseMessage?.routeIndex ?? 0;
          const param: string = responseMessage?.param ?? '';


          const routeRaw = routeConfig.find(r => r.actionName === param);

          
          console.log("route raw", routeRaw); 

          console.log("Received response:", message);
          console.log("Response Index:", responseIndex);


          const finalResultKey: any = routeRaw?.finalResult;

          if (!responseMessage.resultStack) {
            console.error("Error: 'resultStack' is undefined or null in responseMessage");
            return;
          }


          console.log("routeraw", routeRaw);
          console.log("final result key", finalResultKey);
          
    
          const keys = Object.keys(responseMessage.resultStack);
          console.log("Available keys in resultStack:", keys);
          
          if (keys.includes(finalResultKey)) {
            const currentFinalResult = responseMessage.resultStack[finalResultKey];
            console.log("Final Result:", currentFinalResult);
          } else {
            console.error(`The key '${finalResultKey}' does not match any key in resultStack.`);
          }

          console.log("ROUTE NAME", routeRaw?.route[responseIndex-1]);


          const currentQueue : any = routeRaw?.route[responseIndex-1];
          const currentRoute = currentQueue.split('.').pop() || '';

          const config = routeConfig.find(cfg => cfg.actionName === currentRoute);

          if (config) {
            console.log(`Final result for actionName '${currentRoute}':`, config.finalResult);
            const finalResultToSend = config?.finalResult;
          


          console.log("current route",currentRoute);

          

          if (routeRaw && responseIndex < routeRaw.route.length) {

            const newQueue = routeRaw.route[responseIndex];
            console.log("Next Route Index:", responseIndex);

            const microServiceMesssage : {} = {
              correlationId: responseMessage.correlationId,
              param: responseMessage.param,
              msgContent: responseMessage.msgContent,
              routeIndex: responseMessage.routeIndex,
              resultStack: responseMessage.resultStack
            }

            console.log("Mikro servis message",microServiceMesssage);
            await channel.sendToQueue(newQueue, Buffer.from(JSON.stringify(microServiceMesssage)));
          } 
          else {

            if(routeRaw?.finalResult && responseMessage.resultStack[routeRaw.finalResult]) {

              await channel.sendToQueue("api_gateway", Buffer.from(JSON.stringify(responseMessage.resultStack[finalResultToSend]))); 
            }

            await channel.sendToQueue("api_gateway", Buffer.from(JSON.stringify("İşlem Başarılı"))); 
          }

          channel.ack(msg);
        }
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
