import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
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
import { SearchModule } from './modules/search/search.module';
import { MarketingModule } from './modules/marketing/marketing.module';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PaymentMonitorInterceptor } from './common/interceptors/payment-monitor.interceptor';
import { SecurityMonitorInterceptor } from './common/interceptors/security-monitor.interceptor';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { UebaMonitorInterceptor } from './common/interceptors/ueba-monitor.interceptor';
import { ReportsModule } from './modules/reports/reports.module';

@Module({
  imports: [
    RedisModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'single',
        url: configService.get<string>('REDIS_URL') || 'redis://localhost:6379',
      }),
      inject: [ConfigService],
    }),

    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
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
    SearchModule,
    MarketingModule,
    NotificationsModule,
    ReportsModule,
    EventEmitterModule.forRoot(),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    //1. Xác thực danh tính trước (Ai đang đăng nhập?)
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // 2. Kiểm tra vai trò lớn (Có phải Admin không? Nếu không thì chặn luôn)
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    // 3. Kiểm tra quyền chi tiết (Có được sửa user này không?)
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: SecurityMonitorInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: PaymentMonitorInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: UebaMonitorInterceptor,
    },
  ],
})
export class AppModule {}
