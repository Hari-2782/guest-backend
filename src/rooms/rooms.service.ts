import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In, FindOptionsWhere, Between } from 'typeorm';
import { UploadsService } from '../uploads/uploads.service';
import { Room, RoomStatus } from './entities/room.entity';
import { RoomType } from '../room-types/entities/room-type.entity';
import { RoomImage } from './entities/room-image.entity';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { QueryRoomsDto } from './dto/query-rooms.dto';
import { ReorderImagesDto } from './dto/reorder-images.dto';
import { mapRoomToResponse, roomIncludeArgs, RoomResponse } from './mappers/room.mapper';
import {
  RoomImageNotFoundException,
  RoomNotFoundException,
  RoomNumberExistsException,
  RoomTypeNotFoundException,
} from '../common/exceptions/domain-exceptions';
import { normalizePagination, buildPaginatedResult } from '../common/utils/pagination.util';
import { PaginatedResult } from '../common/dto/paginated-result';

@Injectable()
export class RoomsService {
  constructor(
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
    @InjectRepository(RoomType)
    private readonly roomTypeRepository: Repository<RoomType>,
    @InjectRepository(RoomImage)
    private readonly roomImageRepository: Repository<RoomImage>,
    private readonly uploadsService: UploadsService,
  ) {}

  async findAll(query: QueryRoomsDto): Promise<PaginatedResult<RoomResponse>> {
    const { page, limit, skip, take } = normalizePagination(query.page, query.limit);

    const baseWhere: any = {};
    if (query.roomTypeId) baseWhere.roomTypeId = query.roomTypeId;
    if (query.status) baseWhere.status = query.status;
    
    // Complex where handling (TypeORM query builder would be better for complex ones, but we use findAndCount)
    const qb = this.roomRepository.createQueryBuilder('room')
      .leftJoinAndSelect('room.roomType', 'roomType')
      .leftJoinAndSelect('room.images', 'images')
      .leftJoinAndSelect('room.facilities', 'facilities');

    if (query.roomTypeId) {
      qb.andWhere('room.roomTypeId = :roomTypeId', { roomTypeId: query.roomTypeId });
    }
    if (query.status) {
      qb.andWhere('room.status = :status', { status: query.status });
    }
    if (query.guests) {
      qb.andWhere('room.maximumGuests >= :guests', { guests: query.guests });
    }
    if (query.minimumPrice) {
      qb.andWhere('room.pricePerNight >= :minPrice', { minPrice: query.minimumPrice });
    }
    if (query.maximumPrice) {
      qb.andWhere('room.pricePerNight <= :maxPrice', { maxPrice: query.maximumPrice });
    }
    if (query.search) {
      qb.andWhere('(room.name LIKE :search OR room.roomNumber LIKE :search OR room.description LIKE :search)', { search: `%${query.search}%` });
    }

    if (query.sortBy) {
      qb.orderBy(`room.${query.sortBy}`, query.sortOrder === 'asc' ? 'ASC' : 'DESC');
    } else {
      qb.orderBy('room.createdAt', 'DESC');
    }

    const [rooms, total] = await qb
      .skip(skip)
      .take(take)
      .getManyAndCount();

    // Ensure images are sorted
    rooms.forEach(r => {
      if ((r as any).images) {
        (r as any).images.sort((a: any, b: any) => a.sortOrder - b.sortOrder);
      }
    });

    return buildPaginatedResult(rooms.map(mapRoomToResponse), page, limit, total);
  }

  async findOne(id: string): Promise<RoomResponse> {
    const room = await this.roomRepository.findOne({
      where: { id },
      relations: { roomType: true, images: true, facilities: true } as any,
    });
    if (!room) throw new RoomNotFoundException();
    if ((room as any).images) {
      (room as any).images.sort((a: any, b: any) => a.sortOrder - b.sortOrder);
    }
    return mapRoomToResponse(room);
  }

  async create(dto: CreateRoomDto): Promise<RoomResponse> {
    const roomType = await this.roomTypeRepository.findOne({ where: { id: dto.roomTypeId } });
    if (!roomType) throw new RoomTypeNotFoundException();

    const existingRoomNumber = await this.roomRepository.findOne({
      where: { roomNumber: dto.roomNumber },
    });
    if (existingRoomNumber) throw new RoomNumberExistsException();

    const { facilityIds, ...roomData } = dto;

    // TODO: Create room with facilities
    const room = this.roomRepository.create({
      ...roomData,
      // For many-to-many, TypeORM expects an array of facility objects with IDs
      facilities: facilityIds?.length
        ? facilityIds.map((id) => ({ id }))
        : [],
    } as any);

    const savedRoom = (await this.roomRepository.save(room as any)) as unknown as Room;
    return this.findOne(savedRoom.id);
  }

  async update(id: string, dto: UpdateRoomDto): Promise<RoomResponse> {
    const existingRoom = await this.ensureRoomExists(id);

    if (dto.roomTypeId) {
      const roomType = await this.roomTypeRepository.findOne({ where: { id: dto.roomTypeId } });
      if (!roomType) throw new RoomTypeNotFoundException();
    }

    if (dto.roomNumber) {
      const existing = await this.roomRepository.findOne({ where: { roomNumber: dto.roomNumber } });
      if (existing && existing.id !== id) throw new RoomNumberExistsException();
    }

    const { facilityIds, ...roomData } = dto;

    Object.assign(existingRoom, roomData);
    
    if (facilityIds !== undefined) {
      (existingRoom as any).facilities = facilityIds.map(id => ({ id }));
    }

    await this.roomRepository.save(existingRoom);
    return this.findOne(id);
  }

  /**
   * Rooms are never hard-deleted so historical bookings remain valid and
   * queryable. "Delete" deactivates the room and marks it INACTIVE.
   */
  async remove(id: string): Promise<void> {
    const room = await this.ensureRoomExists(id);
    room.isActive = false;
    room.status = RoomStatus.INACTIVE;
    await this.roomRepository.save(room);
  }

  async addImages(roomId: string, files: Express.Multer.File[]): Promise<RoomResponse> {
    const room = await this.ensureRoomExists(roomId);
    const uploaded = await this.uploadsService.uploadImages(files, `guest-house/rooms/${roomId}`);

    const existingImageCount = await this.roomImageRepository.count({ where: { roomId } });
    const hasPrimaryAlready = await this.roomImageRepository.count({
      where: { roomId, isPrimary: true },
    });

    const newImages = uploaded.map((img, index) => {
      return this.roomImageRepository.create({
        roomId,
        imageUrl: img.url,
        publicId: img.publicId,
        isPrimary: hasPrimaryAlready === 0 && index === 0,
        sortOrder: existingImageCount + index,
      });
    });

    await this.roomImageRepository.save(newImages);
    return this.findOne(room.id);
  }

  async addImagesByUrl(roomId: string, urls: string[]): Promise<RoomResponse> {
    const room = await this.ensureRoomExists(roomId);

    const existingImageCount = await this.roomImageRepository.count({ where: { roomId } });
    const hasPrimaryAlready = await this.roomImageRepository.count({
      where: { roomId, isPrimary: true },
    });

    const newImages = urls.map((url, index) => {
      return this.roomImageRepository.create({
        roomId,
        imageUrl: url,
        publicId: null as any,
        isPrimary: hasPrimaryAlready === 0 && index === 0,
        sortOrder: existingImageCount + index,
      });
    });

    await this.roomImageRepository.save(newImages);
    return this.findOne(room.id);
  }

  async removeImage(roomId: string, imageId: string): Promise<RoomResponse> {
    await this.ensureRoomExists(roomId);
    const image = await this.roomImageRepository.findOne({ where: { id: imageId, roomId } });
    if (!image) throw new RoomImageNotFoundException();

    await this.roomImageRepository.delete(imageId);
    if (image.publicId) await this.uploadsService.deleteImage(image.publicId);

    if (image.isPrimary) {
      const nextImage = await this.roomImageRepository.findOne({
        where: { roomId },
        order: { sortOrder: 'ASC' },
      });
      if (nextImage) {
        nextImage.isPrimary = true;
        await this.roomImageRepository.save(nextImage);
      }
    }

    return this.findOne(roomId);
  }

  async setPrimaryImage(roomId: string, imageId: string): Promise<RoomResponse> {
    await this.ensureRoomExists(roomId);
    const image = await this.roomImageRepository.findOne({ where: { id: imageId, roomId } });
    if (!image) throw new RoomImageNotFoundException();

    // Reset all to false
    await this.roomImageRepository.update({ roomId }, { isPrimary: false });
    // Set one to true
    await this.roomImageRepository.update(imageId, { isPrimary: true });

    return this.findOne(roomId);
  }

  async reorderImages(roomId: string, dto: ReorderImagesDto): Promise<RoomResponse> {
    await this.ensureRoomExists(roomId);

    // Simplistic approach for reorder
    for (const item of dto.items) {
      await this.roomImageRepository.update(
        { id: item.imageId, roomId },
        { sortOrder: item.sortOrder }
      );
    }

    return this.findOne(roomId);
  }

  private async ensureRoomExists(id: string) {
    const room = await this.roomRepository.findOne({ where: { id } });
    if (!room) throw new RoomNotFoundException();
    return room;
  }
}
