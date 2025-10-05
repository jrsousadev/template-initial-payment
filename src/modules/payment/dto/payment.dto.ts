// payments/dto/create-payment-request.dto.ts

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { $Enums } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  IsUrl,
  MaxLength,
  Min,
  ValidateNested,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  registerDecorator,
} from 'class-validator';

// ==================== ENUMS ====================

export enum SplitType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED = 'FIXED',
}

// ==================== CUSTOM VALIDATORS ====================
// Must be defined before being used in DTOs

@ValidatorConstraint({ name: 'MinimumDueDateValidator', async: false })
export class MinimumDueDateValidator implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    if (!value) return true; // Optional field

    const dueDate = new Date(value);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0); // Reset to start of day

    return dueDate >= tomorrow;
  }

  defaultMessage(args: ValidationArguments) {
    return 'due_date date must be at least one day after today';
  }
}

@ValidatorConstraint({ name: 'PaymentMethodValidator', async: false })
export class PaymentMethodValidator implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    const object = args.object as any; // Using any to avoid circular dependency

    switch (object.method) {
      case 'CREDIT_CARD':
        // For credit cards, check if credit_card is present
        return !!object.credit_card;
      case 'PIX':
        // For PIX, check if pix is present
        return !!object.pix;
      case 'BILLET':
        // For bank slip, check if billet is present
        return !!object.billet;
      default:
        // For other methods, consider valid
        return true;
    }
  }

  defaultMessage(args: ValidationArguments) {
    const object = args.object as any;

    switch (object.method) {
      case 'CREDIT_CARD':
        return 'Credit card data (credit_card) is required for CREDIT_CARD payment method';
      case 'PIX':
        return 'PIX data (pix) is required for PIX payment method';
      case 'BILLET':
        return 'Bank slip data (billet) is required for BILLET payment method';
      default:
        return `${object.method} data is required`;
    }
  }
}

// Decorator functions
export function IsMinimumDueDate(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions || {},
      constraints: [],
      validator: MinimumDueDateValidator,
    });
  };
}

export function IsValidPaymentMethod(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions || {}, // Don't force a default message
      constraints: [],
      validator: PaymentMethodValidator,
    });
  };
}

// ==================== SUB-DTOs ====================

export class DocumentDto {
  @ApiProperty({
    example: 'CPF',
    enum: ['CPF', 'CNPJ'],
    description: 'Document type',
  })
  @IsNotEmpty()
  @IsString()
  @IsEnum(['CPF', 'CNPJ'])
  type: 'CPF' | 'CNPJ';

  @ApiProperty({
    example: '07363631573',
    description: 'Unformatted document number',
  })
  @IsNotEmpty()
  @IsString()
  number: string;
}

export class AddressDto {
  @ApiProperty({ example: '49000000', description: 'Unformatted ZIP code' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(8)
  zipcode: string;

  @ApiProperty({ example: 'Aracaju' })
  @IsNotEmpty()
  @IsString()
  city: string;

  @ApiProperty({ example: 'SE', description: 'State abbreviation' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(2)
  state: string;

  @ApiPropertyOptional({
    example: 'Apt 101',
    description: 'Address complement',
  })
  @IsOptional()
  @IsString()
  complement?: string;

  @ApiProperty({ example: 'Rua das Flores' })
  @IsNotEmpty()
  @IsString()
  street: string;

  @ApiProperty({ example: 'Centro', description: 'Neighborhood' })
  @IsNotEmpty()
  @IsString()
  district: string;

  @ApiProperty({ example: '123' })
  @IsNotEmpty()
  @IsString()
  number: string;

  @ApiProperty({ example: 'Brasil', description: 'Country' })
  @IsNotEmpty()
  @IsString()
  country: string;
}

export class CustomerDTO {
  @ApiProperty({ example: 'João da Silva' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 'joao.silva@email.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({
    type: DocumentDto,
    description: 'Payer document (optional)',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => DocumentDto)
  document?: DocumentDto;

  @ApiProperty({ example: '5579999999999' })
  @IsNotEmpty()
  @IsString()
  phone: string;

  @ApiPropertyOptional({
    type: AddressDto,
    description: 'Customer address (optional)',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;
}

export class ItemDto {
  @ApiProperty({ example: 'T-shirt' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @IsPositive()
  quantity: number;

  @ApiProperty({ example: 500, description: 'Unit value in cents' })
  @IsNumber()
  @IsPositive()
  unit_amount: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  sku?: string;
}

export class ShippingAddressDto {
  @ApiProperty({ example: 'Rua das Flores' })
  @IsNotEmpty()
  @IsString()
  street: string;

  @ApiProperty({ example: '123' })
  @IsNotEmpty()
  @IsString()
  number: string;

  @ApiPropertyOptional({ example: 'Apt 101' })
  @IsOptional()
  @IsString()
  complement?: string;

  @ApiProperty({ example: 'Centro' })
  @IsNotEmpty()
  @IsString()
  district: string;

  @ApiProperty({ example: 'São Paulo' })
  @IsNotEmpty()
  @IsString()
  city: string;

  @ApiProperty({ example: 'SP' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(2)
  state: string;

  @ApiProperty({ example: 'BR' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(2)
  country: string;

  @ApiProperty({ example: '99000000' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(8)
  zipcode: string;
}

export class SplitRuleDto {
  @ApiProperty({
    example: 'a300039d-174c-4609-9fe1-be6928f27a38',
    description: 'Recipient identifier (company_id)',
  })
  @IsUUID()
  company_id: string;

  @ApiProperty({
    example: 70,
    description: 'Split value (percentage or fixed amount)',
  })
  @IsNumber()
  @IsPositive()
  value: number;
}

export class SplitDto {
  @ApiProperty({
    enum: SplitType,
    example: 'PERCENTAGE',
    description: 'Split type',
  })
  @IsEnum(SplitType)
  type: SplitType;

  @ApiProperty({ type: [SplitRuleDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SplitRuleDto)
  rules: SplitRuleDto[];
}

export class CreditCardDto {
  @ApiProperty({ example: 1, description: 'Number of installments' })
  @IsNumber()
  @Min(1)
  installments: number;

  @ApiProperty({ example: '4111111111111111' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(19)
  number: string;

  @ApiProperty({ example: 'JOAO SILVA' })
  @IsNotEmpty()
  @IsString()
  holder_name: string;

  @ApiProperty({ example: '12' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(2)
  expiry_month: string;

  @ApiProperty({ example: '2025' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(4)
  expiry_year: string;

  @ApiProperty({ example: '123' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(4)
  cvv: string;
}

export class BilletDto {
  @ApiProperty({
    example: '2025-09-15',
    description: 'Bank slip due date (must be at least 1 day after today)',
  })
  @IsDateString()
  @IsMinimumDueDate()
  due_date: string;

  @ApiPropertyOptional({
    example: 'Do not receive after due date',
    description: 'Bank slip instructions',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  instructions?: string;
}

export class PixDto {
  @ApiProperty({
    example: 3600,
    description: 'Expiration time in seconds',
  })
  @IsNumber()
  @IsPositive()
  expiration: number;
}

// ==================== MAIN DTO ====================

export class CreatePaymentRequestDto {
  @ApiProperty({
    example: 1000,
    description: 'Amount in cents',
  })
  @IsNumber()
  @IsPositive()
  @Min(100)
  amount: number;

  @ApiProperty({
    enum: $Enums.payment_method,
    example: 'PIX',
    description: 'Payment method',
  })
  @IsEnum($Enums.payment_method)
  @IsValidPaymentMethod()
  method: $Enums.payment_method;

  @ApiPropertyOptional({
    example: 'https://checkout.yourstore.com/payment/123',
    description: 'Checkout URL for redirection',
  })
  @IsOptional()
  @IsUrl()
  checkout_url?: string;

  @ApiPropertyOptional({
    example: 'https://www.yourstore.com/cart',
    description: 'Transaction origin URL',
  })
  @IsOptional()
  @IsUrl()
  referer_url?: string;

  @ApiProperty({
    enum: $Enums.transaction_currency,
    example: 'BRL',
    description: 'Currency',
  })
  @IsEnum($Enums.transaction_currency)
  currency: $Enums.transaction_currency;

  @ApiProperty({ type: CustomerDTO })
  @ValidateNested()
  @Type(() => CustomerDTO)
  customer: CustomerDTO;

  @ApiProperty({
    type: [ItemDto],
    description: 'Order items',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemDto)
  items: ItemDto[];

  @ApiPropertyOptional({ type: ShippingAddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  address?: ShippingAddressDto;

  @ApiPropertyOptional({ type: SplitDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SplitDto)
  split?: SplitDto;

  @ApiPropertyOptional({
    type: CreditCardDto,
    description: 'Credit card data (required if method = CREDIT_CARD)',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreditCardDto)
  credit_card?: CreditCardDto;

  @ApiPropertyOptional({
    type: BilletDto,
    description: 'Bank slip data (required if method = BILLET)',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => BilletDto)
  billet?: BilletDto;

  @ApiPropertyOptional({
    type: PixDto,
    description: 'PIX data (required if method = PIX)',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => PixDto)
  pix?: PixDto;

  @ApiPropertyOptional({
    example: 'ORD-123456',
    description: 'External ID from your system',
  })
  @IsOptional()
  @IsString()
  external_id?: string;

  @ApiPropertyOptional({
    example: 'Payment for order #123',
    description: 'Payment description',
  })
  @IsString()
  @MaxLength(255)
  description: string;
}

// ==================== MAPPER ====================

export class PaymentRequestMapper {
  static toCreatePaymentData(dto: CreatePaymentRequestDto): any {
    const itemsTotal =
      dto.items?.reduce(
        (sum, item) => sum + item.unit_amount * item.quantity,
        0,
      ) || dto.amount;

    if (dto.items && itemsTotal !== dto.amount) {
      throw new Error('Item sum does not match total amount');
    }

    let pixExpirationDate: Date | undefined;
    if (dto.method === 'PIX' && dto.pix) {
      pixExpirationDate = new Date();
      pixExpirationDate.setSeconds(
        pixExpirationDate.getSeconds() + dto.pix.expiration,
      );
    }

    let billetDueDate: Date | undefined;
    if (dto.method === 'BILLET' && dto.billet) {
      billetDueDate = new Date(dto.billet.due_date);
    }

    return {
      external_id: dto.external_id,
      description: dto.description,
      amount: dto.amount,
      currency: dto.currency,
      method: dto.method,
      customer_name: dto.customer.name,
      customer_document: dto.customer.document,
      customer_email: dto.customer.email,
      customer_phone: dto.customer.phone,
      customer_address: dto.customer.address,
      checkout_url: dto.checkout_url,
      referer_url: dto.referer_url,

      ...(dto.method === 'PIX' && {
        expired_at: pixExpirationDate,
      }),

      ...(dto.method === 'BILLET' && {
        expired_at: billetDueDate,
        billet_instructions: dto.billet?.instructions,
      }),

      ...(dto.method === 'CREDIT_CARD' &&
        dto.credit_card && {
          installments: dto.credit_card.installments,
          credit_card_number: dto.credit_card.number,
          credit_card_holder: dto.credit_card.holder_name,
          credit_card_expiry: `${dto.credit_card.expiry_month}/${dto.credit_card.expiry_year}`,
          credit_card_cvv: dto.credit_card.cvv,
        }),

      metadata: {
        items: dto.items,
        address: dto.address,
        split: dto.split,
      },
    };
  }
}
