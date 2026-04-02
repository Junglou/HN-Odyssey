import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { BlockReason } from 'src/common/enums/review.enum';

export class AdminConfirmActionDto {
  // Phản hồi (AC4)
  @IsOptional()
  @IsString()
  @MaxLength(500, {
    message: 'Nội dung phản hồi không được vượt quá 500 ký tự',
  })
  reply_content?: string;

  // Chặn người dùng (AC5)
  @IsOptional()
  @IsBoolean()
  block_customer?: boolean;

  @ValidateIf((o: AdminConfirmActionDto) => o.block_customer === true)
  @IsEnum(BlockReason, { message: 'Vui lòng chọn lý do chặn hợp lệ' })
  block_reason?: BlockReason;

  @ValidateIf(
    (o: AdminConfirmActionDto) => o.block_reason === BlockReason.OTHER,
  )
  @IsString()
  @MaxLength(255)
  block_reason_other?: string;
}
