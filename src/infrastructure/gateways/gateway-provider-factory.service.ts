import { provider, provider_environment, provider_name } from '@prisma/client';
import { encryptionHelper } from 'src/common/utils/encryption.util';
import { providers } from '.';
import { AxisBankingGatewayProvider } from './payment-gateways/axis-banking.gateway';
import { CacheService } from '../cache/cache.service';

export type ProviderClassTypeof = typeof AxisBankingGatewayProvider;

export class GatewayProviderFactoryService {
  constructor(private readonly cacheService: CacheService) {}

  async createProviderInstance(provider: provider) {
    const providerName: provider_name = provider.name!;
    const providerEnvironment: provider_environment = provider.environment!;
    const providerPublicKeyCashin: string | null = encryptionHelper.decrypt(
      provider.public_key_cashin!,
    );
    const providerSecretKeyCashin: string | null = encryptionHelper.decrypt(
      provider.secret_key_cashin!,
    );
    const providerPublicKeyCashout: string | null = encryptionHelper.decrypt(
      provider.public_key_cashout!,
    );
    const providerSecretKeyCashout: string | null = encryptionHelper.decrypt(
      provider.secret_key_cashout!,
    );
    const providerCertCrtCashin: string | null = provider.cert_crt_cashin;
    const providerCertKeyCashin: string | null = provider.cert_crt_cashin;
    const providerCertCrtCashout: string | null = provider.cert_crt_cashout;
    const providerCertKeyCashout: string | null = provider.cert_key_cashout;
    const providerBaseUrl: string | null = provider.base_url;
    const providerReceiverId: string | null = provider.receiver_id;

    let ProviderClass: ProviderClassTypeof | undefined;

    if (process.env.NODE_ENV === 'STAGING') {
      ProviderClass = providers.find(
        (p) => p.providerName === 'AXIS_BANKING',
      ) as ProviderClassTypeof;
    } else {
      ProviderClass = providers.find(
        (p) => p.providerName === providerName,
      ) as ProviderClassTypeof;
    }

    if (!ProviderClass) {
      throw new Error(`Unsupported provider: ${providerName}`);
    }

    const providerInstance = new ProviderClass(
      providerPublicKeyCashin,
      providerSecretKeyCashin,
      providerPublicKeyCashout,
      providerSecretKeyCashout,
      providerCertCrtCashin,
      providerCertKeyCashin,
      providerCertCrtCashout,
      providerCertKeyCashout,
      providerReceiverId,
      providerEnvironment,
      providerBaseUrl,
      this.cacheService,
      provider.id,
    );

    return {
      providerInstance,
      providerName,
    };
  }
}
