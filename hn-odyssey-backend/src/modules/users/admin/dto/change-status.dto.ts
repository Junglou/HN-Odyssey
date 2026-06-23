import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserStatus } from 'src/common/enums/user-status.enum';

export class ChangeStatusDto {
  @ApiProperty({
    enum: UserStatus,
    description:
      'Trạng thái mới: ACTIVE, INACTIVE (Tạm khóa), BANNED (Nghỉ việc)',
  })
  @IsEnum(UserStatus, { message: 'Trạng thái không hợp lệ' })
  @IsNotEmpty()
  status: UserStatus;

  @ApiProperty({ example: 'Vi phạm quy tắc', description: 'Lý do thay đổi' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
