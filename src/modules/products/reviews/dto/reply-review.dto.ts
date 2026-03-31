import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ReplyReviewDto {
  @IsString()
  @IsNotEmpty({ message: 'Nội dung phản hồi không được để trống' })
  @MaxLength(1000, { message: 'Nội dung phản hồi không được quá 1000 ký tự' })
  content: string;
}
