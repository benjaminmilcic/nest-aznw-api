import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class Error2emailService {
  constructor(private readonly mailerService: MailerService) {}

  sendErrorMail(error: string): void {
    const formattedError = JSON.parse(error);
    this.mailerService.sendMail({
      to: 'benjamin.milcic@gmail.com',
      from: 'info@auf-zu-neuen-welten.de',
      subject: 'An error has occurred on auf-zu-neuen-welten.de',
      html: this.buildHtml(JSON.parse(formattedError.error), 4),
    });
  }

  private buildHtml(obj: any, indent: number): string {
    const currentIndent = '&nbsp;'.repeat(indent);
    const nextIndent = '&nbsp;'.repeat(indent + 2);

    if (obj === null) return this.wrapSpan('null', 'color: gray;');
    if (obj === undefined) return this.wrapSpan('undefined', 'color: gray;');
    if (typeof obj === 'string')
      return this.wrapSpan(`"${obj}"`, 'color: green;');
    if (typeof obj === 'number')
      return this.wrapSpan(obj.toString(), 'color: blue;');
    if (typeof obj === 'boolean')
      return this.wrapSpan(obj.toString(), 'color: purple;');

    if (Array.isArray(obj)) {
      const arrayHtml = obj
        .map((item) => this.buildHtml(item, indent + 2))
        .join(`,<br>${nextIndent}`);
      return `[<br>${nextIndent}${arrayHtml}<br>${currentIndent}]`;
    }

    if (typeof obj === 'object') {
      const entriesHtml = Object.entries(obj)
        .map(([key, value]) => {
          return `<br>${nextIndent}${this.wrapSpan(key, 'font-weight: bold; color: red;')}: ${this.buildHtml(value, indent + 2)}`;
        })
        .join('');
      return `{${entriesHtml}<br>${currentIndent}}`;
    }

    return this.wrapSpan(String(obj), 'color: gray;');
  }

  private wrapSpan(content: string, style: string): string {
    return `<span style="${style}">${content.replaceAll('\n', '<br>&nbsp;&nbsp;&nbsp;&nbsp;')}</span>`;
  }
}
