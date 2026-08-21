import { CreateServiceAddressForm } from "@/components/shared/address-picker/CreateServiceAddressForm";
import type { CustomerServiceAddressValue } from "@/components/shared/address-picker/addressForm";

export type { CustomerServiceAddressValue };

export { composeSavedAddress } from "../lib/serviceAddress";

type Props = {
  value: CustomerServiceAddressValue;
  onChange: (patch: Partial<CustomerServiceAddressValue>) => void;
  idPrefix?: string;
};

export function CustomerServiceAddressSection({
  value,
  onChange,
  idPrefix = "customer-address",
}: Props) {
  return (
    <CreateServiceAddressForm
      idPrefix={idPrefix}
      value={{
        formattedAddress: value.formattedAddress ?? "",
        googleComponents: value.googleComponents,
        ...value,
      }}
      onChange={onChange}
      embedded
    />
  );
}
