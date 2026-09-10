import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Single shared Prisma client used across the entire application.
 * Handles connection lifecycle alongside the Nest application lifecycle.
 *
 * Connection pool is limited to 5 connections with a 10-second timeout
 * to prevent Tokio timer panics under CloudLinux thread restrictions.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
      datasourceUrl: PrismaService.buildDatasourceUrl(),
    });
  }

  /**
   * Appends connection_limit and connect_timeout to DATABASE_URL
   * if they aren't already set, to prevent pool exhaustion panics.
   */
  private static buildDatasourceUrl(): string | undefined {
    const url = process.env.DATABASE_URL;
    if (!url) return undefined;

    const separator = url.includes('?') ? '&' : '?';
    const extras: string[] = [];

    if (!url.includes('connection_limit')) extras.push('connection_limit=5');
    if (!url.includes('connect_timeout')) extras.push('connect_timeout=10');
    if (!url.includes('pool_timeout')) extras.push('pool_timeout=10');

    return extras.length > 0 ? `${url}${separator}${extras.join('&')}` : url;
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Connected to MySQL database via Prisma');
    } catch (error) {
      this.logger.error('Database connection failed during onModuleInit:', error.message || error);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
