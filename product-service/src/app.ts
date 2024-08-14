import amqp from 'amqplib';

const RABBITMQ_URL = 'amqp://localhost';

let channel: amqp.Channel;

async function connectRabbitMQ() {
  const connection = await amqp.connect(RABBITMQ_URL);
  channel = await connection.createChannel();
  channel.assertQueue('product.getProductList', { durable: false });
  channel.assertQueue('product.getProductCategoriesList', { durable: false });


  channel.consume('product.getProductList', (msg) => { 
    if (msg !== null) {
      const { routeIndex } = JSON.parse(msg.content.toString());
      const { param } = JSON.parse(msg.content.toString());
      console.log(param);
      console.log("Userservice route index",routeIndex);
      const correlationId = msg.properties.correlationId;

      const response = getProductList();
      channel.sendToQueue("aggregator", Buffer.from(JSON.stringify({  response, routeIndex })), {
        correlationId,
      });

      channel.ack(msg);
    }
  });

  channel.consume('product.getProductCategoriesList', (msg) => { 
    if (msg !== null) {
      const { routeIndex } = JSON.parse(msg.content.toString());
      const { param } = JSON.parse(msg.content.toString());
      console.log(param);
      const correlationId = msg.properties.correlationId;

      const response = getProductCategoriesList();
      channel.sendToQueue("aggregator", Buffer.from(JSON.stringify({ response, routeIndex })), {
        correlationId,
      });

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
