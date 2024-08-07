import express from 'express';
import bodyParser from 'body-parser';
import amqp from 'amqplib';

const app = express();
app.use(bodyParser.json());

const RABBITMQ_URL = 'amqp://localhost';

let channel: amqp.Channel;
// rabbitmq bağlantısı
async function connectRabbitMQ() {
  const connection = await amqp.connect(RABBITMQ_URL);
  channel = await connection.createChannel();
}
//post isteği
app.post('/api', async (req, res) => {
  const { param } = req.body;
  const correlationId = generateUuid(); // correlation id eşsiz olmalı, yanıt ile isteği eşleştirmek için kullanılır
  const responseQueue = await channel.assertQueue('', { exclusive: true }); // exclusive: true yalnızca bu bağlantı tarafından kullanılabilir, yanıt gelirse bu kuyruğa gelicek

  // channel.sendToQueue: aggregator adlı rabbitmq kuyruğuna mesaj gönderir
  channel.sendToQueue(
    'aggregator',
    Buffer.from(JSON.stringify({ param })),  // rabbitmq ikili veri formatı kullanır gönderirken jsonu buffera 
    { correlationId, replyTo: responseQueue.queue }  // agreegator'a correlationId gönderilir, yanıtın geleceği yer : replyTo 
  );
  console.log("Aggregatora gönderilen",responseQueue.queue)


  
// channel.consume: responseQueue.queue kuyruğundan mesajları tüketir
  channel.consume(
    responseQueue.queue,
    (msg) => { // gelen mesaj nesnesi : msg
      if(msg == null) {
          return ;
      }
      if (msg.properties.correlationId === correlationId) {  // yanıt corelationId  ile gönderilen correlationId eşit mi bakıyoruz
        res.json(JSON.parse(msg.content.toString()));
        channel.ack(msg); // Mesajın başarıyla işlendiğini RabbitMQ'ya bildirir ve kuyruktan kaldırır
      }
    },
    
    { noAck: false }  // rabbitmqya işlendiğinde onaylanması gerektiğini belirtir
  );

});


function generateUuid() {
  return Math.random().toString() + Math.random().toString() + Math.random().toString();
}

connectRabbitMQ().then(() => {
  app.listen(3000, () => {
    console.log('API Gateway listening on port 3000');
  });
});
