const demoButtons = Array.from(document.querySelectorAll("[data-demo-message]"));
const demoViews = Array.from(document.querySelectorAll("[data-demo-view]"));

for (const button of demoButtons) {
  button.addEventListener("click", () => {
    const selected = button.getAttribute("data-demo-message");
    for (const item of demoButtons) {
      item.classList.toggle("active", item === button);
    }
    for (const view of demoViews) {
      const active = view.getAttribute("data-demo-view") === selected;
      view.classList.toggle("active", active);
      view.hidden = !active;
    }
    if (selected === "game") {
      game.ensureReady();
    }
  });
}

document.querySelector("[data-demo-action='payment']")?.addEventListener("click", () => {
  setPaymentResult("HostActionBroker accepted payment request. Awaiting host confirmation.");
});

document.querySelector("[data-demo-action='qr']")?.addEventListener("click", () => {
  setPaymentResult("QR fallback verified: merchant domain matches billing.acme.tld.");
});

document.querySelector("[data-demo-action='start-game']")?.addEventListener("click", () => {
  game.start();
});

document.querySelector("[data-demo-action='claim-reward']")?.addEventListener("click", () => {
  const result = document.querySelector("[data-demo-view='game'] .demo-host-result");
  if (!result) return;
  result.textContent = game.score >= 5
    ? "Host action accepted: reward claim is allowed for this trusted sandbox."
    : "Collect 5 tokens before requesting the reward host action.";
});

function setPaymentResult(message) {
  const result = document.querySelector("[data-demo-view='payment'] .demo-host-result");
  if (result) {
    result.textContent = message;
  }
}

const game = createDemoGame();

function createDemoGame() {
  const canvas = document.querySelector("[data-demo-game]");
  const scoreNode = document.querySelector("[data-demo-score]");
  const context = canvas?.getContext("2d");
  let tokens = [];
  let score = 0;
  let running = false;
  let animation = 0;
  let lastTick = 0;

  function ensureReady() {
    if (!canvas || !context) return;
    if (tokens.length === 0) {
      resetTokens();
      draw(0);
    }
  }

  function start() {
    if (!canvas || !context) return;
    resetTokens();
    score = 0;
    updateScore();
    running = true;
    lastTick = performance.now();
    cancelAnimationFrame(animation);
    animation = requestAnimationFrame(tick);
    const result = document.querySelector("[data-demo-view='game'] .demo-host-result");
    if (result) {
      result.textContent = "Game running inside the message sandbox. Click the moving tokens.";
    }
  }

  function resetTokens() {
    tokens = [
      token(0.18, 0.28, 42, 1.35, "#155e75"),
      token(0.48, 0.48, 36, 1.65, "#176031"),
      token(0.78, 0.32, 46, 1.2, "#664d00"),
      token(0.35, 0.72, 32, 1.85, "#155e75"),
      token(0.68, 0.72, 38, 1.5, "#176031")
    ];
  }

  function token(x, y, radius, speed, color) {
    return {
      x,
      y,
      radius,
      speed,
      color,
      phase: Math.random() * Math.PI * 2,
      active: true
    };
  }

  function tick(now) {
    const delta = Math.min(32, now - lastTick);
    lastTick = now;
    draw(delta);
    if (running) {
      animation = requestAnimationFrame(tick);
    }
  }

  function draw(delta) {
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, "#eef3f0");
    gradient.addColorStop(1, "#dff4e6");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.fillStyle = "rgba(23, 33, 29, 0.08)";
    for (let i = 0; i < 9; i += 1) {
      context.fillRect(i * 64 - 20, 0, 1, canvas.height);
    }

    for (const item of tokens) {
      if (!item.active) continue;
      item.phase += (delta / 1000) * item.speed;
      const x = item.x * canvas.width + Math.cos(item.phase) * 18;
      const y = item.y * canvas.height + Math.sin(item.phase * 1.4) * 14;
      context.beginPath();
      context.arc(x, y, item.radius, 0, Math.PI * 2);
      context.fillStyle = item.color;
      context.fill();
      context.lineWidth = 4;
      context.strokeStyle = "rgba(255, 255, 255, 0.75)";
      context.stroke();
      context.fillStyle = "#ffffff";
      context.font = "900 18px system-ui, sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText("+1", x, y);
      item.currentX = x;
      item.currentY = y;
    }

    if (tokens.every((item) => !item.active)) {
      running = false;
      context.fillStyle = "rgba(255, 255, 255, 0.88)";
      context.fillRect(0, canvas.height / 2 - 34, canvas.width, 68);
      context.fillStyle = "#17211d";
      context.font = "900 24px system-ui, sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText("Reward unlocked", canvas.width / 2, canvas.height / 2);
    }
  }

  canvas?.addEventListener("pointerdown", (event) => {
    if (!canvas) return;
    ensureReady();
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
    for (const item of tokens) {
      if (!item.active) continue;
      const dx = x - item.currentX;
      const dy = y - item.currentY;
      if (Math.hypot(dx, dy) <= item.radius + 8) {
        item.active = false;
        score += 1;
        updateScore();
        draw(16);
        break;
      }
    }
  });

  function updateScore() {
    if (scoreNode) {
      scoreNode.textContent = String(score);
    }
  }

  ensureReady();

  return {
    ensureReady,
    start,
    get score() {
      return score;
    }
  };
}
