import { type Job, Queue, Worker } from "bullmq";
import ChannelManager from "../../guilds/channels/ChannelManager.js";
import { logger } from "../../logging/WinstonLogger.js";
import { REDIS_CONFIG } from "../data/config.js";
import type { ChannelCreationPayload } from "../data/schemas.js";
import { channelCreationEventSchema } from "../data/schemas.js";
interface ChannelCreationJobData {
  channel: ChannelCreationPayload["channel"];
  guild: ChannelCreationPayload["guild"];
  metadata: ChannelCreationPayload["metadata"];
  jobId?: string;
}

interface ChannelCreationResult {
  success: boolean;
  guildId: string;
  channelId: string;
  error?: string;
}

export class ChannelCreationQueue {
  public queue: Queue<ChannelCreationJobData, ChannelCreationResult>;
  private worker: Worker<ChannelCreationJobData, ChannelCreationResult>;
  private static readonly MAX_ATTEMPTS = 3;
  private static readonly BACKOFF_DELAY = 1000; // 1 second initial delay

  constructor() {
    const connection = REDIS_CONFIG;

    // Initialize queue with proper naming as per documentation
    this.queue = new Queue<ChannelCreationJobData, ChannelCreationResult>(
      "channel-creation",
      {
        connection,
        defaultJobOptions: {
          attempts: ChannelCreationQueue.MAX_ATTEMPTS,
          backoff: {
            type: "exponential",
            delay: ChannelCreationQueue.BACKOFF_DELAY,
          },
          // Add job cleanup configuration
          removeOnComplete: {
            age: 24 * 3600, // Keep completed jobs for 24 hours
            count: 1000, // Keep last 1000 completed jobs
          },
          removeOnFail: {
            age: 7 * 24 * 3600, // Keep failed jobs for 7 days
            count: 5000, // Keep last 5000 failed jobs
          },
        },
      },
    );

    // Initialize worker with proper concurrency
    this.worker = new Worker<ChannelCreationJobData, ChannelCreationResult>(
      "channel-creation",
      async (job) => this.processJob(job),
      { connection, concurrency: 15 },
    );

    this.setupWorkerEvents();

    logger.info({
      message: "Channel creation BullMQ initialized",
      source: "ChannelCreationBullMQ:constructor",
    });
  }

  private setupWorkerEvents(): void {
    this.worker.on(
      "completed",
      async (job: Job<ChannelCreationJobData, ChannelCreationResult>) => {
        const result = await job.returnvalue;
        if (result.success) {
          // Aggregate logging as per documentation
          logger.info({
            message: "Channel creation successful",
            source: "ChannelCreationQueue:worker",
            data: {
              channelId: job.data.channel.id,
              guildId: job.data.guild.guildId,
              jobId: job.data.jobId,
            },
          });
        }
      },
    );
    this.worker.on(
      "failed",
      (job: Job<ChannelCreationJobData> | undefined, error: Error) => {
        // Handle case where job might be undefined
        if (!job) {
          logger.error({
            message: "Channel creation failed - job undefined",
            source: "ChannelCreationQueue:worker",
            data: {
              error: error.message,
            },
          });
          return;
        }
        // Aggregate error logging as per documentation
        logger.error({
          message: "Channel creation failed",
          source: "ChannelCreationQueue:worker",
          data: {
            error: error.message,
            attempts: job.attemptsMade,
            channelId: job.data.channel.id,
            guildId: job.data.guild.guildId,
            jobId: job.data.jobId,
          },
        });
      },
    );
  }

  private async processJob(
    job: Job<ChannelCreationJobData>,
  ): Promise<ChannelCreationResult> {
    // Validate job data with Zod
    const { success, error } = channelCreationEventSchema.safeParse(job.data);
    if (!success) {
      logger.error({
        message: "Invalid job data received",
        source: "ChannelCreationQueue:processJob",
        data: {
          jobId: job.id,
          validationError: error.message,
          channelId: job.data.channel?.id,
          guildId: job.data.guild?.guildId,
        },
      });
      // Don't try to remove the job - let it fail naturally
      throw new Error(`Invalid job data: ${error.message}`);
    }

    const { channel, guild } = job.data;

    try {
      const channelManager = new ChannelManager();
      await channelManager.processChannels({
        channels: [channel],
        guilds: [guild],
      });
      return {
        success: true,
        guildId: guild.guildId,
        channelId: channel.id,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Check if this is the last attempt
      if (job.attemptsMade >= ChannelCreationQueue.MAX_ATTEMPTS) {
        logger.error({
          message: `Channel creation complete failure - Max attempts reached | Guild: ${guild.guildId} | Channel: ${channel.id}`,
          source: "ChannelCreationQueue:processJob",
          data: {
            error: errorMessage,
            attemptsMade: job.attemptsMade,
            maxAttempts: ChannelCreationQueue.MAX_ATTEMPTS,
          },
        });
      }

      // Re-throw the error to let BullMQ handle retry logic
      throw new Error(errorMessage);
    }
  }

  public async close(): Promise<void> {
    await this.queue.close();
    await this.worker.close();
  }
}

// Export singleton instance
export const channelCreationQueue = new ChannelCreationQueue();
