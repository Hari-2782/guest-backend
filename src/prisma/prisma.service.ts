import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Single shared Prisma client used across the entire application.
 * Handles connection lifecycle alongside the Nest application lifecycle.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
  }

  async onModuleInit() {
    try {
      // Connect to local MySQL immediately; 2-second timeout guarantees Hostinger 3s watchdog safety
      await Promise.race([
        this.$connect(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Prisma connection timeout after 2000ms')), 2000),
        ),
      ]);
      this.logger.log('Connected to MySQL database via Prisma');
    } catch (error) {
      this.logger.error('Database connection warning during onModuleInit:', error.message || error);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
