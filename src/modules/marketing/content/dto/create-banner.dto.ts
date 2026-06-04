import {
  IsDateString,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class CreateBannerDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  // AC5: Cho phép lưu đường dẫn tuyệt đối (HTTP/HTTPS), đường dẫn nội bộ (/), HOẶC mã định danh vị trí (chứa chữ và dấu _)
  @IsString({ message: 'Đường dẫn phải là một chuỗi ký tự' })
  @IsNotEmpty({ message: 'Đường dẫn không được để trống' })
  @Matches(/^(https?:\/\/[^\s]+|\/[^\s]*|[a-zA-Z0-9_-]+)$/, {
    message:
      'Đường dẫn không hợp lệ. Phải là URL chuẩn (http/https), đường dẫn nội bộ (bắt đầu bằng /) hoặc mã vị trí (chỉ chứa chữ, số, dấu _ hoặc -).',
  })
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
