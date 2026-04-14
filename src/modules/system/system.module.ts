import { Module } from '@nestjs/common';
import { SystemMonitoringModule } from './monitoring/system-monitoring.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';

@Module({
  imports: [SystemMonitoringModule, AuditLogsModule],
  controllers: [],
  providers: [],
  exports: [SystemMonitoringModule, AuditLogsModule],
})
export class SystemModule {}
