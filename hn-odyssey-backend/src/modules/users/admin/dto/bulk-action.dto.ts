import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsString,
  ArrayNotEmpty,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BulkChangeStatusDto {
  @ApiProperty({
    description: 'Danh sách ID nhân viên',
    example: ['id1', 'id2'],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  userIds: string[];

  @ApiProperty({ description: 'Trạng thái muốn cập nhật' })
  @IsNotEmpty()
  @IsBoolean()
  is_active: boolean;
}

export class BulkDeleteDto {
  @ApiProperty({ description: 'Danh sách ID nhân viên cần xóa' })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  userIds: string[];
}
