import "dotenv/config";

import cors from "@fastify/cors";
import Fastify from "fastify";

import { prisma } from "./lib/prisma.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerWidgetRoutes } from "./routes/widget.js";

const app = Fastify({
  logger: true
});

const parseAllowedOrigins = (): string[] => {
  const rawOrigins = process.env.WIDGET_CORS_ORIGINS ?? "";
  return rawOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
};

const allowedOrigins = parseAllowedOrigins();

await app.register(cors, {
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error("Origin is not allowed by CORS"), false);
  }
});

registerHealthRoutes(app);
registerWidgetRoutes(app);

const port = Number(process.env.API_PORT ?? 4000);
const host = "0.0.0.0";

app
  .listen({ port, host })
  .then(() => {
    app.log.info(`API listening on http://${host}:${port}`);
  })
  .catch((error) => {
    app.log.error(error);
    process.exit(1);
  });

const shutdown = async (): Promise<void> => {
  await prisma.$disconnect();
  await app.close();
};

process.on("SIGINT", () => {
  shutdown().finally(() => process.exit(0));
});

process.on("SIGTERM", () => {
  shutdown().finally(() => process.exit(0));
});
