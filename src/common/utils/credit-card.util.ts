import { payment_credit_card_brand } from "@prisma/client";

export class CreditCardUtils {
  static getCreditCardBrand(cardNumber: string): payment_credit_card_brand | null {
    const bin = cardNumber.slice(0, 6);

    if (/^4/.test(bin)) {
      return 'VISA';
    }
    if (/^(5[1-5]|222[1-9]|22[3-9]\d|2[3-6]\d{2}|27[01]\d|2720)/.test(bin)) {
      return 'MASTER';
    }
    if (
      [
        '401178',
        '401179',
        '431274',
        '438935',
        '451416',
        '457393', // Alguns exemplos Elo
        '5067',
        '509',
        '650',
        '651',
        '655',
      ].some((prefix) => bin.startsWith(prefix))
    ) {
      return 'ELO';
    }

    return 'OTHERS';
  }

  static normalizeYear(year: string): string {
    const yearString = year.toString();

    if (yearString.startsWith('20')) {
      return yearString;
    }

    return `20${yearString}`;
  }
}
