// src/cli.ts
import { NestFactory } from '@nestjs/core';
import { CommandModule, CommandService } from 'nestjs-command';
import { AppModule } from './app.module';

async function bootstrap() {
  // Chỉ tạo ApplicationContext, không mở cổng HTTP (port 3000)
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'], // Giữ lại log để dễ theo dõi
  });

  try {
    // Thực thi lệnh được truyền từ terminal
    await app.select(CommandModule).get(CommandService).exec();
    await app.close(); // Tự động đóng kết nối DB và thoát script khi chạy xong
  } catch (error) {
    console.error('Lỗi khi chạy Command:', error);
    await app.close();
    process.exit(1);
  }
}
void bootstrap();
