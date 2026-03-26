// src/modules/marketing/content/content.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ContentService } from './content.service';
import { ContentController } from './content.controller';
import { Banner, BannerSchema } from './schemas/banner.schema';
import { RolesModule } from 'src/modules/users/roles/roles.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Banner.name, schema: BannerSchema }]),
    RolesModule,
  ],
  controllers: [ContentController],
  providers: [ContentService],
  exports: [ContentService],
})
export class ContentModule {}
