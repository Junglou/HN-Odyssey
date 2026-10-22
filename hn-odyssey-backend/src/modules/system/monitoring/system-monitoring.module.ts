import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TerminusModule } from '@nestjs/terminus';
import { APP_INTERCEPTOR } from '@nestjs/core';
import {
  SystemMetric,
  SystemMetricSchema,
} from './schemas/system-metric.schema';
import {
  IntegrationLog,
  IntegrationLogSchema,
} from './schemas/integration-log.schema';
import {
  SystemThreshold,
  SystemThresholdSchema,
} from './schemas/system-threshold.schema';
import { AuthSession, AuthSessionSchema } from './schemas/auth-session.schema';
import { PerformanceMonitorInterceptor } from 'src/common/interceptors/performance-monitor.interceptor';
import { SecurityMonitorListener } from './listeners/security-monitor.listener';
import { MonitoringController } from './monitoring.controller';
import { AxiosMonitorSetup } from './axios-monitor.setup';
import { NotificationsModule } from 'src/modules/notifications/notifications.module';
import {
  NotificationLog,
  NotificationLogSchema,
} from 'src/modules/notifications/schemas/notification-log.schema';
import { MonitoringService } from './monitoring.service';
import { CronMonitorService } from '../health/cron-monitor.service';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import {
  AuditLog,
  AuditLogSchema,
} from '../audit-logs/schemas/audit-log.schema';

@Module({
  imports: [
    TerminusModule,
    NotificationsModule,
    AuditLogsModule,
    MongooseModule.forFeature([
      { name: SystemMetric.name, schema: SystemMetricSchema },
      { name: IntegrationLog.name, schema: IntegrationLogSchema },
      { name: AuthSession.name, schema: AuthSessionSchema },
      { name: AuditLog.name, schema: AuditLogSchema },
      { name: SystemThreshold.name, schema: SystemThresholdSchema },
      { name: NotificationLog.name, schema: NotificationLogSchema },
    ]),
  ],
  controllers: [MonitoringController],
  providers: [
    AxiosMonitorSetup,
    SecurityMonitorListener,
    MonitoringService,
    CronMonitorService, // Trước đây chưa được đăng ký nên cron giám sát chưa từng chạy
    {
      provide: APP_INTERCEPTOR,
      useClass: PerformanceMonitorInterceptor, // Đo hiệu năng Server toàn cục
    },
  ],
})
export class SystemMonitoringModule {}
