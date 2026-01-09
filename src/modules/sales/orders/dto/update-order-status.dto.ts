import { IsNotEmpty, IsOptional, IsString, IsEnum, IsBoolean } from 'class-validator';

export class UpdateOrderStatusDto {
  @IsNotEmpty()
  @IsString()
  status: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsBoolean()
  is_override?: boolean; 

  @IsOptional()
  @IsString()
  shipping_provider?: string;

  @IsOptional()
  @IsString()
  tracking_code?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
