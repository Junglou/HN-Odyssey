import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AttributesService } from './attributes.service';
import { AttributesController } from './attributes.controller';
import { Attribute, AttributeSchema } from './schemas/attribute.schema';
import { Product, ProductSchema } from '../catalog/schemas/product.schema';
import { Role, RoleSchema } from 'src/modules/users/roles/schemas/role.schema';
import { SearchModule } from 'src/modules/search/search.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Attribute.name, schema: AttributeSchema },
      { name: Product.name, schema: ProductSchema },
      { name: Role.name, schema: RoleSchema },
    ]),
    SearchModule,
  ],
  controllers: [AttributesController],
  providers: [AttributesService],
  exports: [AttributesService],
})
export class AttributesModule {}
