import { spawn } from "node:child_process";
import { once } from "node:events";
import { connect } from "amqplib";

const amqpUrl = process.env.AMQP_URL ?? "amqp://guest:guest@127.0.0.1:5672";
const requireRabbitMq = process.env.REQUIRE_RABBITMQ === "1";
const port = Number(process.env.RABBITMQ_GATEWAY_TEST_PORT ?? 8791);
const route = "/rt/invoices/demo-user";
const gatewayUrl = `http://127.0.0.1:${port}`;

if (!await canConnectToRabbitMq(amqpUrl)) {
  const message = `SKIP RabbitMQ gateway integration: cannot connect to ${amqpUrl}`;
  if (requireRabbitMq) {
    console.error(message);
    process.exit(1);
  }
  console.log(message);
  process.exit(0);
}

const server = spawn(process.execPath, ["reference/gateway/src/server.mjs"], {
  cwd: new URL("..", import.meta.url),
  env: {
    ...process.env,
    AMQP_URL: amqpUrl,
    PORT: String(port)
  },
  stdio: ["ignore", "pipe", "pipe"]
});

let output = "";
server.stdout.on("data", (chunk) => {
  output += chunk.toString("utf8");
});
server.stderr.on("data", (chunk) => {
  output += chunk.toString("utf8");
});

try {
  await waitForHealth();
  const rejectedOrigin = await fetch(`${gatewayUrl}/health`, {
    headers: { Origin: "https://evil.example" }
  });
  assert(rejectedOrigin.status === 403, `cross-origin health request was not rejected: ${rejectedOrigin.status}`);
  assert(!rejectedOrigin.headers.has("access-control-allow-origin"), "rejected origin received CORS allow header");

  const allowedOrigin = await fetch(`${gatewayUrl}/health`, {
    headers: { Origin: "http://127.0.0.1:5190" }
  });
  assert(allowedOrigin.ok, `local app origin was rejected: ${allowedOrigin.status}`);
  assert(allowedOrigin.headers.get("access-control-allow-origin") === "http://127.0.0.1:5190", "local origin was not echoed in CORS header");

  const abort = new AbortController();
  const events = await fetch(`${gatewayUrl}/events?route=${encodeURIComponent(route)}`, {
    signal: abort.signal
  });
  assert(events.ok, `SSE subscription failed: ${events.status}`);

  const reader = events.body?.getReader();
  assert(reader, "SSE response body is missing");
  await waitForSse(reader, "ready");

  const endpoints = [
    ["/publish-demo", "Reference gateway signed event"],
    ["/publish-game-demo", "Invoice Runner mini game"],
    ["/publish-payment-demo", "Secure in-client payment request"]
  ];
  for (const [path, subject] of endpoints) {
    const publish = await fetch(`${gatewayUrl}${path}?route=${encodeURIComponent(route)}`, {
      method: "POST"
    });
    assert(publish.ok, `${path} failed: ${publish.status}`);
    const event = await waitForSse(reader, "message");
    assert(event.data.signature?.startsWith("rmail1."), `${path} message is not signed`);
    assert(event.data.route === undefined, `${path} leaked route into message payload`);
    assert(event.data.domain === "billing.acme.tld", `${path} domain mismatch`);
    assert(event.data.subject === subject, `${path} subject mismatch`);
  }
  abort.abort();

  const health = await (await fetch(`${gatewayUrl}/health`)).json();
  assert(health.broker === "rabbitmq", "gateway did not use RabbitMQ broker");
  console.log("PASS RabbitMQ reference gateway integration");
} finally {
  if (server.exitCode === null) {
    server.kill("SIGTERM");
    setTimeout(() => {
      if (server.exitCode === null) {
        server.kill("SIGKILL");
      }
    }, 500).unref();
  }
  await once(server, "exit").catch(() => undefined);
}

async function canConnectToRabbitMq(url) {
  try {
    const connection = await connect(url, { timeout: 2000 });
    await connection.close();
    return true;
  } catch {
    return false;
  }
}

async function waitForHealth() {
  const deadline = Date.now() + 5000;
  let lastError = "";
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Gateway exited early.\n${output}`);
    }
    try {
      const health = await fetch(`${gatewayUrl}/health`);
      if (health.ok) {
        return;
      }
      lastError = `HTTP ${health.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Gateway did not become healthy: ${lastError}\n${output}`);
}

async function waitForSse(reader, eventName) {
  const decoder = new TextDecoder();
  const deadline = Date.now() + 5000;
  let buffer = "";
  while (Date.now() < deadline) {
    const remaining = deadline - Date.now();
    const read = await Promise.race([
      reader.read(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("SSE read timeout")), remaining))
    ]);
    if (read.done) {
      break;
    }
    buffer += decoder.decode(read.value, { stream: true }).replaceAll("\r\n", "\n");
    for (;;) {
      const separator = buffer.indexOf("\n\n");
      if (separator === -1) break;
      const raw = buffer.slice(0, separator);
      buffer = buffer.slice(separator + 2);
      const event = parseSseEvent(raw);
      if (event.event === eventName) {
        return event;
      }
    }
  }
  throw new Error(`Timed out waiting for SSE event ${eventName}`);
}

function parseSseEvent(raw) {
  const lines = raw.split("\n");
  const event = lines.find((line) => line.startsWith("event: "))?.slice("event: ".length) ?? "message";
  const data = lines
    .filter((line) => line.startsWith("data: "))
    .map((line) => line.slice("data: ".length))
    .join("\n");
  return {
    event,
    data: data ? JSON.parse(data) : undefined
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
