import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from './config/configuration';
import { envValidationSchema } from './config/env.validation';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RoomTypesModule } from './room-types/room-types.module';
import { FacilitiesModule } from './facilities/facilities.module';
import { UploadsModule } from './uploads/uploads.module';
import { RoomsModule } from './rooms/rooms.module';
import { AvailabilityModule } from './availability/availability.module';
import { OffersModule } from './offers/offers.module';
import { BookingsModule } from './bookings/bookings.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false },
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        url: config.get<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: true, // Auto-syncs schema to recreate the missing columns
      }),
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get<number>('throttle.ttl', 60) * 1000,
            limit: config.get<number>('throttle.limit', 20),
          },
        ],
      }),
    }),
    AuthModule,
    UsersModule,
    RoomTypesModule,
    FacilitiesModule,
    UploadsModule,
    AvailabilityModule,
    RoomsModule,
    OffersModule,
    BookingsModule,
    DashboardModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
  ],
})
export class AppModule {}
