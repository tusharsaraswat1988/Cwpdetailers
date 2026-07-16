/**
 * Address Domain — version markers.
 * V2+ can coexist without replacing V1 consumers.
 */

export const ADDRESS_DOMAIN_VERSION = "AddressDomainV1" as const;
export const ADDRESS_CAPABILITY_VERSION = "AddressCapabilityV1" as const;

export type AddressDomainVersion = typeof ADDRESS_DOMAIN_VERSION;
export type AddressCapabilityVersion = typeof ADDRESS_CAPABILITY_VERSION;
