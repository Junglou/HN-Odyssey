import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ReportReviewDto {
  @IsString()
  @IsNotEmpty({ message: 'Lý do báo cáo không được để trống' })
  @MaxLength(500, { message: 'Lý do không được quá 500 ký tự' })
  reason: string;
}
