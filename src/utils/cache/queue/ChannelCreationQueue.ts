import { type Job, Queue, Worker, QueueEvents } from "bullmq";
import ChannelManager from "../../guilds/channels/ChannelManager.js";
import { logger } from "../../logging/WinstonLogger.js";
import { REDIS_CONFIG } from "../data/config.js";
import type { ChannelCreationEvent } from "@pluto-khronos/types";
import { channelCreationEventSchema } from "@pluto-khronos/types";

interface ChannelCreationResult {
  success: boolean;
  guildId: string;
  channelId: string;
  error?: string;
}

export class ChannelCreationQueue {
  public queue: Queue<ChannelCreationEvent, ChannelCreationResult>;
  private worker: Worker<ChannelCreationEvent, ChannelCreationResult>;
  private queueEvents: QueueEvents;
  private static readonly MAX_ATTEMPTS = 3;
  private static readonly BACKOFF_DELAY = 1000;
  // lock duration must exceed expected processing time
  private static readonly LOCK_DURATION = 5 * 60 * 1000; // 5 minutes

  constructor() {
    const connection = REDIS_CONFIG;

    // centralize defaults here
    this.queue = new Queue<ChannelCreationEvent, ChannelCreationResult>(
      "channel-creation",
      {
        connection,
        defaultJobOptions: {
          attempts: ChannelCreationQueue.MAX_ATTEMPTS,
          backoff: { type: "exponential", delay: ChannelCreationQueue.BACKOFF_DELAY },
          removeOnComplete: { age: 24 * 3600, count: 1000 },
          removeOnFail: { age: 7 * 24 * 3600, count: 5000 },
        },
      },
    );


    // QueueEvents for lifecycle visibility
    this.queueEvents = new QueueEvents("channel-creation", { connection });

    // Worker with explicit lockDuration
    this.worker = new Worker<ChannelCreationEvent, ChannelCreationResult>(
      "channel-creation",
      async (job) => this.processJob(job),
      {
        connection,
        concurrency: 15,
        lockDuration: ChannelCreationQueue.LOCK_DURATION,
      },
    );

    this.setupWorkerEvents();
    this.setupQueueEvents();

    logger.info({ message: "Channel creation BullMQ initialized", source: "ChannelCreationBullMQ:constructor" });
  }

  private setupWorkerEvents(): void {
    this.worker.on("active", (job) => {
      logger.info({
        message: "Job active",
        source: "ChannelCreationQueue:worker",
        data: { jobId: job.id, jobName: job.name, channelId: job.data?.channel?.id, guildId: job.data?.guild?.guildId, attemptsMade: job.attemptsMade },
      });
    });

    this.worker.on("completed", async (job: Job<ChannelCreationEvent, ChannelCreationResult>) => {
      const result = job.returnvalue;
      logger.info({
        message: "Job completed",
        source: "ChannelCreationQueue:worker",
        data: { jobId: job.id, jobName: job.name, result, channelId: job.data.channel.id, guildId: job.data.guild.guildId },
      });
    });

    this.worker.on("failed", (job: Job<ChannelCreationEvent> | undefined, err: Error) => {
      if (!job) {
        logger.error({ message: "Channel creation failed - job undefined", source: "ChannelCreationQueue:worker", data: { error: err?.message } });
        return;
      }
      logger.error({
        message: "Job failed",
        source: "ChannelCreationQueue:worker",
        data: { jobId: job.id, jobName: job.name, error: err?.message, attemptsMade: job.attemptsMade, channelId: job.data?.channel?.id, guildId: job.data?.guild?.guildId },
      });
    });

    this.worker.on("error", (err) => {
      logger.error({ message: "Worker error", source: "ChannelCreationQueue:worker", data: { error: err?.message, stack: err?.stack } });
    });
  }

  private setupQueueEvents(): void {
    this.queueEvents.on("stalled", ({ jobId }) => {
      logger.warn({ message: "Job stalled", source: "ChannelCreationQueue:queueEvents", data: { jobId } });
    });
    this.queueEvents.on("waiting", ({ jobId }) => {
      logger.debug({ message: "Job waiting", source: "ChannelCreationQueue:queueEvents", data: { jobId } });
    });
    this.queueEvents.on("delayed", ({ jobId, delay }) => {
      logger.debug({ message: "Job delayed", source: "ChannelCreationQueue:queueEvents", data: { jobId, delay } });
    });
    this.queueEvents.on("failed", ({ jobId, failedReason }) => {
      logger.warn({ message: "Job failed (queueEvents)", source: "ChannelCreationQueue:queueEvents", data: { jobId, failedReason } });
    });
    this.queueEvents.on("completed", ({ jobId }) => {
      logger.debug({ message: "Job completed (queueEvents)", source: "ChannelCreationQueue:queueEvents", data: { jobId } });
    });
  }

  private async processJob(job: Job<ChannelCreationEvent>): Promise<ChannelCreationResult> {
    const validation = channelCreationEventSchema.safeParse(job.data);
    if (!validation.success) {
      logger.error({
        message: "Invalid job data received",
        source: "ChannelCreationQueue:processJob",
        data: { jobId: job.id, validationError: validation.error.message },
      });
      throw new Error(`Invalid job data: ${validation.error.message}`);
    }

    const { channel, guild } = validation.data;

    try {
      const channelManager = new ChannelManager();

      // Idempotency check inside ChannelManager.processChannels
      await channelManager.processChannels({ channels: [channel], guilds: [guild] });

      return { success: true, guildId: guild.guildId, channelId: channel.id };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      // Log final attempt explicitly
      if (job.attemptsMade >= ChannelCreationQueue.MAX_ATTEMPTS) {
        logger.error({
          message: "Max attempts reached for channel creation",
          source: "ChannelCreationQueue:processJob",
          data: { jobId: job.id, attemptsMade: job.attemptsMade, maxAttempts: ChannelCreationQueue.MAX_ATTEMPTS, error: errorMessage },
        });
      }

      // rethrow to let BullMQ handle retry/backoff
      throw new Error(errorMessage);
    }
  }

  public async close(): Promise<void> {
    await this.worker.close();
    await this.queueEvents.close();
    await this.queue.close();
  }
}

export const channelCreationQueue = new ChannelCreationQueue();
