import { Room } from '../entities/room.entity';

export interface RoomResponse {
  id: string;
  roomNumber: string;
  name: string;
  description: string | null;
  roomTypeId: string;
  roomType: { id: string; name: string; description: string | null } | null;
  pricePerNight: number;
  pricePerNightNonAc: number | null;
  maximumGuests: number;
  numberOfBeds: number;
  numberOfBathrooms: number;
  roomSize: number | null;
  status: string;
  isActive: boolean;
  images: { id: string; imageUrl: string; isPrimary: boolean; sortOrder: number }[];
  facilities: { id: string; name: string; icon: string | null }[];
  createdAt: Date;
  updatedAt: Date;
}

export const roomIncludeArgs = {
  roomType: true,
  images: true, // We will sort them in service or with @OrderBy in entity
  facilities: true,
};

export function mapRoomToResponse(room: Room): RoomResponse {
  return {
    id: room.id,
    roomNumber: room.roomNumber,
    name: room.name,
    description: room.description,
    roomTypeId: room.roomTypeId,
    roomType: room.roomType
      ? { id: room.roomType.id, name: room.roomType.name, description: room.roomType.description }
      : null,
    pricePerNight: Number(room.pricePerNight),
    pricePerNightNonAc: room.pricePerNightNonAc ? Number(room.pricePerNightNonAc) : null,
    maximumGuests: room.maximumGuests,
    numberOfBeds: room.numberOfBeds,
    numberOfBathrooms: room.numberOfBathrooms,
    roomSize: room.roomSize,
    status: room.status as string,
    isActive: room.isActive,
    images: (room as any).images
      ? (room as any).images.map((img: any) => ({
          id: img.id,
          imageUrl: img.imageUrl,
          isPrimary: img.isPrimary,
          sortOrder: img.sortOrder,
        }))
      : [],
    facilities: (room as any).facilities
      ? (room as any).facilities.map((f: any) => ({
          id: f.id,
          name: f.name,
          icon: f.icon,
        }))
      : [],
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
  };
}
