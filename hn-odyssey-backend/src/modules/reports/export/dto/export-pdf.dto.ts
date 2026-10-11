import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class ExportPdfDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^data:image\/(png|jpeg);base64,/, {
    message: 'Ảnh biểu đồ phải là PNG hoặc JPEG dạng base64.',
  })
  chartImageBase64: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  title: string;

  // US.95 AC3: kỳ báo cáo in trên PDF, ví dụ "Từ 01/10/2026 đến 09/10/2026"
  @IsOptional()
  @IsString()
  @MaxLength(150)
  period?: string;

  // Biểu đồ dạng ngang in khổ ngang để không bị thu nhỏ
  @IsOptional()
  @IsIn(['portrait', 'landscape'])
  orientation?: 'portrait' | 'landscape';
}
