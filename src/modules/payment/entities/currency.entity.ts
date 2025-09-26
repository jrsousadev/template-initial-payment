import {
  payment_method,
  transaction_currency as PrismaTransactionCurrency,
} from '@prisma/client';

interface CurrencyConfig {
  code: PrismaTransactionCurrency;
  symbol: string;
  name: string;
  decimalPlaces: number;
  thousandsSeparator: string;
  decimalSeparator: string;
  symbolPosition: 'before' | 'after';
  allowedPaymentMethods: payment_method[];
  requiresDocument: boolean;
}

const CURRENCY_CONFIGS: Record<PrismaTransactionCurrency, CurrencyConfig> = {
  [PrismaTransactionCurrency.BRL]: {
    code: PrismaTransactionCurrency.BRL,
    symbol: 'R$',
    name: 'Real Brasileiro',
    decimalPlaces: 2,
    thousandsSeparator: '.',
    decimalSeparator: ',',
    symbolPosition: 'before',
    allowedPaymentMethods: [
      payment_method.CREDIT_CARD,
      payment_method.PIX,
      payment_method.BILLET,
    ],
    requiresDocument: true,
  },
  [PrismaTransactionCurrency.USD]: {
    code: PrismaTransactionCurrency.USD,
    symbol: '$',
    name: 'US Dollar',
    decimalPlaces: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.',
    symbolPosition: 'before',
    allowedPaymentMethods: [payment_method.CREDIT_CARD],
    requiresDocument: false,
  },
  [PrismaTransactionCurrency.MXN]: {
    code: PrismaTransactionCurrency.MXN,
    symbol: '$',
    name: 'Peso Mexicano',
    decimalPlaces: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.',
    symbolPosition: 'before',
    allowedPaymentMethods: [payment_method.CREDIT_CARD],
    requiresDocument: false,
  },
};

export class Currency {
  private config: CurrencyConfig;

  constructor(currency: PrismaTransactionCurrency) {
    const config = CURRENCY_CONFIGS[currency];
    if (!config) {
      throw new Error(`Currency ${currency} is not supported`);
    }
    this.config = config;
  }

  get code(): PrismaTransactionCurrency {
    return this.config.code;
  }

  get symbol(): string {
    return this.config.symbol;
  }

  get name(): string {
    return this.config.name;
  }

  get decimalPlaces(): number {
    return this.config.decimalPlaces;
  }

  get requiresDocument(): boolean {
    return this.config.requiresDocument;
  }

  get allowedPaymentMethods(): payment_method[] {
    return this.config.allowedPaymentMethods;
  }

  isPaymentMethodAllowed(method: payment_method): boolean {
    return this.config.allowedPaymentMethods.includes(method);
  }

  validatePaymentMethod(method: payment_method): void {
    if (!this.isPaymentMethodAllowed(method)) {
      throw new Error(
        `Payment method ${method} is not allowed for ${this.code}. ` +
          `Allowed methods: ${this.config.allowedPaymentMethods.join(', ')}`,
      );
    }
  }

  validateIfRequiresDocument(document?: string): boolean {
    if (this.config.requiresDocument && !document) {
      throw new Error(
        `Currency ${this.code} requires a document (e.g., CPF/CNPJ) for transactions.`,
      );
    }
    return true;
  }

  format(amount: number): string {
    const fixed = amount.toFixed(this.config.decimalPlaces);
    const [integerPart, decimalPart] = fixed.split('.');

    const formattedInteger = integerPart.replace(
      /\B(?=(\d{3})+(?!\d))/g,
      this.config.thousandsSeparator,
    );

    const formattedValue = decimalPart
      ? `${formattedInteger}${this.config.decimalSeparator}${decimalPart}`
      : formattedInteger;

    if (this.config.symbolPosition === 'before') {
      return `${this.config.symbol} ${formattedValue}`;
    } else {
      return `${formattedValue} ${this.config.symbol}`;
    }
  }

  parse(formattedAmount: string): number {
    let cleaned = formattedAmount.replace(this.config.symbol, '').trim();

    cleaned = cleaned.replace(
      new RegExp(`\\${this.config.thousandsSeparator}`, 'g'),
      '',
    );

    cleaned = cleaned.replace(this.config.decimalSeparator, '.');

    const parsed = parseFloat(cleaned);

    if (isNaN(parsed)) {
      throw new Error(
        `Cannot parse "${formattedAmount}" as ${this.code} amount`,
      );
    }

    return parsed;
  }

  canUsePix(): boolean {
    return this.isPaymentMethodAllowed(payment_method.PIX);
  }

  canUseCard(): boolean {
    return this.isPaymentMethodAllowed(payment_method.CREDIT_CARD);
  }

  canUseBillet(): boolean {
    return this.isPaymentMethodAllowed(payment_method.BILLET);
  }

  static getSupportedCurrencies(): PrismaTransactionCurrency[] {
    return Object.keys(CURRENCY_CONFIGS) as PrismaTransactionCurrency[];
  }

  static from(currency: PrismaTransactionCurrency): Currency {
    return new Currency(currency);
  }

  toJSON() {
    return {
      code: this.config.code,
      symbol: this.config.symbol,
      name: this.config.name,
      allowedPaymentMethods: this.config.allowedPaymentMethods,
      requiresDocument: this.config.requiresDocument,
    };
  }
}
