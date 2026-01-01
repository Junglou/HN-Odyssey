import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AdminModule } from './modules/users/admin/admin.module';
import { CategoriesModule } from './modules/products/categories/categories.module';
import { AuditLogsModule } from './modules/system/audit-logs/audit-logs.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { UploadModule } from './modules/system/upload/upload.module';
import { ProductsModule } from './modules/products/products.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { RolesModule } from './modules/users/roles/roles.module';
import { ScheduleModule } from '@nestjs/schedule';
import { SalesModule } from './modules/sales/sales.module';
import { RedisModule } from '@nestjs-modules/ioredis';

@Module({
  imports: [
    RedisModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        type: 'single',
        url: configService.get<string>('REDIS_URL') || 'redis://localhost:6379',
      }),
      inject: [ConfigService],
    }),

    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGO_URL'),
      }),
      inject: [ConfigService],
    }),

    ConfigModule.forRoot({
      isGlobal: true,
    }),

    ScheduleModule.forRoot(),

    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'), // Trỏ ra thư mục uploads ở root
      serveRoot: '/uploads', // Prefix URL: http://localhost:3000/uploads/...
    }),

    AuthModule,
    UsersModule,
    AdminModule,
    CategoriesModule,
    AuditLogsModule,
    UploadModule,
    ProductsModule,
    InventoryModule,
    RolesModule,
    SalesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // // Đăng ký JwtAuthGuard cho toàn bộ ứng dụng (trừ các route @Public())
    // {
    //   provide: APP_GUARD,
    //   useClass: JwtAuthGuard,
    // },
    // // Đăng ký RolesGuard để kiểm tra phân quyền sau khi JWT đã xác thực
    // {
    //   provide: APP_GUARD,
    //   useClass: RolesGuard,
    // },
  ],
})
export class AppModule {}
