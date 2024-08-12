import amqp from 'amqplib';
import routeConfig from "../route-config";

const RABBITMQ_URL = 'amqp://localhost';
let channel: amqp.Channel;
const responseHandlers = new Map<string, (response: any) => void>();

async function connectRabbitMQ() {
    const connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();
    channel.assertQueue('api_gateway_request', { durable: false });

    channel.consume('api_gateway_request', async (msg) => {
        if (msg !== null) {
            const msgContent = JSON.parse(msg.content.toString());
            const param: string = msgContent.param; 
            const correlationId = msg.properties.correlationId;

            const route: any | undefined = routeConfig.find(r => r.actionName === param);
            if (route) {
                const responseList: any[] = await Promise.all(route.route.map(async (singleRoute: string) => {
                    const [serviceName, serviceMethod] = singleRoute.split('.');
                    return sendToService(serviceName, { param: serviceMethod });
                }));

                verifyResponses(responseList);

                const combinedResponse = combineResponses(responseList);

                channel.sendToQueue('api_gateway', Buffer.from(JSON.stringify(combinedResponse)), { correlationId });
            }
            channel.ack(msg);
        }
    }, { noAck: false });
}

async function sendToService(queue: string, message: object): Promise<any> {
    return new Promise((resolve) => {
        const correlationId = generateUuid();
        responseHandlers.set(correlationId, resolve);

        channel.assertQueue('aggregator', { durable: false });
        channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), { correlationId });

        channel.consume('aggregator', (msg) => {
            if (msg !== null) {
                const handler = responseHandlers.get(msg.properties.correlationId);
                if (handler) {
                    handler(JSON.parse(msg.content.toString()));
                    responseHandlers.delete(msg.properties.correlationId);
                    channel.ack(msg);
                }
            }
        }, { noAck: false });
    });
}

function verifyResponses(responseList: any[]): void {
    responseList.forEach(response => {
        if (!Array.isArray(response)) {
            throw new Error('Response is not an array');
        }
    });
}

function combineResponses(responseList: any[]): any[] {
    if(responseList.length === 1) {
        return responseList[0];
    }

    const [userList, productList] = responseList;
   
    return userList.map((user: { productIds: number[], [key: string]: any }) => ({
        ...user,
        products: productList.filter((product: { id: number }) => user.productIds.includes(product.id))
    }));
}

function generateUuid(): string {
    return Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
}

connectRabbitMQ();