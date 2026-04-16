import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ComparisonController } from './comparison.controller';
import { ComparisonService } from './comparison.service';
import { ProductSchema } from '../catalog/schemas/product.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'Product', schema: ProductSchema }]),
  ],
  controllers: [ComparisonController],
  providers: [ComparisonService],
  exports: [ComparisonService],
})
export class ComparisonModule {}
