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
      const parsedMessage = JSON.parse(msg.content.toString());

      console.log("PARSED MESSAGE", parsedMessage);


      parsedMessage.routeIndex++;
      console.log("Userservice route index after increased");

      const correlationId = msg.properties.correlationId;
      const productList = parsedMessage.resultStack.getProductResultList;

      const usersWithProducts = getUserListWithProducts(productList);

      console.log("User service with products",usersWithProducts);

      const message : {} = {
        correlationId: parsedMessage.correlationId,
        param: parsedMessage.param,
        msgContent: parsedMessage.msgContent,
        routeIndex: parsedMessage.routeIndex,
        resultStack: parsedMessage.resultStack
      }
      
      channel.sendToQueue("aggregator", Buffer.from(JSON.stringify(message)), {
        correlationId,
      });

      channel.ack(msg);
    }
  });

  channel.consume('user.getRoleList', (msg) => { 
    if (msg !== null) {
      let { routeIndex } = JSON.parse(msg.content.toString());
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


function getUserListWithProducts(products: any[]) {
  const users = getUserList();
  return users.map(user => {
    const userProducts = user.productIds.map(productId => {
      return products.find(product => product.id === productId);
    }).filter(product => product !== undefined);

    return { ...user, products: userProducts };
  });
}

connectRabbitMQ();
