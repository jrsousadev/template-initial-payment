export interface CreatePaymentItemData {
  name: string;
  sku?: string | null;
  unit_amount: number;
  quantity: number;
  payment_id: string;
}

export interface PaymentItemData {
  id: string;
  name: string;
  sku: string | null;
  unit_amount: number;
  quantity: number;
  payment_id: string;
}
