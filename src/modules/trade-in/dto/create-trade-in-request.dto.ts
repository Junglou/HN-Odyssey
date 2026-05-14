import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsInt,
  Min,
  Max,
  IsMongoId,
  IsOptional,
  IsEnum,
  ArrayMinSize,
  IsEmail,
  IsBoolean,
  Equals,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PayoutMethod, EvaluationMethod } from 'src/common/enums/trade-in.enum';

// THÊM MỚI: DTO cho Shipping Address
export class ShippingAddressDto {
  @IsString()
  @IsNotEmpty()
  street_address: string;

  @IsString()
  @IsOptional()
  apt_suite?: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  state: string;

  @IsString()
  @IsNotEmpty()
  zip_code: string;
}

export class CreateTradeInRequestDto {
  // --- THÔNG TIN LIÊN HỆ TỪ UI ---
  @IsString()
  @IsNotEmpty()
  full_name: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  phone_number: string;

  // --- THÔNG TIN SẢN PHẨM ---
  @IsMongoId()
  @IsNotEmpty()
  category_id: string;

  @IsString()
  @IsNotEmpty() // UI bắt buộc nhập Product Description
  condition_description: string;

  // UI không có các trường này, chuyển thành Optional để không lỗi 400 Bad Request
  @IsMongoId()
  @IsOptional()
  product_id?: string;

  @IsString()
  @IsOptional()
  product_name?: string;

  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  condition_score?: number;

  // --- HÌNH ẢNH ---
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(3, { message: 'Vui lòng tải lên ít nhất 3 hình ảnh/video' })
  media_urls: string[];

  // --- PHƯƠNG THỨC THẨM ĐỊNH ---
  @IsEnum(EvaluationMethod)
  @IsNotEmpty()
  evaluation_method: EvaluationMethod;

  // Chỉ validate ShippingAddressDto nếu chọn SHIPPING
  @ValidateIf(
    (o: CreateTradeInRequestDto) =>
      o.evaluation_method === EvaluationMethod.SHIPPING,
  )
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  @IsNotEmpty()
  shipping_address?: ShippingAddressDto;

  // --- ĐIỀU KHOẢN ---
  @IsBoolean()
  @Equals(true, { message: 'Bạn phải đồng ý với Điều khoản & Chính sách' })
  agreed_to_terms: boolean;
}

export class AcceptValuationDto {
  @IsEnum(PayoutMethod)
  payout_method: PayoutMethod;

  @IsOptional()
  payout_details?: Record<string, string>;
}

export class InspectItemDto {
  @IsInt()
  actual_condition_score: number;

  @IsInt()
  proposed_final_value: number;

  @IsString()
  inspection_note: string;
}

export class CancelTradeInDto {
  @IsString()
  @IsOptional()
  cancel_note?: string;
}

export class ProvideInitialValuationDto {
  @IsInt()
  @Min(1000, { message: 'Giá trị dự kiến phải lớn hơn 0' })
  estimated_value: number;

  @IsString()
  @IsOptional()
  note?: string;
}
