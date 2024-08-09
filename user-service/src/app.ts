import amqp from 'amqplib';

const RABBITMQ_URL = 'amqp://localhost';

let channel: amqp.Channel;

async function connectRabbitMQ() {
  const connection = await amqp.connect(RABBITMQ_URL);
  channel = await connection.createChannel();
  channel.assertQueue('user', { durable: false });

  channel.consume('user', (msg) => { 
    if (msg !== null) {
      const { param } = JSON.parse(msg.content.toString());
      console.log(param);
      const correlationId = msg.properties.correlationId;

      if (param === 'getUserList') {
        const response = getUserList();
        channel.sendToQueue("aggregator", Buffer.from(JSON.stringify({ data: response })), {
          correlationId,
        });
      } else if (param === 'getRoleList') {
        const response = getRoleList();
        channel.sendToQueue("aggregator", Buffer.from(JSON.stringify(response)), {
          correlationId,
        });
      }

      channel.ack(msg);
    }
  });
}

function getUserList() {
  return [
    { id: 1, name: 'John Doe', productIds: [1, 2] }, 
    { id: 2, name: 'Jane Doe', productIds: [2] }
  ];
}

function getRoleList() {
  return [{ id: 1, role: 'Admin' }, { id: 2, role: 'User' }];
}

connectRabbitMQ();
