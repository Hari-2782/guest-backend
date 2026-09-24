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

    const htmlTemplate = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #1e293b; text-align: center; margin-bottom: 24px;">Happy Guest House</h2>
        <div style="background-color: #f8fafc; padding: 16px; border-radius: 6px; margin-bottom: 24px;">
          <p style="color: #334155; line-height: 1.6; font-size: 16px; margin: 0;">
            Dear Guest,<br><br>
            ${emailMessage}<br><br>
            Please find your official invoice attached to this email as a PDF document.
          </p>
        </div>
        <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; text-align: center; color: #64748b; font-size: 12px;">
          <p style="margin: 4px 0;"><strong>Happy Guest House</strong></p>
          <p style="margin: 4px 0;">No. 20 St. Peter's Lane, Hospital Road, Jaffna, Sri Lanka</p>
          <p style="margin: 4px 0;">📞 021 720 6633 | ✉️ happyguesthouse961@gmail.com</p>
        </div>
      </div>
    `;

    await this.mailService.sendMailWithAttachment(
      email,
      emailSubject,
      emailMessage,
      htmlTemplate,
      file,
    );

    return { message: 'Email sent successfully' };
  }
}
