import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(MailService.name);

  constructor(private configService: ConfigService) {
    const smtpConfig = this.configService.get('smtp');
    this.transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.port === 465,
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.pass,
      },
    });
  }

  async sendMailWithAttachment(to: string, subject: string, text: string, html: string, attachment: Express.Multer.File) {
    const smtpConfig = this.configService.get('smtp');
    try {
      const info = await this.transporter.sendMail({
        from: `"Happy Guest House" <${smtpConfig.user}>`,
        to,
        subject,
        text,
        html,
        attachments: [
          {
            filename: attachment.originalname,
            content: attachment.buffer,
          },
        ],
      });
      this.logger.log(`Message sent: ${info.messageId}`);
      return info;
    } catch (error) {
      this.logger.error(`Error sending email: ${error.message}`);
      throw error;
    }
  }
}
