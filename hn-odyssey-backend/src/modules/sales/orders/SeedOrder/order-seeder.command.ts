import { Command } from 'nestjs-command';
import { Injectable, Logger } from '@nestjs/common';
import { OrderSeederService } from './order-seeder.service';

@Injectable()
export class OrderSeederCommand {
  private readonly logger = new Logger(OrderSeederCommand.name);

  constructor(private readonly orderSeederService: OrderSeederService) {}

  // Định nghĩa tên lệnh là 'seed:orders'
  @Command({
    command: 'seed:orders',
    describe: 'Tạo 1000 dữ liệu giả cho collection Orders',
  })
  async createOrders() {
    this.logger.log('Bắt đầu chạy command seed:orders...');
    // Bạn có thể truyền tham số vào đây nếu muốn linh hoạt số lượng
    await this.orderSeederService.seedOrders(4000);
    this.logger.log('Command seed:orders hoàn thành.');
  }

  // THÊM LỆNH MỚI NÀY VÀO ĐỂ XUẤT FILE CSV
  @Command({
    command: 'seed:export-csv',
    describe: 'Xuất Orders ra file CSV cho Algolia',
  })
  async exportCsv() {
    this.logger.log('Đang chạy lệnh xuất file CSV...');
    await this.orderSeederService.exportToAlgoliaCSV();
    this.logger.log('Hoàn thành lệnh xuất file.');
  }
}
