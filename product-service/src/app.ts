import amqp from 'amqplib';

const RABBITMQ_URL = 'amqp://localhost';

let channel: amqp.Channel;

async function connectRabbitMQ() {
  const connection = await amqp.connect(RABBITMQ_URL);
  channel = await connection.createChannel();
  channel.assertQueue('product', { durable: false });

  channel.consume('product', (msg) => {
    if (msg !== null) {
      const { param } = JSON.parse(msg.content.toString());
      const correlationId = msg.properties.correlationId;

      if (param === 'getProductList') {
        const response = getProductList();
        channel.sendToQueue("aggregator", Buffer.from(JSON.stringify(response)), {
          correlationId,
        });
      }

      else if(param === "getProductCategoriesList") {
        const response = getProductCategoriesList();
        channel.sendToQueue("aggregator", Buffer.from(JSON.stringify(response)), {
          correlationId,
        });
      }

      channel.ack(msg);
    }
  });
}

function getProductList() {
  return [{ id: 1, name: 'Product A',  productCategoryId: [1] }, { id: 2, name: 'Product B',  productCategoryId: [2] }];
}


function getProductCategoriesList() {
  return [{ id: 1, categoryName: 'Electronics' }, { id: 2, categoryName: 'Entertainment' }];
}

connectRabbitMQ();
