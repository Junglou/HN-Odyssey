import { Module } from '@nestjs/common';
import { DashboardModule } from './dashboard/dashboard.module';
import { InventoryReportsModule } from './inventory/inventory-reports.module';
// Import thêm BusinessReportsModule, ExportModule... sau này

@Module({
  imports: [
    DashboardModule,
    InventoryReportsModule,
    // Bỏ comment các dòng dưới khi code xong các module tương ứng
    // BusinessReportsModule,
    // ExportModule,
  ],
  controllers: [],
  providers: [],
  exports: [DashboardModule, InventoryReportsModule],
})
export class ReportsModule {}
