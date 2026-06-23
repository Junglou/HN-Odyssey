import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateCouponDto } from './create-coupon.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { CouponStatus } from '../schemas/coupon.schema';

// Kế thừa toàn bộ thuộc tính của CreateCouponDto nhưng loại bỏ trường 'code'
// (AC6: Cấm chỉnh sửa "Tên mã giảm giá" sau khi đã tạo)
// PartialType giúp biến tất cả các trường còn lại thành không bắt buộc (Optional)
export class UpdateCouponDto extends PartialType(
  OmitType(CreateCouponDto, ['code'] as const),
) {
  @IsOptional()
  @IsEnum(CouponStatus)
  status?: CouponStatus;
}
