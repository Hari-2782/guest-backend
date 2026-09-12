import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual, Like } from 'typeorm';
import { Offer, DiscountType } from './entities/offer.entity';
import { CreateOfferDto } from './dto/create-offer.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';
import { QueryOffersDto } from './dto/query-offers.dto';
import { mapOfferToResponse, OfferResponse } from './mappers/offer.mapper';
import { OfferNotFoundException } from '../common/exceptions/domain-exceptions';
import { normalizePagination, buildPaginatedResult } from '../common/utils/pagination.util';
import { PaginatedResult } from '../common/dto/paginated-result';
import { roundCurrency, toNumber } from '../common/utils/decimal.util';
import { toUtcDateOnly, dayOfWeekOf } from '../common/utils/date.util';

export interface AppliedOffer {
  offerId: string;
  discountAmount: number;
}

@Injectable()
export class OffersService {
  constructor(
    @InjectRepository(Offer)
    private readonly offerRepository: Repository<Offer>,
  ) {}

  /** Public listing: only currently active, currently running offers. */
  async findAllPublic(query: QueryOffersDto): Promise<PaginatedResult<OfferResponse>> {
    const { page, limit, skip, take } = normalizePagination(query.page, query.limit);
    const now = new Date();

    const [offers, total] = await this.offerRepository.findAndCount({
      where: {
        isActive: true,
        startDate: LessThanOrEqual(now),
        endDate: MoreThanOrEqual(now),
      },
      order: { createdAt: 'DESC' },
      skip,
      take,
    });

    return buildPaginatedResult(offers.map(mapOfferToResponse), page, limit, total);
  }

  /** Admin listing: every offer, with optional filters, including inactive/expired ones. */
  async findAllAdmin(query: QueryOffersDto): Promise<PaginatedResult<OfferResponse>> {
    const { page, limit, skip, take } = normalizePagination(query.page, query.limit);

    const where: any = {};
    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.roomTypeId) where.roomTypeId = query.roomTypeId;
    if (query.roomId) where.roomId = query.roomId;
    if (query.search) where.title = Like(`%${query.search}%`);

    const order = query.sortBy
      ? { [query.sortBy]: query.sortOrder === 'asc' ? 'ASC' : 'DESC' }
      : { createdAt: 'DESC' };

    const [offers, total] = await this.offerRepository.findAndCount({
      where,
      order: order as any,
      skip,
      take,
    });

    return buildPaginatedResult(offers.map(mapOfferToResponse), page, limit, total);
  }

  async findOne(id: string): Promise<OfferResponse> {
    const offer = await this.offerRepository.findOne({ where: { id } });
    if (!offer) throw new OfferNotFoundException();
    return mapOfferToResponse(offer);
  }

  private validateBusinessRules(dto: CreateOfferDto | UpdateOfferDto): void {
    if (
      dto.discountType === (DiscountType.PERCENTAGE as any) &&
      dto.discountValue !== undefined &&
      dto.discountValue > 100
    ) {
      throw new BadRequestException('Percentage discount cannot exceed 100');
    }

    if (dto.startDate && dto.endDate) {
      const start = new Date(dto.startDate);
      const end = new Date(dto.endDate);
      if (end < start) {
        throw new BadRequestException('End date must be on or after start date');
      }
    }
  }

  async create(dto: CreateOfferDto): Promise<OfferResponse> {
    this.validateBusinessRules(dto);
    const { daysOfWeek, ...rest } = dto;
    const offer = this.offerRepository.create({
      ...rest,
      discountType: dto.discountType as any,
      daysOfWeek: daysOfWeek ? daysOfWeek.join(',') : null,
      startDate: toUtcDateOnly(dto.startDate),
      endDate: toUtcDateOnly(dto.endDate),
    } as any);
    const saved = await this.offerRepository.save(offer as any);
    return mapOfferToResponse(saved as unknown as Offer);
  }

  async update(id: string, dto: UpdateOfferDto): Promise<OfferResponse> {
    const offer = await this.ensureExists(id);
    this.validateBusinessRules(dto);
    const { daysOfWeek, ...rest } = dto;
    
    Object.assign(offer, rest);
    if (dto.discountType) offer.discountType = dto.discountType as any;
    if (daysOfWeek !== undefined) {
      offer.daysOfWeek = daysOfWeek ? daysOfWeek.join(',') : null as any;
    }
    if (dto.startDate) offer.startDate = toUtcDateOnly(dto.startDate);
    if (dto.endDate) offer.endDate = toUtcDateOnly(dto.endDate);
    
    const updated = await this.offerRepository.save(offer);
    return mapOfferToResponse(updated);
  }

  async remove(id: string): Promise<void> {
    await this.ensureExists(id);
    await this.offerRepository.delete(id);
  }

  /**
   * Determines the best applicable offer for a booking.
   */
  async findBestApplicableOffer(params: {
    roomId: string;
    roomTypeId: string;
    checkInDate: Date;
    numberOfNights: number;
    subtotal: number;
  }): Promise<AppliedOffer | null> {
    const { roomId, roomTypeId, checkInDate, numberOfNights, subtotal } = params;
    const checkInDayOfWeek = dayOfWeekOf(checkInDate);

    // Using query builder for complex AND/OR logic
    const candidates = await this.offerRepository.createQueryBuilder('offer')
      .where('offer.isActive = :isActive', { isActive: true })
      .andWhere('offer.startDate <= :checkInDate', { checkInDate })
      .andWhere('offer.endDate >= :checkInDate', { checkInDate })
      .andWhere('offer.minimumNights <= :nights', { nights: numberOfNights })
      .andWhere('(offer.roomId = :roomId OR offer.roomTypeId = :roomTypeId OR (offer.roomId IS NULL AND offer.roomTypeId IS NULL))', { roomId, roomTypeId })
      .andWhere('(offer.daysOfWeek IS NULL OR offer.daysOfWeek = "" OR offer.daysOfWeek LIKE :dayOfWeek)', { dayOfWeek: `%${checkInDayOfWeek}%` })
      .getMany();

    if (candidates.length === 0) return null;

    let best: AppliedOffer | null = null;
    for (const offer of candidates) {
      const discountAmount = this.calculateDiscount(offer, subtotal);
      if (!best || discountAmount > best.discountAmount) {
        best = { offerId: offer.id, discountAmount };
      }
    }

    return best;
  }

  calculateDiscount(offer: Offer, subtotal: number): number {
    const value = Number(offer.discountValue);
    const rawDiscount =
      offer.discountType === DiscountType.PERCENTAGE ? (subtotal * value) / 100 : value;

    // Never let a discount exceed the subtotal (total cannot go negative).
    return roundCurrency(Math.min(rawDiscount, subtotal));
  }

  private async ensureExists(id: string) {
    const offer = await this.offerRepository.findOne({ where: { id } });
    if (!offer) throw new OfferNotFoundException();
    return offer;
  }
}
