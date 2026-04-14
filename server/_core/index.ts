import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { registerUploadRoutes } from "../uploadRoutes";
import apiRoutes from "../routes/index";
import { authenticateUser } from "../middleware/auth";
import { serveStatic, setupVite } from "./vite";
import { webhookRouter } from "../webhookRoutes";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 8497): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

function getPortFromArgs(): number | null {
  const args = process.argv.slice(2);
  
  if (args.length > 0 && !isNaN(parseInt(args[0], 10)) && !args[0].startsWith('-')) {
    return parseInt(args[0], 10);
  }

  const portIndex = args.findIndex(arg => arg === '--port' || arg === '-p');
  if (portIndex !== -1 && args[portIndex + 1]) {
    const port = parseInt(args[portIndex + 1], 10);
    if (!isNaN(port)) return port;
  }
  
  const portArg = args.find(arg => arg.startsWith('--port='));
  if (portArg) {
    const port = parseInt(portArg.split('=')[1], 10);
    if (!isNaN(port)) return port;
  }
  
  return null;
}

async function startServer() {
  const app = express();

  const server = createServer(app);

  // Stripe webhooks need the raw body to verify signature — register before body parser
  app.use(webhookRouter);

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerUploadRoutes(app);

  // Authenticate all requests (populates req.user if session cookie is valid)
  app.use(authenticateUser);

  // REST API routes
  app.use(apiRoutes);
  
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const argsPort = getPortFromArgs();
  const envPort = parseInt(process.env.PORT || "8497");
  const preferredPort = argsPort || envPort;

  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
