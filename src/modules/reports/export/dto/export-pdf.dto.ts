import { IsString, IsNotEmpty } from 'class-validator';

export class ExportPdfDto {
  @IsString()
  @IsNotEmpty()
  chartImageBase64: string;

  @IsString()
  @IsNotEmpty()
  title: string;
}
