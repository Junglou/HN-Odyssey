import { IsEmail, IsNotEmpty, ValidateNested, Length } from 'class-validator';
import { Type } from 'class-transformer';
import { ShippingInfoDto } from './create-order.dto';

export class InitGuestCheckoutDto {
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => ShippingInfoDto)
  shippingInfo: ShippingInfoDto;

  @IsNotEmpty()
  cartSessionId: string; // Session ID của giỏ hàng hiện tại
}

export class VerifyGuestOtpDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @Length(6, 6)
  otpCode: string;

  @IsNotEmpty()
  cartSessionId: string;
}
