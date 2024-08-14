import amqp from 'amqplib';

const RABBITMQ_URL = 'amqp://localhost';

let channel: amqp.Channel;

async function connectRabbitMQ() {
  const connection = await amqp.connect(RABBITMQ_URL);
  channel = await connection.createChannel();
  channel.assertQueue('user.getUserList', { durable: false });
  channel.assertQueue('user.getRoleList', { durable: false });


  channel.consume('user.getUserList', (msg) => { 
    if (msg !== null) {
      console.log("user mesaj", JSON.parse(msg.content.toString()));
      const { routeIndex } = JSON.parse(msg.content.toString());
      const { param } = JSON.parse(msg.content.toString());
      console.log(param);
      console.log("Userservice route index",routeIndex);
      const correlationId = msg.properties.correlationId;

      const response = getUserList();
      channel.sendToQueue("aggregator", Buffer.from(JSON.stringify({  response, routeIndex })), {
        correlationId,
      });

      channel.ack(msg);
    }
  });

  channel.consume('user.getRoleList', (msg) => { 
    if (msg !== null) {
      const { routeIndex } = JSON.parse(msg.content.toString());
      const { param } = JSON.parse(msg.content.toString());
      console.log(param);
      const correlationId = msg.properties.correlationId;

      const response = getRoleList();
      channel.sendToQueue("aggregator", Buffer.from(JSON.stringify({ response, routeIndex })), {
        correlationId,
      });

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
