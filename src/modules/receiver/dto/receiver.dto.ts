import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
  MaxLength,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  receiver_type,
  receiver_bank_account_type,
  receiver_bank_holder_type,
  receiver_pix_type,
  receiver_crypto_network,
} from '@prisma/client';

// Validador customizado
@ValidatorConstraint({ name: 'ReceiverTypeValidator', async: false })
export class ReceiverTypeValidator implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    const object = args.object as CreateReceiverDto;

    if (object.type === 'BANK_ACCOUNT') {
      return !!(
        object.bank_holder_name &&
        object.bank_holder_document &&
        object.bank_code &&
        object.bank_account_number
      );
    }

    if (object.type === 'CRIPTO_WALLET') {
      return !!(object.wallet_id && object.wallet_network);
    }

    return false;
  }

  defaultMessage(args: ValidationArguments) {
    const object = args.object as CreateReceiverDto;
    if (object.type === 'BANK_ACCOUNT') {
      return 'Bank account details are required for BANK_ACCOUNT type';
    }
    return 'Wallet details are required for CRIPTO_WALLET type';
  }
}

function IsValidReceiverType(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: ReceiverTypeValidator,
    });
  };
}

export class CreateReceiverDto {
  @ApiProperty({
    enum: receiver_type,
    example: 'BANK_ACCOUNT',
    description: 'Tipo do recebedor',
  })
  @IsEnum(receiver_type)
  @IsValidReceiverType()
  type: receiver_type;

  // ===== BANK ACCOUNT FIELDS =====

  @ApiPropertyOptional({ example: 'João da Silva' })
  @ValidateIf((o) => o.type === 'BANK_ACCOUNT')
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  bank_holder_name?: string;

  @ApiPropertyOptional({
    enum: receiver_bank_holder_type,
    example: 'INDIVIDUAL',
  })
  @ValidateIf((o) => o.type === 'BANK_ACCOUNT')
  @IsEnum(receiver_bank_holder_type)
  bank_holder_type?: receiver_bank_holder_type;

  @ApiPropertyOptional({ example: '12345678900' })
  @ValidateIf((o) => o.type === 'BANK_ACCOUNT')
  @IsNotEmpty()
  @IsString()
  bank_holder_document?: string;

  @ApiPropertyOptional({ example: '341' })
  @ValidateIf((o) => o.type === 'BANK_ACCOUNT')
  @IsNotEmpty()
  @IsString()
  @MaxLength(4)
  bank_code?: string;

  @ApiPropertyOptional({ example: 'Itaú Unibanco' })
  @IsOptional()
  @IsString()
  bank_name?: string;

  @ApiPropertyOptional({ example: '0001' })
  @ValidateIf((o) => o.type === 'BANK_ACCOUNT')
  @IsNotEmpty()
  @IsString()
  @MaxLength(5)
  bank_branch_code?: string;

  @ApiPropertyOptional({ example: '0' })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  bank_branch_check_digit?: string;

  @ApiPropertyOptional({ example: '12345' })
  @ValidateIf((o) => o.type === 'BANK_ACCOUNT')
  @IsNotEmpty()
  @IsString()
  @MaxLength(20)
  bank_account_number?: string;

  @ApiPropertyOptional({ example: '6' })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  bank_account_check_digit?: string;

  @ApiPropertyOptional({
    enum: receiver_bank_account_type,
    example: 'CHECKING',
  })
  @ValidateIf((o) => o.type === 'BANK_ACCOUNT')
  @IsEnum(receiver_bank_account_type)
  bank_account_type?: receiver_bank_account_type;

  // ===== PIX FIELDS =====

  @ApiPropertyOptional({ example: 'joao@email.com' })
  @IsOptional()
  @IsString()
  pix_key?: string;

  @ApiPropertyOptional({
    enum: receiver_pix_type,
    example: 'EMAIL',
  })
  @IsOptional()
  @IsEnum(receiver_pix_type)
  pix_type?: receiver_pix_type;

  // ===== WALLET FIELDS =====

  @ApiPropertyOptional({
    enum: receiver_crypto_network,
    example: 'ETHEREUM',
  })
  @ValidateIf((o) => o.type === 'CRIPTO_WALLET')
  @IsEnum(receiver_crypto_network)
  wallet_network?: receiver_crypto_network;

  @ApiPropertyOptional({ example: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb' })
  @ValidateIf((o) => o.type === 'CRIPTO_WALLET')
  @IsNotEmpty()
  @IsString()
  wallet_id?: string;
}

export class UpdateReceiverStatusDto {
  @ApiProperty({
    enum: ['ACTIVE', 'REJECTED'],
    example: 'ACTIVE',
    description: 'Novo status do recebedor',
  })
  @IsEnum(['ACTIVE', 'REJECTED'])
  status: 'ACTIVE' | 'REJECTED';
}
