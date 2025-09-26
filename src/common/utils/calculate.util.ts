export class CalculateUtil {
  /**
   * Calcula o valor líquido após descontar a taxa percentual e a taxa fixa
   * @param amount - Valor bruto em centavos
   * @param taxPercentage - Porcentagem da taxa (ex: 4.13 para 4.13%)
   * @param fixedFee - Taxa fixa em centavos
   * @returns Valor líquido em centavos
   */
  static calculateNetAmount(
    amount: number,
    taxPercentage: number,
    fixedFee: number = 0,
  ): number {
    // Calcula o desconto percentual
    const percentageDiscount = amount * (taxPercentage / 100);
    // Subtrai o desconto percentual e a taxa fixa do valor original
    const netAmount = amount - percentageDiscount - fixedFee;
    return Math.floor(netAmount);
  }

  /**
   * Calcula o valor da taxa (percentual + fixa)
   * @param amount - Valor bruto em centavos
   * @param taxPercentage - Porcentagem da taxa (ex: 4.13 para 4.13%)
   * @param fixedFee - Taxa fixa em centavos
   * @returns Valor total da taxa em centavos
   */
  static calculateFeeAmount(
    amount: number,
    taxPercentage: number,
    fixedFee: number = 0,
  ): number {
    // Calcula a taxa percentual
    const percentageFee = amount * (taxPercentage / 100);
    // Soma a taxa percentual com a taxa fixa
    const totalFee = percentageFee + fixedFee;
    return Math.floor(totalFee);
  }
}
