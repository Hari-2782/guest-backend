import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoomType } from './entities/room-type.entity';
import { CreateRoomTypeDto } from './dto/create-room-type.dto';
import { UpdateRoomTypeDto } from './dto/update-room-type.dto';
import {
  RoomTypeInUseException,
  RoomTypeNotFoundException,
} from '../common/exceptions/domain-exceptions';
import { Room } from '../rooms/entities/room.entity';

@Injectable()
export class RoomTypesService {
  constructor(
    @InjectRepository(RoomType)
    private readonly roomTypeRepository: Repository<RoomType>,
  ) {}

  findAll() {
    return this.roomTypeRepository.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string) {
    const roomType = await this.roomTypeRepository.findOne({ where: { id } });
    if (!roomType) throw new RoomTypeNotFoundException();
    return roomType;
  }

  async create(dto: CreateRoomTypeDto) {
    const roomType = this.roomTypeRepository.create(dto);
    return this.roomTypeRepository.save(roomType);
  }

  async update(id: string, dto: UpdateRoomTypeDto) {
    const roomType = await this.findOne(id);
    Object.assign(roomType, dto);
    return this.roomTypeRepository.save(roomType);
  }

  async remove(id: string) {
    const roomType = await this.roomTypeRepository.findOne({ 
      where: { id },
      relations: { rooms: true } 
    });
    
    if (!roomType) throw new RoomTypeNotFoundException();

    if (roomType.rooms && roomType.rooms.length > 0) {
      throw new RoomTypeInUseException();
    }

    await this.roomTypeRepository.delete(id);
  }
}
