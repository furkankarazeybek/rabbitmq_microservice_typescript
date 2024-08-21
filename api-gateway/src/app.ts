import express from 'express';
import bodyParser from 'body-parser';
import amqp from 'amqplib';
import { v4 as uuidv4 } from 'uuid';  // uuid paketini import et

const app = express();
app.use(bodyParser.json());

const RABBITMQ_URL = 'amqp://localhost';

let channel: amqp.Channel;
const responseHandlers = new Map<string, (response: any) => void>();

async function connectRabbitMQ() {
  const connection = await amqp.connect(RABBITMQ_URL);
  channel = await connection.createChannel();
  await channel.assertQueue("api_gateway_response", { durable: false });

  channel.consume("api_gateway_response", (msg) => {
    if (msg !== null) {
      console.log("api_gateway_response kuyruğuna gelen mesaj:", msg.content.toString());
      const parsedMessage = JSON.parse(msg.content.toString());

      const correlationId = parsedMessage.correlationId;
      const handler = responseHandlers.get(correlationId);

      console.log("HANDLER", handler);

      if (handler) {
        const response = JSON.parse(msg.content.toString());
        console.log("GELEN YANIT:", response);

        handler(response);

        responseHandlers.delete(correlationId);
      }

      channel.ack(msg);
    }
  }, { noAck: false });
}

// POST isteği
app.post('/api', async (req, res) => {
  const { param } = req.body;
  const correlationId = uuidv4(); 

  console.log("Response handler", responseHandlers);

  responseHandlers.set(correlationId, (response) => {
    console.log("api gateway response", response);
    res.status(200).json(response);
  });

  const message = {
    param: param,
    correlationId: correlationId
  };

  channel.sendToQueue(
    'api_gateway_request',
    Buffer.from(JSON.stringify(message))
  );
});


connectRabbitMQ().then(() => {
  app.listen(3000, () => {
    console.log('API Gateway listening on port 3000');
  });
});
