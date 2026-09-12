import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { User, Role, UserStatus } from '../users/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { AuthResponseDto, AuthTokensDto, UserProfileDto } from './dto/auth-response.dto';
import {
  AccountBlockedException,
  AccountInactiveException,
  EmailAlreadyExistsException,
  InvalidCredentialsException,
  InvalidRefreshTokenException,
  PhoneAlreadyExistsException,
  UserNotFoundException,
} from '../common/exceptions/domain-exceptions';

const SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const existingEmail = await this.userRepository.findOne({ where: { email: dto.email } });
    if (existingEmail) throw new EmailAlreadyExistsException();

    if (dto.phone) {
      const existingPhone = await this.userRepository.findOne({ where: { phone: dto.phone } });
      if (existingPhone) throw new PhoneAlreadyExistsException();
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const user = this.userRepository.create({
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      phone: dto.phone,
      passwordHash,
      role: Role.CUSTOMER,
      status: UserStatus.ACTIVE,
    });

    const savedUser = await this.userRepository.save(user);
    const tokens = await this.issueTokens(savedUser);
    return { ...tokens, user: this.toProfile(savedUser) };
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.userRepository.findOne({ where: { email: dto.email } });
    if (!user) throw new InvalidCredentialsException();

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) throw new InvalidCredentialsException();

    if (user.status === UserStatus.BLOCKED) throw new AccountBlockedException();
    if (user.status === UserStatus.INACTIVE) throw new AccountInactiveException();

    const tokens = await this.issueTokens(user);
    return { ...tokens, user: this.toProfile(user) };
  }

  async refresh(rawRefreshToken: string): Promise<AuthTokensDto> {
    let payload: JwtPayload & { jti: string };
    try {
      payload = await this.jwtService.verifyAsync(rawRefreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new InvalidRefreshTokenException();
    }

    const stored = await this.refreshTokenRepository.findOne({ where: { id: payload.jti } });
    if (!stored || stored.revokedAt || stored.expiresAt.getTime() < Date.now()) {
      throw new InvalidRefreshTokenException();
    }

    const matches = await bcrypt.compare(rawRefreshToken, stored.tokenHash);
    if (!matches) throw new InvalidRefreshTokenException();

    const user = await this.userRepository.findOne({ where: { id: stored.userId } });
    if (!user || user.status !== UserStatus.ACTIVE) throw new InvalidRefreshTokenException();

    // Rotate: revoke the used refresh token, then issue a brand new pair.
    stored.revokedAt = new Date();
    await this.refreshTokenRepository.save(stored);

    return this.issueTokens(user);
  }

  async logout(userId: string, rawRefreshToken?: string): Promise<void> {
    if (rawRefreshToken) {
      try {
        const payload = await this.jwtService.verifyAsync<JwtPayload & { jti: string }>(
          rawRefreshToken,
          { secret: this.configService.get<string>('jwt.refreshSecret') },
        );
        
        await this.refreshTokenRepository.update(
          { id: payload.jti, userId, revokedAt: null as any },
          { revokedAt: new Date() }
        );
        return;
      } catch {
        // Fall through to revoking all tokens if the provided token is unusable.
      }
    }

    await this.refreshTokenRepository.update(
      { userId, revokedAt: null as any },
      { revokedAt: new Date() }
    );
  }

  async me(userId: string): Promise<UserProfileDto> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new UserNotFoundException();
    return this.toProfile(user);
  }

  private async issueTokens(user: User): Promise<AuthTokensDto> {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role as string as any };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('jwt.accessSecret'),
      expiresIn: this.configService.get<string>('jwt.accessExpiresIn'),
    });

    const jti = randomUUID();
    const refreshExpiresIn = this.configService.get<string>('jwt.refreshExpiresIn', '7d');
    const refreshToken = await this.jwtService.signAsync(
      { ...payload, jti },
      {
        secret: this.configService.get<string>('jwt.refreshSecret'),
        expiresIn: refreshExpiresIn,
      },
    );

    const tokenHash = await bcrypt.hash(refreshToken, SALT_ROUNDS);
    
    const newToken = this.refreshTokenRepository.create({
      id: jti,
      userId: user.id,
      tokenHash,
      expiresAt: this.addDuration(new Date(), refreshExpiresIn),
    });
    
    await this.refreshTokenRepository.save(newToken);

    return { accessToken, refreshToken };
  }

  /** Parses simple duration strings like "15m", "7d", "1h" used by JWT expiresIn. */
  private addDuration(base: Date, duration: string): Date {
    const match = /^(\d+)([smhd])$/.exec(duration.trim());
    if (!match) {
      // Fallback: default to 7 days if the format is unexpected.
      return new Date(base.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
    const value = parseInt(match[1], 10);
    const unitMs: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };
    return new Date(base.getTime() + value * unitMs[match[2]]);
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
