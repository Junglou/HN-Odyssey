import { IsArray, IsNotEmpty, IsString } from 'class-validator';

export class AcceptOrderDto {
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  order_ids: string[]; // Hỗ trợ tiếp nhận hàng loạt (AC8)
}
