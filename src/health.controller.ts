import { Controller, Get, Inject } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';
import { getEntityManagerToken } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Public()
  @Get('db')
  async checkDb(@Inject(getEntityManagerToken()) manager: EntityManager) {
    try {
      const tables = await manager.query('SHOW TABLES');
      const tableKey = Object.keys(tables[0])[0];
      const result = {};
      for (const tableRow of tables) {
        const tableName = tableRow[tableKey];
        const columns = await manager.query(`SHOW COLUMNS FROM \`${tableName}\``);
        result[tableName] = columns.map(c => c.Field);
      }
      return result;
    } catch (e) {
      return { error: e.message };
    }
  }
}
