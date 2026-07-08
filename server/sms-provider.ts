export interface AvailableNumberToPurchase {
  phoneNumber: string;
  friendlyName: string;
  locality: string;
  region: string;
  isoCountry: string;
  smsCapable: boolean;
  mmsCapable: boolean;
  voiceCapable: boolean;
  addressRequired: boolean;
  monthlyFee?: number;
  /** Provider-specific metadata (e.g. regulatory_requirements for Telnyx France) */
  providerData?: Record<string, unknown>;
}

export interface PurchasedNumber {
  sid: string;
  phoneNumber: string;
  friendlyName: string;
}

export interface ProviderPhoneNumber {
  sid: string;
  phoneNumber: string;
  smsCapable: boolean;
}

export interface SmsProvider {
  isConfigured(): boolean;
  listNumbers(): Promise<ProviderPhoneNumber[]>;
  searchAvailableNumbers(countryCode: string, limit?: number): Promise<AvailableNumberToPurchase[]>;
  purchasePhoneNumber(phoneNumber: string, friendlyName?: string, smsCapable?: boolean, providerData?: Record<string, unknown>): Promise<PurchasedNumber | null>;
  releasePhoneNumber(providerId: string): Promise<boolean>;
  checkNumberActive(providerId: string): Promise<boolean>;
}

const registry: Record<string, SmsProvider> = {};

export function registerProvider(name: string, provider: SmsProvider): void {
  registry[name] = provider;
}

export function getProvider(name: string): SmsProvider {
  const p = registry[name];
  if (!p) throw new Error(`Unknown SMS provider: ${name}`);
  return p;
}

export function isProviderConfigured(name: string): boolean {
  return !!registry[name]?.isConfigured();
}

export function allConfiguredProviders(): string[] {
  return Object.entries(registry)
    .filter(([, p]) => p.isConfigured())
    .map(([name]) => name);
}
