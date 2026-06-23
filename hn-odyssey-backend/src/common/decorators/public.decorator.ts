import { SetMetadata } from '@nestjs/common';

// Key này dùng để đánh dấu metadata, Guard sẽ đọc key này
export const IS_PUBLIC_KEY = 'isPublic';

// Tạo decorator @Public()
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
