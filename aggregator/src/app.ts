import amqp from 'amqplib';

const RABBITMQ_URL = 'amqp://localhost';

let channel: amqp.Channel;

async function connectRabbitMQ() {
  const connection = await amqp.connect(RABBITMQ_URL);
  channel = await connection.createChannel();
  channel.assertQueue('aggregator', { durable: false }); // aggretor isminde kuyruk oluşur . { durable: false }, kuyruğun kalıcı olmadığını ve RabbitMQ sunucusu kapandığında kaybolacağını belirtir.
  channel.consume('aggregator', async (msg) => { // mesaj tüketim
    if (msg !== null) {
      const { param } = JSON.parse(msg.content.toString()); 
      const correlationId = msg.properties.correlationId; // gelen mesajdaki corelation id yi alır
      console.log("api gatewayden gelen corelation id", correlationId);

      let response;
      if (param === 'getUserList') {
        response = await sendToService('user', { param });
      } else if (param === 'getProductList') {
        response = await sendToService('product', { param });
      }

      channel.sendToQueue(
        msg.properties.replyTo, Buffer.from(JSON.stringify(response)), { // sendToService'ten dönen yanıtı aggregator'ın replyTo kuyruğuna gönderir. yani api-gateway'e gider
        correlationId,
      });
      console.log("api-gatewaye yanıt döner",msg.properties.replyTo);
      channel.ack(msg);
    }
  });
}

async function sendToService(queue: string, message: object) {
  const aggregator = await channel.assertQueue('', { exclusive: true }); //geçici yanıt kuyruğu
  const correlationId = generateUuid(); 

  return new Promise((resolve) => { // promise, yanıt alındığında çözümlenecek
    channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), { // mesajı göndereceği kuyruk göndericek queue = user veya product
      correlationId,
      replyTo: aggregator.queue,
    });

    console.log("queue(user veya product) kuyruğuna yanıt kuyruğu gönderilir reply to:", aggregator.queue);
    console.log("agregatordan mesaj buraya gönderilir", queue);  // queue: user veya product


    

    channel.consume( //gelen kuyruk yanıtını burdan alıyor
      aggregator.queue,
      (msg) => {
        if(msg == null) {
            return;
        }
        if (msg.properties.correlationId === correlationId) {
          resolve(JSON.parse(msg.content.toString())); // buffer mesajı çözümler jsona çevirir örneğin param: "getUserList"
          channel.ack(msg);
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
