import * as CryptoJS from 'crypto-js';
import * as dotenv from 'dotenv';

dotenv.config();

export class EncryptionHelper {
  private secretKey: string;

  constructor(secretKey: string) {
    this.secretKey = secretKey;
  }

  encrypt(data: string): string {
    if (data && data.length > 3) {
      // Gera IV data para cada criptografia (mais seguro)
      const iv = CryptoJS.lib.WordArray.random(16);

      // Criptografa com IV único
      const encrypted = CryptoJS.AES.encrypt(data, this.secretKey, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      });

      // Gera HMAC para verificar integridade dos dados
      const hmac = CryptoJS.HmacSHA256(
        iv.toString() + encrypted.toString(),
        this.secretKey,
      );

      // Retorna no formato: IV:ENCRYPTED:HMAC
      return `${iv.toString()}:${encrypted.toString()}:${hmac.toString()}`;
    }

    return '';
  }

  decrypt(encryptedData: string): string {
    if (encryptedData && encryptedData.length > 3) {
      // Verifica se é formato antigo (sem IV e HMAC) - retrocompatibilidade
      if (!encryptedData.includes(':')) {
        // Formato antigo - descriptografa normalmente
        const bytes = CryptoJS.AES.decrypt(encryptedData, this.secretKey);
        const decryptedData = bytes.toString(CryptoJS.enc.Utf8);
        if (!decryptedData)
          throw new Error('Falha na descriptografia - formato antigo');
        return decryptedData;
      }

      // Formato novo - com segurança reforçada
      const parts = encryptedData.split(':');
      if (parts.length !== 3) {
        throw new Error('Formato de dados inválido');
      }

      const [ivHex, encryptedText, hmacHex] = parts;

      // Verifica integridade dos dados
      const expectedHmac = CryptoJS.HmacSHA256(
        ivHex + encryptedText,
        this.secretKey,
      ).toString();

      if (hmacHex !== expectedHmac) {
        throw new Error('Dados foram modificados ou chave incorreta');
      }

      // Descriptografa com o IV original
      const iv = CryptoJS.enc.Hex.parse(ivHex);
      const bytes = CryptoJS.AES.decrypt(encryptedText, this.secretKey, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      });

      const decryptedData = bytes.toString(CryptoJS.enc.Utf8);
      if (!decryptedData)
        throw new Error('Falha na descriptografia - formato novo');
      return decryptedData;
    }

    return '';
  }
}

export const encryptionHelper = new EncryptionHelper(process.env.ENCRYPTION_KEY!);
