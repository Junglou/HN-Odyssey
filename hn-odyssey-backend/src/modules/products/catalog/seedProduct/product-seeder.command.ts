import { Command } from 'nestjs-command';
import { Injectable, Logger } from '@nestjs/common';
import { ProductSeederService } from './product-seeder.service';

@Injectable()
export class ProductSeederCommand {
  private readonly logger = new Logger(ProductSeederCommand.name);

  constructor(private readonly productSeederService: ProductSeederService) {}

  @Command({
    command: 'seed:products',
    describe: 'Tạo 100 dữ liệu giả cho collection Products',
  })
  async createProducts() {
    // Truyền tham số 100 để tạo 100 sản phẩm
    await this.productSeederService.seedProducts(100);
    this.logger.log('Command seed:products hoàn thành.');
  }
}
