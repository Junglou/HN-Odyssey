import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';
import { DiscountType } from '../../promotions/schemas/coupon.schema';
import { PaginationQueryDto } from 'src/common/dtos/pagination-query.dto';

export enum RewardCategory {
  VOUCHER = 'VOUCHER',
  PHYSICAL_GIFT = 'PHYSICAL_GIFT',
}

export class RedeemRewardDto {
  @IsInt()
  @Min(100, { message: 'Cần tối thiểu 100 điểm để đổi thưởng' })
  points_to_redeem: number;

  @IsEnum(RewardCategory)
  reward_category: RewardCategory;

  @ValidateIf(
    (o: RedeemRewardDto) => o.reward_category === RewardCategory.PHYSICAL_GIFT,
  )
  @IsNotEmpty({ message: 'Phải chọn quà tặng cụ thể' })
  @IsString()
  gift_id?: string;

  @ValidateIf(
    (o: RedeemRewardDto) => o.reward_category === RewardCategory.VOUCHER,
  )
  @IsNotEmpty({ message: 'Phải chọn loại giảm giá cho Voucher' })
  @IsEnum(DiscountType)
  discount_type?: DiscountType;
}

export class QueryLoyaltyHistoryDto extends PaginationQueryDto {}
