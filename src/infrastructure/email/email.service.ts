import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
@Injectable()
export class EmailService {
  private readonly resend = new Resend(process.env.RESEND_API_KEY);
  private readonly logger = new Logger(EmailService.name);
  private readonly mail = 'noreply@axistecnology.com.br';

  private buildHtml(to: string, subject: string, body: string): string {
    return ``; // quando formos deixar dinâmico
  }

  async sendEmail(to: string, subject: string, body: string): Promise<void> {
    await this.resend.emails.send({
      from: `ShopFox <noreply@axistecnology.com.br>`,
      to,
      subject: 'Bem-vindo a ShopFox - Sua conta foi criada!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px;">
            🎉 Bem-vindo ao ShopFox!
          </h1>

          <p>Olá, testando...</p>
        </div>
      `,
    });
    this.logger.log('Account creation email sent successfully');
  }
}
