import { IsBoolean } from 'class-validator';

export class ChangeRoleStatusDto {
  @IsBoolean()
  is_active: boolean;
}
