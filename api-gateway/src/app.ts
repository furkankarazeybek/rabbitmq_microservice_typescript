import express from 'express';
import bodyParser from 'body-parser';
import amqp from 'amqplib';

const app = express();
app.use(bodyParser.json());

const RABBITMQ_URL = 'amqp://localhost';

let channel: amqp.Channel;
const responseHandlers = new Map<string, (response: any) => void>();

// RabbitMQ bağlantısı
async function connectRabbitMQ() {
  const connection = await amqp.connect(RABBITMQ_URL);
  channel = await connection.createChannel();
  await channel.assertQueue("api_gateway", { durable: false });

  //api-gateway response
  channel.consume("api_gateway", (msg) => {
    if (msg !== null) {
      const correlationId = msg.properties.correlationId;
      const handler = responseHandlers.get(correlationId);
      if (handler) {
        handler(JSON.parse(msg.content.toString()));  // buffer veriyi alıp json parse ettikten sonra correlation id silinir
        responseHandlers.delete(correlationId);
        channel.ack(msg);
      }
    }
  }, { noAck: false });
}

// POST isteği
app.post('/api', async (req, res) => {
  const { param } = req.body;
  const correlationId = generateUuid();
  
  console.log("Response hadnler",responseHandlers);

  responseHandlers.set(correlationId, (response) => {
    console.log("api gateway response",response);
    res.json(response);
  });

  const message = {
    param: param,
    correlationId: correlationId
  }

  channel.sendToQueue(
    'api_gateway_request',
    Buffer.from(JSON.stringify( message ))
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
