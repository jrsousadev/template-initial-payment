import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { ReceiverRepository } from '../repositories/receiver.repository';
import {
  CreateReceiverDto,
  UpdateReceiverStatusDto,
} from '../dto/receiver.dto';
import { ReceiverResponse } from '../interfaces/receiver.interfaces';
import { DocumentValidator } from 'src/common/utils/document.util';
import { Receiver } from '../entitites/receiver.entity';

@Injectable()
export class ReceiverService {
  private readonly logger = new Logger(ReceiverService.name);

  constructor(private readonly repository: ReceiverRepository) {}

  async create(
    dto: CreateReceiverDto,
    companyId: string,
  ): Promise<ReceiverResponse> {
    // Validações específicas
    if (dto.type === 'BANK_ACCOUNT') {
      if (
        dto.bank_holder_document &&
        !DocumentValidator.isValid(dto.bank_holder_document)
      ) {
        throw new BadRequestException('Invalid CPF or CNPJ document');
      }
    }

    // Verifica duplicados
    const isDuplicate = await this.repository.checkDuplicate(companyId, {
      bank_account_number: dto.bank_account_number,
      bank_code: dto.bank_code,
      wallet_id: dto.wallet_id,
      pix_key: dto.pix_key,
    });

    if (isDuplicate) {
      throw new ConflictException(
        'A receiver with these details already exists',
      );
    }

    // Cria o receiver
    const receiver = await this.repository.create({
      ...dto,
      company_id: companyId,
      bank_holder_document: dto.bank_holder_document
        ? DocumentValidator.clean(dto.bank_holder_document)
        : undefined,
    });

    this.logger.log(`Receiver ${receiver.id} created for company ${companyId}`);

    return this.formatResponse(receiver);
  }

  async findAll(
    companyId: string,
    page = 1,
    limit = 20,
    status?: string,
  ): Promise<any> {
    const offset = (page - 1) * limit;
    const { data, total } = await this.repository.findAllByCompany(
      companyId,
      offset,
      limit,
      status as any,
    );

    return {
      data: data.map((r) => this.formatResponse(r)),
      total,
      page,
      last_page: Math.ceil(total / limit),
    };
  }

  async findByIdAndCompany(id: string, companyId: string): Promise<Receiver> {
    const receiver = await this.repository.findByIdAndCompany(id, companyId);

    if (!receiver) {
      throw new NotFoundException('Receiver not found');
    }

    return receiver;
  }

  async findOne(id: string, companyId: string): Promise<ReceiverResponse> {
    const receiver = await this.repository.findByIdAndCompany(id, companyId);

    if (!receiver) {
      throw new NotFoundException('Receiver not found');
    }

    return this.formatResponse(receiver);
  }

  async updateStatus(
    id: string,
    companyId: string,
    dto: UpdateReceiverStatusDto,
  ): Promise<ReceiverResponse> {
    const receiver = await this.repository.findByIdAndCompany(id, companyId);

    if (!receiver) {
      throw new NotFoundException('Receiver not found');
    }

    if (receiver.status !== 'PENDING') {
      throw new BadRequestException('Only pending receivers can be updated');
    }

    const updated = await this.repository.updateStatus(id, dto.status);

    this.logger.log(`Receiver ${id} status updated to ${dto.status}`);

    return this.formatResponse(updated);
  }

  async delete(id: string, companyId: string): Promise<void> {
    const receiver = await this.repository.findByIdAndCompany(id, companyId);

    if (!receiver) {
      throw new NotFoundException('Receiver not found');
    }

    await this.repository.softDelete(id);

    this.logger.log(`Receiver ${id} soft deleted`);
  }

  private formatResponse(receiver: Receiver): ReceiverResponse {
    const response: ReceiverResponse = {
      id: receiver.id,
      status: receiver.status,
      type: receiver.type,
      created_at: receiver.created_at,
      updated_at: receiver.updated_at,
    };

    if (receiver.type === 'BANK_ACCOUNT') {
      response.bank = {
        holder_name: receiver.bank_holder_name,
        holder_type: receiver.bank_holder_type,
        holder_document: receiver.bank_holder_document
          ? DocumentValidator.mask(receiver.bank_holder_document)
          : null,
        code: receiver.bank_code,
        name: receiver.bank_name,
        branch_code: receiver.bank_branch_code,
        branch_check_digit: receiver.bank_branch_check_digit,
        account_number: receiver.bank_account_number
          ? `****${receiver.bank_account_number.slice(-4)}`
          : null,
        account_check_digit: receiver.bank_account_check_digit,
        account_type: receiver.bank_account_type,
      };

      if (receiver.pix_key) {
        response.pix = {
          key: receiver.pix_key,
          type: receiver.pix_type,
        };
      }
    }

    if (receiver.type === 'CRIPTO_WALLET') {
      response.wallet = {
        network: receiver.wallet_network,
        address: receiver.wallet_id
          ? `${receiver.wallet_id.slice(0, 6)}...${receiver.wallet_id.slice(-4)}`
          : null,
      };
    }

    return response;
  }
}
