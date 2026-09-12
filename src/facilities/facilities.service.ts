import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Facility } from './entities/facility.entity';
import { CreateFacilityDto } from './dto/create-facility.dto';
import { UpdateFacilityDto } from './dto/update-facility.dto';
import { FacilityNotFoundException } from '../common/exceptions/domain-exceptions';

@Injectable()
export class FacilitiesService {
  constructor(
    @InjectRepository(Facility)
    private readonly facilityRepository: Repository<Facility>,
  ) {}

  findAll() {
    return this.facilityRepository.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string) {
    const facility = await this.facilityRepository.findOne({ where: { id } });
    if (!facility) throw new FacilityNotFoundException();
    return facility;
  }

  async create(dto: CreateFacilityDto) {
    const facility = this.facilityRepository.create(dto);
    return this.facilityRepository.save(facility);
  }

  async update(id: string, dto: UpdateFacilityDto) {
    const facility = await this.findOne(id);
    Object.assign(facility, dto);
    return this.facilityRepository.save(facility);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.facilityRepository.delete(id);
  }
}
