import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';
import * as mysql from 'mysql2/promise';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Public()
  @Get('db')
  async checkDb() {
    try {
      const dbUrl = process.env.DATABASE_URL;
      if (!dbUrl) return { error: 'No DATABASE_URL found' };
      const conn = await mysql.createConnection(dbUrl);
      const [tables] = await conn.query('SHOW TABLES');
      if (!tables || (tables as any[]).length === 0) return { result: 'No tables found' };
      
      const tableKey = Object.keys((tables as any[])[0])[0];
      const result: Record<string, string[]> = {};
      for (const tableRow of tables as any[]) {
        const tableName = tableRow[tableKey];
        const [columns] = await conn.query(`SHOW COLUMNS FROM \`${tableName}\``);
        result[tableName] = (columns as any[]).map(c => c.Field);
      }
      await conn.end();
      return result;
    } catch (e: any) {
      return { error: e.message };
    }
  }
}
