import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsNumber,
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

export class ShippingAddressDto {
  @IsString() @IsNotEmpty() street_address: string;
  @IsString() @IsOptional() apt_suite?: string;
  @IsString() @IsNotEmpty() city: string;
  @IsString() @IsNotEmpty() state: string;
  @IsString() @IsNotEmpty() zip_code: string;
}

export class CreateTradeInRequestDto {
  @IsString() @IsNotEmpty() full_name: string;
  @IsEmail() @IsNotEmpty() email: string;
  @IsString() @IsNotEmpty() phone_number: string;
  @IsMongoId() @IsNotEmpty() category_id: string;
  @IsString() @IsNotEmpty() condition_description: string;
  @IsString() @IsOptional() product_name?: string;
  @IsArray() @IsString({ each: true }) @ArrayMinSize(3) media_urls: string[];
  @IsEnum(EvaluationMethod) @IsNotEmpty() evaluation_method: EvaluationMethod;

  @ValidateIf(
    (o: CreateTradeInRequestDto) =>
      o.evaluation_method === EvaluationMethod.SHIPPING,
  )
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  @IsNotEmpty()
  shipping_address?: ShippingAddressDto;

  @IsBoolean() @Equals(true) agreed_to_terms: boolean;
}

// Ứng với RejectTradeInModal
export class RejectTradeInDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}

// Ứng với FinalizeValueModal
export class FinalizeTradeInDto {
  @IsNumber()
  finalValue: number;

  @IsEnum(PayoutMethod)
  method: PayoutMethod;

  @IsString()
  @IsNotEmpty()
  note: string;
}

export class CancelTradeInDto {
  @IsString() @IsOptional() cancel_note?: string;
}
