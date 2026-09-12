import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import { UploadsModule } from '../uploads/uploads.module';
import { AvailabilityModule } from '../availability/availability.module';
import { Room } from './entities/room.entity';
import { RoomImage } from './entities/room-image.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Room, RoomImage]), UploadsModule, AvailabilityModule],
  controllers: [RoomsController],
  providers: [RoomsService],
  exports: [RoomsService],
})
export class RoomsModule {}
