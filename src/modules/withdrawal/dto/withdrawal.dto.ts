import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  IsUUID,
  Min,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { withdrawal_type } from '@prisma/client';

export class CreateWithdrawalDto {
  @ApiProperty({
    example: 1000,
    description: 'Valor em centavos',
  })
  @IsNumber()
  @IsPositive()
  @Min(1)
  amount: number;

  @ApiProperty({
    example: 'uuid-do-receiver',
    description: 'ID do recebedor cadastrado',
  })
  @IsNotEmpty()
  @IsUUID()
  receiver_id: string;

  @ApiProperty({
    enum: withdrawal_type,
    example: 'PIX',
    description: 'Tipo de saque',
  })
  @IsEnum(withdrawal_type)
  type: withdrawal_type;

  @ApiPropertyOptional({
    example: 'WTH-123456',
    description: 'ID externo do seu sistema',
  })
  @IsOptional()
  @IsString()
  external_id?: string;
}
