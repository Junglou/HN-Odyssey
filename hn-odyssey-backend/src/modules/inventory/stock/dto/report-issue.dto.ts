import { IsNotEmpty, IsString } from 'class-validator';

export class ReportIssueDto {
  @IsNotEmpty()
  @IsString()
  order_id: string;

  @IsNotEmpty()
  @IsString()
  reason: string; // Lý do tạm giữ/gửi phản hồi (VD: "Khách sai địa chỉ", "Thiếu hàng")
}
