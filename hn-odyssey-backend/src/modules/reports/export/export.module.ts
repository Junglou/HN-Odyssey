import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ExportController } from './export.controller';
import { ExportReportService } from './export.service';
import { ExportReportProcessor } from './export.processor';
import { BusinessReportsModule } from '../business/business-reports.module';
import { NotificationsModule } from 'src/modules/notifications/notifications.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'export-reports',
    }),
    BusinessReportsModule,
    NotificationsModule,
  ],
  controllers: [ExportController],
  providers: [ExportReportService, ExportReportProcessor],
  exports: [ExportReportService],
})
export class ExportModule {}
