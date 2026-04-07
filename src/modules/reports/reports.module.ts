import { Module } from '@nestjs/common';
import { DashboardModule } from './dashboard/dashboard.module';
import { InventoryReportsModule } from './inventory/inventory-reports.module';
import { BusinessReportsModule } from './business/business-reports.module';

@Module({
  imports: [
    DashboardModule,
    InventoryReportsModule,
    BusinessReportsModule,
    // ExportModule,
  ],
  controllers: [],
  providers: [],
  exports: [DashboardModule, InventoryReportsModule, BusinessReportsModule],
})
export class ReportsModule {}
