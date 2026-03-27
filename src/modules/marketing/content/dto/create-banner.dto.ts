import {
  IsDateString,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateBannerDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  // AC5: Cho phép lưu cả đường dẫn tuyệt đối (HTTP/HTTPS) và đường dẫn tương đối nội bộ
  @IsString({ message: 'Đường dẫn phải là một chuỗi ký tự' })
  @IsNotEmpty({ message: 'Đường dẫn không được để trống' })
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
