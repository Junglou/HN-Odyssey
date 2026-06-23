import {
  IsArray,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsString,
  IsOptional,
} from 'class-validator';
import { UserStatus } from 'src/common/enums/user-status.enum';

export class BulkUpdateStatusDto {
  @IsArray()
  @IsMongoId({ each: true, message: 'Danh sách ID không hợp lệ' })
  customerIds: string[];

  @IsEnum(UserStatus)
  @IsNotEmpty()
  status: UserStatus;

  @IsString()
  @IsOptional()
  reason?: string;
}

export class BulkDeleteDto {
  @IsArray()
  @IsMongoId({ each: true, message: 'Danh sách ID không hợp lệ' })
  customerIds: string[];

  @IsOptional()
  @IsString()
  reason?: string;
}
