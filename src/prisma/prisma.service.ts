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
      await this.$connect();
      this.logger.log('Connected to MySQL database via Prisma');
    } catch (error) {
      this.logger.error('Failed to connect to database on startup:', error);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
