import amqp from 'amqplib';

const RABBITMQ_URL = 'amqp://localhost';

let channel: amqp.Channel;

async function connectRabbitMQ() {
  const connection = await amqp.connect(RABBITMQ_URL);
  channel = await connection.createChannel();
  channel.assertQueue('user', { durable: false }); // durable: false : rabbit mq yeniden başlatırılırsa kuyruk silinir

  channel.consume('user', (msg) => { // user kuyruğuna gönderilen mesaj tüketimi
    if (msg !== null) {
      const { param } = JSON.parse(msg.content.toString());
      const correlationId = msg.properties.correlationId;

      if (param === 'getUserList') {
        const response = getUserList();
        channel.sendToQueue(msg.properties.replyTo, Buffer.from(JSON.stringify(response)), {
          correlationId,
        });
        console.log("mesaj aggregatora gider",msg.properties.replyTo)
        
      }

      channel.ack(msg);
    }
  });
}

function getUserList() {
  return [{ id: 1, name: 'John Doe' }, { id: 2, name: 'Jane Doe' }];
}

connectRabbitMQ();
