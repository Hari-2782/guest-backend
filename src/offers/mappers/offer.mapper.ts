import { Offer } from '../entities/offer.entity';
import { DayOfWeek } from '../../common/enums/day-of-week.enum';

export interface OfferResponse {
  id: string;
  title: string;
  description: string | null;
  discountType: string;
  discountValue: number;
  startDate: Date;
  endDate: Date;
  daysOfWeek: DayOfWeek[];
  minimumNights: number;
  roomTypeId: string | null;
  roomId: string | null;
  isActive: boolean;
  bannerImage: string | null;
  iconName?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function mapOfferToResponse(offer: Offer): OfferResponse {
  return {
    id: offer.id,
    title: offer.title,
    description: offer.description,
    discountType: offer.discountType as string,
    discountValue: Number(offer.discountValue),
    startDate: offer.startDate,
    endDate: offer.endDate,
    daysOfWeek: offer.daysOfWeek ? (offer.daysOfWeek.split(',').filter(Boolean) as DayOfWeek[]) : [],
    minimumNights: offer.minimumNights,
    roomTypeId: offer.roomTypeId,
    roomId: offer.roomId,
    isActive: offer.isActive,
    bannerImage: offer.bannerImage,
    iconName: offer.iconName ?? null,
    createdAt: offer.createdAt,
    updatedAt: offer.updatedAt,
  };
}
