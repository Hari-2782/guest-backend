import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, FindOptionsWhere } from 'typeorm';
import { User, Role, UserStatus } from './entities/user.entity';
import { QueryUsersDto } from './dto/query-users.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UserNotFoundException } from '../common/exceptions/domain-exceptions';
import { UserProfileDto } from '../auth/dto/auth-response.dto';
import { normalizePagination, buildPaginatedResult } from '../common/utils/pagination.util';
import { PaginatedResult } from '../common/dto/paginated-result';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findAll(query: QueryUsersDto): Promise<PaginatedResult<UserProfileDto>> {
    const { page, limit, skip, take } = normalizePagination(query.page, query.limit);

    let where: FindOptionsWhere<User>[] | FindOptionsWhere<User> = {};

    const baseWhere: FindOptionsWhere<User> = {
      ...(query.role ? { role: query.role as Role } : {}),
      ...(query.status ? { status: query.status as UserStatus } : {}),
    };

    if (query.search) {
      where = [
        { ...baseWhere, firstName: Like(`%${query.search}%`) },
        { ...baseWhere, lastName: Like(`%${query.search}%`) },
        { ...baseWhere, email: Like(`%${query.search}%`) },
        { ...baseWhere, phone: Like(`%${query.search}%`) },
      ];
    } else {
      where = baseWhere;
    }

    const order = query.sortBy
      ? { [query.sortBy]: query.sortOrder === 'asc' ? 'ASC' : 'DESC' }
      : { createdAt: 'DESC' };

    const [users, total] = await this.userRepository.findAndCount({
      where,
      order: order as any,
      skip,
      take,
    });

    return buildPaginatedResult(
      users.map((u) => this.toProfile(u)),
      page,
      limit,
      total,
    );
  }

  async findOne(id: string): Promise<UserProfileDto> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new UserNotFoundException();
    return this.toProfile(user);
  }

  async updateStatus(id: string, dto: UpdateUserStatusDto): Promise<UserProfileDto> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new UserNotFoundException();

    user.status = dto.status as UserStatus;
    const updated = await this.userRepository.save(user);

    return this.toProfile(updated);
  }

  private toProfile(user: User): UserProfileDto {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      role: user.role as string as any,
      status: user.status as string as any,
      createdAt: user.createdAt,
    };
  }
}
