import type { FastifyInstance } from "fastify";
import type { HealthResponse } from "@csw/shared-types";

export const registerHealthRoutes = (app: FastifyInstance): void => {
  app.get("/health", async () => {
    const response: HealthResponse = {
      status: "ok",
      service: "@csw/api",
      timestamp: new Date().toISOString()
    };

    return response;
  });
};

