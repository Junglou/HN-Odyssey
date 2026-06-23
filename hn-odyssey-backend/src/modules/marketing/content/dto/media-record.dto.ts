import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsBoolean,
} from 'class-validator';
import { Transform } from 'class-transformer';
import * as xss from 'xss';
import { MediaStatus, MediaType } from '../schemas/media-record.schema';

// Định nghĩa cấu trúc rõ ràng để kiểm soát chặt chẽ kiểu dữ liệu của thư viện bên ngoài
interface XssFilterInterface {
  filterXSS(text: string): string;
}

// Ép kiểu an toàn thông qua unknown để triệt tiêu hoàn toàn lỗi no-unsafe từ ESLint
const xssFilter = xss as unknown as XssFilterInterface;

export interface QueryMediaInterface {
  page?: number;
  limit?: number;
  search?: string;
  status?: MediaStatus | 'All';
  type?: MediaType | 'All';
}

export class MediaMetadataDto {
  @IsEnum(MediaType)
  @IsNotEmpty()
  type: MediaType;

  @IsString()
  @IsNotEmpty()
  targetId: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }) => {
    // AC4: Loại bỏ mã HTML/Script tự động và ép kiểu string đầu ra tường minh
    return typeof value === 'string'
      ? String(xssFilter.filterXSS(value)) // Đã sửa filterXsubSS thành filterXSS
      : '';
  })
  altText: string;

  @IsEnum(MediaStatus)
  status: MediaStatus;
}

export class UpdateMediaInfoDto {
  @IsEnum(MediaType)
  @IsOptional()
  type?: MediaType;

  @IsString()
  @IsOptional()
  targetId?: string;

  @IsString()
  @IsOptional()
  // AC4: Đảm bảo kiểm tra kiểu dữ liệu đầu vào trước khi thực thi hàm filter
  @Transform(({ value }) =>
    typeof value === 'string' ? String(xssFilter.filterXSS(value)) : '',
  )
  altText?: string;

  @IsEnum(MediaStatus)
  @IsOptional()
  status?: MediaStatus;

  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;
}
