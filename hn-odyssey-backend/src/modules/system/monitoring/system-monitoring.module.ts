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
import { AuthSession, AuthSessionSchema } from './schemas/auth-session.schema';
import { PerformanceMonitorInterceptor } from 'src/common/interceptors/performance-monitor.interceptor';
import { SecurityMonitorListener } from './listeners/security-monitor.listener';
import { MonitoringController } from './monitoring.controller';
import { AxiosMonitorSetup } from './axios-monitor.setup';
import { NotificationsModule } from 'src/modules/notifications/notifications.module';
import { MonitoringService } from './monitoring.service';
import {
  AuditLog,
  AuditLogSchema,
} from '../audit-logs/schemas/audit-log.schema';

@Module({
  imports: [
    TerminusModule,
    NotificationsModule,
    MongooseModule.forFeature([
      { name: SystemMetric.name, schema: SystemMetricSchema },
      { name: IntegrationLog.name, schema: IntegrationLogSchema },
      { name: AuthSession.name, schema: AuthSessionSchema },
      { name: AuditLog.name, schema: AuditLogSchema },
    ]),
  ],
  controllers: [MonitoringController],
  providers: [
    AxiosMonitorSetup,
    SecurityMonitorListener,
    MonitoringService,
    {
      provide: APP_INTERCEPTOR,
      useClass: PerformanceMonitorInterceptor, // Bật đo lường hiệu năng Server toàn cục
    },
  ],
})
export class SystemMonitoringModule {}
