import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { CustomerRepository } from '../repositories/customer.repository';
import { Customer } from '../entities/customer.entity';
import { CustomerConfig } from '../entities/customer-config.entity';
import {
  CreateCustomerData,
  UpdateCustomerConfigData,
} from '../interfaces/customer.interfaces';

@Injectable()
export class CustomerService {
  constructor(private readonly repository: CustomerRepository) {}

  // ===== CUSTOMER =====

  async create(data: CreateCustomerData): Promise<Customer> {
    // Verificar email duplicado
    const existingEmail = await this.repository.findByEmail(data.email);
    if (existingEmail) {
      throw new ConflictException('Email already exists');
    }

    // Verificar documento duplicado
    if (data.document) {
      const existingDocument = await this.repository.findByDocument(
        data.document,
      );
      if (existingDocument) {
        throw new ConflictException('Document already exists');
      }
    }

    const customer = await this.repository.create({
      full_name: data.fullName,
      email: data.email,
      document: data.document,
      phone: data.phone,
    });

    // Criar config padrão
    await this.repository.createOrUpdateConfig(customer.id, {
      customer: { connect: { id: customer.id } },
      email_marketing_enabled: false,
      sms_marketing_enabled: false,
      tax_exempt_enabled: false,
      key: '',
      value: '',
    });

    return new Customer(customer);
  }

  async findById(id: string): Promise<Customer> {
    const customer = await this.repository.findById(id);

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return new Customer(customer);
  }

  async findByEmail(email: string): Promise<Customer> {
    const customer = await this.repository.findByEmail(email);

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return new Customer(customer);
  }

  async update(
    id: string,
    data: Partial<CreateCustomerData>,
  ): Promise<Customer> {
    await this.findById(id); // Verificar se existe

    // Se está atualizando email, verificar duplicado
    if (data.email) {
      const existing = await this.repository.findByEmail(data.email);
      if (existing && existing.id !== id) {
        throw new ConflictException('Email already exists');
      }
    }

    // Se está atualizando documento, verificar duplicado
    if (data.document) {
      const existing = await this.repository.findByDocument(data.document);
      if (existing && existing.id !== id) {
        throw new ConflictException('Document already exists');
      }
    }

    const updated = await this.repository.update(id, {
      ...(data.fullName && { full_name: data.fullName }),
      ...(data.email && { email: data.email }),
      ...(data.document && { document: data.document }),
      ...(data.phone && { phone: data.phone }),
    });

    return new Customer(updated);
  }

  async delete(id: string): Promise<void> {
    await this.findById(id); // Verificar se existe
    await this.repository.delete(id);
  }

  async findOrCreate(
    email: string,
    data?: {
      fullName?: string;
      document?: string;
      phone?: string;
    },
  ): Promise<{ data: Customer; created: boolean }> {
    const result = await this.repository.findOrCreate(email, data);

    if (result.created) {
      await this.repository.createOrUpdateConfig(result.customer.id, {
        customer: { connect: { id: result.customer.id } },
        email_marketing_enabled: false,
        sms_marketing_enabled: false,
        tax_exempt_enabled: false,
        key: '',
        value: '',
      });
    }

    return {
      data: new Customer(result.customer),
      created: result.created,
    };
  }

  // ===== CUSTOMER CONFIG =====

  async updateConfig(
    customerId: string,
    data: UpdateCustomerConfigData,
  ): Promise<CustomerConfig> {
    await this.findById(customerId); // Verificar se customer existe

    const config = await this.repository.createOrUpdateConfig(customerId, {
      customer: { connect: { id: customerId } },
      ...(data.emailMarketingEnabled !== undefined && {
        email_marketing_enabled: data.emailMarketingEnabled,
      }),
      ...(data.smsMarketingEnabled !== undefined && {
        sms_marketing_enabled: data.smsMarketingEnabled,
      }),
      ...(data.taxExemptEnabled !== undefined && {
        tax_exempt_enabled: data.taxExemptEnabled,
      }),
      ...(data.key && { key: data.key }),
      ...(data.value && { value: data.value }),
    });

    return new CustomerConfig(config);
  }

  async findConfig(customerId: string): Promise<CustomerConfig | null> {
    const config = await this.repository.findConfig(customerId);
    return config ? new CustomerConfig(config) : null;
  }
}
