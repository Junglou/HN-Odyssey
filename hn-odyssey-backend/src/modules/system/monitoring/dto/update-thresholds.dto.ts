import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class UpdateThresholdsDto {
  @Type(() => Number)
  @IsInt({ message: 'Ngưỡng CPU phải là số nguyên' })
  @Min(1, { message: 'Ngưỡng CPU tối thiểu là 1%' })
  @Max(100, { message: 'Ngưỡng CPU tối đa là 100%' })
  cpu: number;

  @Type(() => Number)
  @IsInt({ message: 'Ngưỡng RAM phải là số nguyên' })
  @Min(1, { message: 'Ngưỡng RAM tối thiểu là 1%' })
  @Max(100, { message: 'Ngưỡng RAM tối đa là 100%' })
  ram: number;

  @Type(() => Number)
  @IsInt({ message: 'Ngưỡng Disk phải là số nguyên' })
  @Min(1, { message: 'Ngưỡng Disk tối thiểu là 1%' })
  @Max(100, { message: 'Ngưỡng Disk tối đa là 100%' })
  disk: number;
}
