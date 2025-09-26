export interface CreateCustomerData {
  fullName: string;
  email: string;
  document: string;
  phone: string;
}

export interface CreateCustomerAddressData {
  zipcode: string;
  city: string;
  state: string;
  street: string;
  district: string;
  number: string;
  country: string;
  complement?: string;
  isDefault?: boolean;
  customerId: string;
}

export interface UpdateCustomerConfigData {
  emailMarketingEnabled?: boolean;
  smsMarketingEnabled?: boolean;
  taxExemptEnabled?: boolean;
  key?: string;
  value?: string;
}
