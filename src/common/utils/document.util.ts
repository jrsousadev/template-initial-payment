export class DocumentValidator {
  /**
   * Valida CPF ou CNPJ
   * @param document - CPF ou CNPJ com ou sem formatação
   * @returns true se válido, false se inválido
   */
  static isValid(document: string): boolean {
    if (!document) return false;

    // Remove caracteres não numéricos
    const cleaned = document.replace(/\D/g, '');

    if (cleaned.length === 11) {
      return this.isValidCPF(cleaned);
    } else if (cleaned.length === 14) {
      return this.isValidCNPJ(cleaned);
    }

    return false;
  }

  /**
   * Valida CPF
   * @param cpf - CPF apenas números
   * @returns true se válido, false se inválido
   */
  static isValidCPF(cpf: string): boolean {
    // Remove caracteres não numéricos
    cpf = cpf.replace(/\D/g, '');

    // Verifica se tem 11 dígitos
    if (cpf.length !== 11) return false;

    // Verifica se todos os dígitos são iguais (ex: 111.111.111-11)
    if (/^(\d)\1{10}$/.test(cpf)) return false;

    // Validação do primeiro dígito verificador
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cpf.charAt(i)) * (10 - i);
    }
    let digit = 11 - (sum % 11);
    if (digit > 9) digit = 0;
    if (digit !== parseInt(cpf.charAt(9))) return false;

    // Validação do segundo dígito verificador
    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cpf.charAt(i)) * (11 - i);
    }
    digit = 11 - (sum % 11);
    if (digit > 9) digit = 0;
    if (digit !== parseInt(cpf.charAt(10))) return false;

    return true;
  }

  /**
   * Valida CNPJ
   * @param cnpj - CNPJ apenas números
   * @returns true se válido, false se inválido
   */
  static isValidCNPJ(cnpj: string): boolean {
    // Remove caracteres não numéricos
    cnpj = cnpj.replace(/\D/g, '');

    // Verifica se tem 14 dígitos
    if (cnpj.length !== 14) return false;

    // Verifica se todos os dígitos são iguais
    if (/^(\d)\1{13}$/.test(cnpj)) return false;

    // Validação do primeiro dígito verificador
    const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(cnpj.charAt(i)) * weights1[i];
    }
    let digit = sum % 11;
    digit = digit < 2 ? 0 : 11 - digit;
    if (digit !== parseInt(cnpj.charAt(12))) return false;

    // Validação do segundo dígito verificador
    const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    sum = 0;
    for (let i = 0; i < 13; i++) {
      sum += parseInt(cnpj.charAt(i)) * weights2[i];
    }
    digit = sum % 11;
    digit = digit < 2 ? 0 : 11 - digit;
    if (digit !== parseInt(cnpj.charAt(13))) return false;

    return true;
  }

  /**
   * Formata CPF ou CNPJ
   * @param document - Documento sem formatação
   * @returns Documento formatado ou original se inválido
   */
  static format(document: string): string {
    if (!document) return '';

    const cleaned = document.replace(/\D/g, '');

    if (cleaned.length === 11) {
      return this.formatCPF(cleaned);
    } else if (cleaned.length === 14) {
      return this.formatCNPJ(cleaned);
    }

    return document;
  }

  /**
   * Formata CPF
   * @param cpf - CPF apenas números
   * @returns CPF formatado (xxx.xxx.xxx-xx)
   */
  static formatCPF(cpf: string): string {
    cpf = cpf.replace(/\D/g, '');
    if (cpf.length !== 11) return cpf;

    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  /**
   * Formata CNPJ
   * @param cnpj - CNPJ apenas números
   * @returns CNPJ formatado (xx.xxx.xxx/xxxx-xx)
   */
  static formatCNPJ(cnpj: string): string {
    cnpj = cnpj.replace(/\D/g, '');
    if (cnpj.length !== 14) return cnpj;

    return cnpj.replace(
      /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
      '$1.$2.$3/$4-$5',
    );
  }

  /**
   * Remove formatação do documento
   * @param document - CPF ou CNPJ formatado
   * @returns Apenas números
   */
  static clean(document: string): string {
    return document.replace(/\D/g, '');
  }

  /**
   * Identifica o tipo de documento
   * @param document - CPF ou CNPJ
   * @returns 'CPF', 'CNPJ' ou null
   */
  static getType(document: string): 'CPF' | 'CNPJ' | null {
    const cleaned = document.replace(/\D/g, '');

    if (cleaned.length === 11) return 'CPF';
    if (cleaned.length === 14) return 'CNPJ';

    return null;
  }

  /**
   * Mascara o documento para exibição segura
   * @param document - CPF ou CNPJ
   * @returns Documento mascarado
   */
  static mask(document: string): string {
    const cleaned = document.replace(/\D/g, '');

    if (cleaned.length === 11) {
      // CPF: ***.***.**-11
      return `***.***.**-${cleaned.slice(-2)}`;
    } else if (cleaned.length === 14) {
      // CNPJ: **.***.***/****-14
      return `**.***.***/****-${cleaned.slice(-2)}`;
    }

    return '***';
  }
}
