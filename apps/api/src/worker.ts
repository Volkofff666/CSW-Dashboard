import "dotenv/config";

import { QueueEvents, Worker } from "bullmq";
import IORedis from "ioredis";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

const worker = new Worker(
  "notifications",
  async (job) => {
    console.log(`[worker] processing job ${job.id} (${job.name})`);
  },
  { connection }
);

const queueEvents = new QueueEvents("notifications", { connection });

worker.on("ready", () => {
  console.log("[worker] ready");
});

worker.on("failed", (job, error) => {
  console.error(`[worker] failed job ${job?.id}: ${error.message}`);
});

queueEvents.on("waiting", ({ jobId }) => {
  console.log(`[worker] waiting: ${jobId}`);
});

