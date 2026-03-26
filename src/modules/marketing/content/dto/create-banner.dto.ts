import {
  IsDateString,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';

export class CreateBannerDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  // AC5: Kiểm tra tính hợp lệ của liên kết (Syntax Check HTTP/HTTPS)
  @IsUrl(
    { require_protocol: true },
    {
      message: 'Đường dẫn phải đúng định dạng và bắt đầu bằng http hoặc https',
    },
  )
  @IsNotEmpty()
  link: string;

  @IsString()
  @IsNotEmpty()
  position: string;

  @IsString()
  @IsNotEmpty()
  image_pc: string;

  @IsString()
  @IsNotEmpty()
  image_mobile: string;

  @IsDateString()
  @IsNotEmpty()
  start_date: string;

  @IsDateString()
  @IsNotEmpty()
  end_date: string;

  @IsOptional()
  @IsMongoId()
  category_id?: string;

  @IsOptional()
  @IsInt()
  display_order?: number;
}
