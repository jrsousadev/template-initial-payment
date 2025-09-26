import { Injectable, Logger } from '@nestjs/common';
import { PaymentItemRepository } from '../repositories/payment-item.repository';
import { ItemDto } from 'src/modules/payment/dto/payment.dto';
import {
  CreatePaymentItemData,
  PaymentItemData,
} from '../interfaces/payment-item.interfaces';

@Injectable()
export class PaymentItemService {
  private readonly logger = new Logger(PaymentItemService.name);

  constructor(private readonly repository: PaymentItemRepository) {}

  /**
   * Cria itens de pagamento a partir do DTO
   * Usado quando um pagamento é criado com sucesso
   */
  async createItemsFromPayment(
    paymentId: string,
    items: ItemDto[],
  ): Promise<PaymentItemData[]> {
    try {
      if (!items || items.length === 0) {
        this.logger.warn(`No items to create for payment ${paymentId}`);
        return [];
      }

      const itemsData: CreatePaymentItemData[] = items.map((item) => ({
        name: item.name,
        sku: item.sku || null,
        unit_amount: item.unit_amount,
        quantity: item.quantity,
        payment_id: paymentId,
      }));

      const createdItems = await this.repository.createMany(itemsData);

      this.logger.log(
        `Created ${createdItems.length} items for payment ${paymentId}`,
      );

      return createdItems;
    } catch (error) {
      this.logger.error(
        `Error creating items for payment ${paymentId}: ${error.message}`,
        error.stack,
      );
      // Não lançar erro para não quebrar a criação do pagamento
      // Os itens já estão salvos no items_json do payment
      return [];
    }
  }

  /**
   * Busca itens por ID do pagamento
   */
  async findByPaymentId(paymentId: string): Promise<PaymentItemData[]> {
    try {
      return await this.repository.findByPaymentId(paymentId);
    } catch (error) {
      this.logger.error(
        `Error finding items for payment ${paymentId}: ${error.message}`,
      );
      return [];
    }
  }

  /**
   * Busca itens de múltiplos pagamentos
   * Útil para relatórios ou processamento em batch
   */
  async findByPaymentIds(paymentIds: string[]): Promise<PaymentItemData[]> {
    try {
      if (!paymentIds || paymentIds.length === 0) {
        return [];
      }

      return await this.repository.findByPaymentIds(paymentIds);
    } catch (error) {
      this.logger.error(
        `Error finding items for multiple payments: ${error.message}`,
      );
      return [];
    }
  }

  /**
   * Calcula o total dos itens de um pagamento
   * Útil para validação ou reconciliação
   */
  async calculateTotalByPaymentId(paymentId: string): Promise<number> {
    try {
      return await this.repository.getTotalByPaymentId(paymentId);
    } catch (error) {
      this.logger.error(
        `Error calculating total for payment ${paymentId}: ${error.message}`,
      );
      return 0;
    }
  }

  /**
   * Verifica se existem itens para um pagamento
   */
  async hasItems(paymentId: string): Promise<boolean> {
    try {
      return await this.repository.existsByPaymentId(paymentId);
    } catch (error) {
      this.logger.error(
        `Error checking items existence for payment ${paymentId}: ${error.message}`,
      );
      return false;
    }
  }

  /**
   * Remove itens de um pagamento
   * Usado apenas em casos especiais (ex: rollback, correção)
   */
  async removeByPaymentId(paymentId: string): Promise<number> {
    try {
      const deletedCount = await this.repository.deleteByPaymentId(paymentId);

      if (deletedCount > 0) {
        this.logger.warn(
          `Deleted ${deletedCount} items from payment ${paymentId}`,
        );
      }

      return deletedCount;
    } catch (error) {
      this.logger.error(
        `Error deleting items for payment ${paymentId}: ${error.message}`,
      );
      return 0;
    }
  }

  /**
   * Valida se o total dos itens bate com o valor do pagamento
   */
  async validateItemsTotal(
    paymentId: string,
    expectedTotal: number,
  ): Promise<boolean> {
    try {
      const calculatedTotal =
        await this.repository.getTotalByPaymentId(paymentId);
      const isValid = calculatedTotal === expectedTotal;

      if (!isValid) {
        this.logger.warn(
          `Payment ${paymentId} items total mismatch: ` +
            `expected ${expectedTotal}, got ${calculatedTotal}`,
        );
      }

      return isValid;
    } catch (error) {
      this.logger.error(
        `Error validating items total for payment ${paymentId}: ${error.message}`,
      );
      return false;
    }
  }

  /**
   * Agrupa itens por SKU para análise
   */
  async groupItemsBySku(
    paymentIds: string[],
  ): Promise<Map<string, PaymentItemData[]>> {
    try {
      const items = await this.repository.findByPaymentIds(paymentIds);
      const grouped = new Map<string, PaymentItemData[]>();

      items.forEach((item) => {
        const sku = item.sku || 'NO_SKU';
        if (!grouped.has(sku)) {
          grouped.set(sku, []);
        }
        grouped.get(sku)!.push(item);
      });

      return grouped;
    } catch (error) {
      this.logger.error(`Error grouping items by SKU: ${error.message}`);
      return new Map();
    }
  }
}
