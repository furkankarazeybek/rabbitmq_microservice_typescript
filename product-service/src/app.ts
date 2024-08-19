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
      try {
        const parsedMessage = JSON.parse(msg.content.toString());

        console.log("Received message for product.getProductList:", parsedMessage);

        let { routeIndex } = parsedMessage;
        routeIndex++;

        console.log("Product service route index after increased:", routeIndex);

        const correlationId = msg.properties.correlationId;

        console.log("PARSED MESSAGE", parsedMessage);
        if (!parsedMessage) {
          throw new Error("Response property is missing in the message");
        }

        const productCategories = getProductCategoriesList();
        console.log("Product categories:", productCategories);

        const products = getProductList();
        console.log("Products list from getProductList:", products);

        const response = getProductListWithCategories(products, productCategories);

        parsedMessage.resultStack.getProductListResult = response;

        console.log("Products with categories:", response);

        const message : {} = {
          correlationId: parsedMessage.correlationId,
          param: parsedMessage.param,
          msgContent: parsedMessage.msgContent,
          routeIndex: parsedMessage.routeIndex,
          resultStack: parsedMessage.resultStack
        }

        console.log("YENİ PRODUCT MESAJ", message);

        channel.sendToQueue("aggregator", Buffer.from(JSON.stringify({ message })), {
          correlationId,
        });

        channel.ack(msg);
      } catch (error) {
        console.error("Error processing message:", error);
      }
    }
  });

  channel.consume('product.getProductCategoriesList', (msg) => { 
    if (msg !== null) {
      try {
        const parsedMessage = JSON.parse(msg.content.toString());
        console.log("Received message for product.getProductCategoriesList:", parsedMessage);

        let { routeIndex } = parsedMessage;
        routeIndex++;
        console.log("Product categories index after increased:", routeIndex);

        const correlationId = msg.properties.correlationId;

        const response = getProductCategoriesList();
        channel.sendToQueue("aggregator", Buffer.from(JSON.stringify({ response, routeIndex })), {
          correlationId,
        });

        channel.ack(msg);
      } catch (error) {
        console.error("Error processing message:", error);
      }
    }
  });
}

function getProductList() {
  return [{ id: 1, name: 'Product A', productCategoryId: [1] }, { id: 2, name: 'Product B', productCategoryId: [2] }];
}

function getProductCategoriesList() {
  return [{ id: 1, categoryName: 'Electronics' }, { id: 2, categoryName: 'Entertainment' }];
}

function getProductListWithCategories(products: any[], categories: any[]) {
  return products.map(product => {
    const productCategories = product.productCategoryId.map((categoryId: number) => {
      return categories.find(category => category.id === categoryId);
    }).filter((category: any) => category !== undefined);

    return { ...product, categories: productCategories };
  });
}

connectRabbitMQ();
