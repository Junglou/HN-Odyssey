import { Module } from '@nestjs/common';
import { DashboardModule } from './dashboard/dashboard.module';
// Import thêm BusinessReportsModule, ExportModule... sau này

@Module({
  imports: [
    DashboardModule,
    // Bỏ comment các dòng dưới khi code xong các module tương ứng
    // BusinessReportsModule,
    // ExportModule,
  ],
  controllers: [],
  providers: [],
  exports: [DashboardModule],
})
export class ReportsModule {}
