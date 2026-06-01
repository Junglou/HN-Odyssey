import type { UserAddress } from "../types/user";
import type { AddressFormData } from "../components/profile/AddressManagement/AddressModal/AddressModal";

export interface CustomerAddressApiResponse {
  _id?: string;
  name?: string;
  phone?: string;
  street?: string;
  city_code?: string;
  district_code?: string;
  ward_code?: string;
  is_default?: boolean;
}

const formatLocationLabel = (
  wardCode?: string,
  districtCode?: string,
  cityCode?: string,
): string => {
  return [wardCode, districtCode, cityCode].filter(Boolean).join(", ");
};

export const mapCustomerAddressFromApi = (
  address: CustomerAddressApiResponse,
): UserAddress => {
  const cityCode = address.city_code ?? "";
  const districtCode = address.district_code ?? "";
  const wardCode = address.ward_code ?? "";

  return {
    id: address._id ? String(address._id) : "",
    receiverName: address.name ?? "",
    phone: address.phone ?? "",
    address: address.street ?? "",
    city: formatLocationLabel(wardCode, districtCode, cityCode) || cityCode,
    country: "Vietnam",
    cityCode,
    districtCode,
    wardCode,
    isDefault: Boolean(address.is_default),
  };
};

export const mapFormDataToCreatePayload = (
  data: AddressFormData,
  existing?: UserAddress | null,
) => ({
  name: data.receiverName.trim(),
  phone: existing?.phone?.trim() || "0900000000",
  street: data.address.trim(),
  city_code: existing?.cityCode || data.city.trim(),
  district_code: existing?.districtCode || data.country.trim(),
  ward_code: existing?.wardCode || data.city.trim(),
  is_default: existing?.isDefault ?? false,
});

export const mapFormDataToUpdatePayload = (
  data: AddressFormData,
  existing: UserAddress,
) => ({
  name: data.receiverName.trim(),
  phone: existing.phone.trim(),
  street: data.address.trim(),
  city_code: existing.cityCode,
  district_code: existing.districtCode,
  ward_code: existing.wardCode,
  is_default: existing.isDefault,
});
