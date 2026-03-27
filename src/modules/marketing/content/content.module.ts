import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';

import { ContentService } from './content.service';
import { ContentController } from './content.controller';

import { Banner, BannerSchema } from './schemas/banner.schema';
import { BlogPost, BlogPostSchema } from './schemas/blog-post.schema';
import { StaticPage, StaticPageSchema } from './schemas/static-page.schema';
import { MenuConfig, MenuConfigSchema } from './schemas/menu-config.schema';

import { RolesModule } from 'src/modules/users/roles/roles.module';
import { AuditLogsModule } from 'src/modules/system/audit-logs/audit-logs.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Banner.name, schema: BannerSchema },
      { name: BlogPost.name, schema: BlogPostSchema },
      { name: StaticPage.name, schema: StaticPageSchema },
      { name: MenuConfig.name, schema: MenuConfigSchema },
    ]),
    RolesModule,
    AuditLogsModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [ContentController],
  providers: [ContentService],
  exports: [ContentService],
})
export class ContentModule {}
