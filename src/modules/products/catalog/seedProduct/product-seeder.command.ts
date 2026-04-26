import { Command } from 'nestjs-command';
import { Injectable, Logger } from '@nestjs/common';
import { ProductSeederService } from './product-seeder.service';

@Injectable()
export class ProductSeederCommand {
  private readonly logger = new Logger(ProductSeederCommand.name);

  constructor(private readonly productSeederService: ProductSeederService) {}

  @Command({
    command: 'seed:products',
    describe: 'Tạo 50 dữ liệu giả cho collection Products',
  })
  async createProducts() {
    await this.productSeederService.seedProducts(50);
    this.logger.log('Command seed:products hoàn thành.');
  }
}
