import {
  IsEmail,
  IsNotEmpty,
  ValidateNested,
  Length,
  Matches,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ShippingInfoDto } from './create-order.dto';
import { ApiProperty } from '@nestjs/swagger';

export class InitGuestCheckoutDto {
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => ShippingInfoDto)
  shippingInfo: ShippingInfoDto;

  @IsNotEmpty()
  cartSessionId: string; // Session ID của giỏ hàng hiện tại

  @ApiProperty({ example: '0901234567' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^(03|05|07|08|09)+([0-9]{8})$/, {
    message: 'Số điện thoại không hợp lệ (Phải có 10 số và đúng đầu số VN)',
  })
  phone: string;
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
