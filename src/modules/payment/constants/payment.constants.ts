export const PAYMENT_CONSTANTS = {
  // Cache
  SYSTEM_CACHE_KEY: 'system_axis:123456',
  CACHE_TTL: 3000000, // 30 minutos

  // Valores mínimos
  MIN_AMOUNT_PIX: 100,
  MIN_AMOUNT_CREDIT_CARD: 1000,

  // Parcelas
  MIN_INSTALLMENTS: 1,
  MAX_INSTALLMENTS: 12,

  // Antecipação
  ANTICIPATION_START_HOUR: 6,
  ANTICIPATION_END_HOUR: 24,

  // Timeouts
  PROVIDER_TIMEOUT: 10000, // 10 segundos
};

export const ERROR_MESSAGES = {
  SYSTEM_DISABLED: 'Cash-in is temporarily disabled.',
  REFUNDS_DISABLED: 'Refunds is temporarily disabled.',
  UNSUPPORTED_PAYMENT_METHOD: 'Unsupported payment method',
  UNSUPPORTED_CURRENCY: 'Unsupported currency',
  CREDIT_CARD_NOT_FOUND: 'Credit card not found',
  AMOUNT_BELOW_MINIMUM: 'Sale value below minimum',
  AMOUNT_ABOVE_MAXIMUM: 'Sale value exceeds maximum',
  INVALID_INSTALLMENTS: 'Installments must be between 1 and 12',
  PIX_WITH_CREDIT_CARD: 'PIX cannot be used with credit card details',
  FINGERPRINT_REQUIRED: 'Fingerprint required for VISA',
  PROVIDER_TIMEOUT: 'Timeout to process in provider',
  PAYMENT_FAILED: 'Payment processing failed',
  PAYMENT_NOT_FOUND: 'Payment not found',
  ANTICIPATION_INVALID_AMOUNT: 'Invalid anticipation amount',
  ANTICIPATION_INVALID_TIME: 'Anticipation can only be requested between 6 AM and 12 AM',
  ANTICIPATION_INSUFFICIENT_BALANCE: 'Insufficient balance for anticipation',
  REFUNDS_FAILED: 'Refund processing failed',
};
