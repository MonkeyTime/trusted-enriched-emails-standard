import { Buffer } from "node:buffer";
import { connect } from "amqplib";

const exchangeName = "realtime_mail.routes";

export class InMemoryBroker {
  readonlyType = "memory";
  #clients = new Map();

  get type() {
    return this.readonlyType;
  }

  get subscriberCount() {
    return this.#clients.size;
  }

  async subscribe(route, onMessage) {
    const id = crypto.randomUUID();
    this.#clients.set(id, { route, onMessage });
    return {
      unsubscribe: async () => {
        this.#clients.delete(id);
      }
    };
  }

  async publish(route, message) {
    for (const client of this.#clients.values()) {
      if (client.route === route) {
        client.onMessage(message);
      }
    }
  }

  async close() {
    this.#clients.clear();
  }
}

export class RabbitMqBroker {
  readonlyType = "rabbitmq";
  #connection;
  #channel;
  #subscriptions = new Set();

  constructor(url) {
    this.url = url;
  }

  get type() {
    return this.readonlyType;
  }

  get subscriberCount() {
    return this.#subscriptions.size;
  }

  async connect() {
    this.#connection = await connect(this.url);
    this.#channel = await this.#connection.createChannel();
    await this.#channel.assertExchange(exchangeName, "topic", {
      durable: false,
      autoDelete: false
    });
  }

  async subscribe(route, onMessage) {
    const channel = this.#requireChannel();
    const queue = await channel.assertQueue("", {
      durable: false,
      exclusive: true,
      autoDelete: true
    });
    const routingKey = routeToRoutingKey(route);
    await channel.bindQueue(queue.queue, exchangeName, routingKey);
    const consumer = await channel.consume(queue.queue, (payload) => {
      if (!payload) return;
      onMessage(JSON.parse(payload.content.toString("utf8")));
    }, { noAck: true });

    const subscription = {
      unsubscribe: async () => {
        if (!this.#subscriptions.delete(subscription)) {
          return;
        }
        await channel.cancel(consumer.consumerTag).catch(() => undefined);
        await channel.deleteQueue(queue.queue).catch(() => undefined);
      }
    };
    this.#subscriptions.add(subscription);
    return subscription;
  }

  async publish(route, message) {
    const channel = this.#requireChannel();
    const payload = Buffer.from(JSON.stringify(message), "utf8");
    const accepted = channel.publish(exchangeName, routeToRoutingKey(route), payload, {
      contentType: "application/json",
      deliveryMode: 1,
      timestamp: Date.now()
    });
    if (!accepted) {
      await new Promise((resolve) => channel.once("drain", resolve));
    }
  }

  async close() {
    for (const subscription of [...this.#subscriptions]) {
      await subscription.unsubscribe();
    }
    await this.#channel?.close().catch(() => undefined);
    await this.#connection?.close().catch(() => undefined);
  }

  #requireChannel() {
    if (!this.#channel) {
      throw new Error("RabbitMQ broker is not connected");
    }
    return this.#channel;
  }
}

export async function createBrokerFromEnv(env = process.env) {
  if (!env.AMQP_URL) {
    return new InMemoryBroker();
  }
  const broker = new RabbitMqBroker(env.AMQP_URL);
  await broker.connect();
  return broker;
}

export function routeToRoutingKey(route) {
  return Buffer.from(route, "utf8").toString("base64url");
}
