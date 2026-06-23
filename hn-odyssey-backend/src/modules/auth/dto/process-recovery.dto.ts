import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ProcessRecoveryDto {
  @ApiProperty({ enum: ['APPROVED', 'REJECTED'] })
  @IsNotEmpty()
  @IsEnum(['APPROVED', 'REJECTED'])
  status: string;

  @ApiProperty({ description: 'Bắt buộc nếu Từ chối (AC5)' })
  @IsOptional()
  @IsString()
  rejection_reason?: string;
}
