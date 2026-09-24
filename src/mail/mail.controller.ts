import { Controller, Post, UseInterceptors, UploadedFile, Body, BadRequestException, UseGuards } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MailService } from './mail.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../users/entities/user.entity';
import { ApiTags, ApiConsumes, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Mail')
@Controller('mail')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Post('send-bill')
  @Roles(Role.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Send bill PDF to customer via email' })
  async sendBill(
    @UploadedFile() file: Express.Multer.File,
    @Body('email') email: string,
    @Body('subject') subject: string,
    @Body('message') message: string,
  ) {
    if (!file) {
      throw new BadRequestException('PDF file is required');
    }
    if (!email) {
      throw new BadRequestException('Customer email is required');
    }

    const emailSubject = subject || 'Your Bill from Happy Guest House';
    const emailMessage = message || 'Please find attached your bill for your stay at Happy Guest House. Thank you for choosing us!';

    await this.mailService.sendMailWithAttachment(
      email,
      emailSubject,
      emailMessage,
      `<p>${emailMessage}</p>`,
      file,
    );

    return { message: 'Email sent successfully' };
  }
}
