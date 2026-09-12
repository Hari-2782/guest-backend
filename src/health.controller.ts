import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

@Controller('health')
export class HealthController {
  constructor(@InjectEntityManager() private readonly manager: EntityManager) {}

  @Public()
  @Get()
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Public()
  @Get('db')
  async checkDb() {
    try {
      const tables = await this.manager.query('SHOW TABLES');
      if (!tables || tables.length === 0) return { result: 'No tables found' };
      const tableKey = Object.keys(tables[0])[0];
      const result: Record<string, string[]> = {};
      for (const tableRow of tables) {
        const tableName = tableRow[tableKey];
        const columns = await this.manager.query(`SHOW COLUMNS FROM \`${tableName}\``);
        result[tableName] = columns.map((c: any) => c.Field);
      }
      return result;
    } catch (e: any) {
      return { error: e.message };
    }
  }
}
