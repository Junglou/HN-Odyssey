import { IsBoolean } from 'class-validator';

// Dùng chung cho các route bật/tắt dạng is_active (Category, Attribute...)
export class ChangeActiveStatusDto {
  @IsBoolean()
  is_active: boolean;
}
