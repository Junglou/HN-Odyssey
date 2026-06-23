import { IsEnum, IsString, IsNotEmpty } from 'class-validator';
import { UserStatus } from 'src/common/enums/user-status.enum';

export class UpdateCustomerStatusDto {
  @IsEnum(UserStatus)
  @IsNotEmpty()
  status: UserStatus;

  @IsString()
  @IsNotEmpty()
  reason: string;
}
