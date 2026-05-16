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
import { PageConfig, PageConfigSchema } from './schemas/page-config.schema';
import { Media, MediaSchema } from './schemas/media-record.schema';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Banner.name, schema: BannerSchema },
      { name: BlogPost.name, schema: BlogPostSchema },
      { name: StaticPage.name, schema: StaticPageSchema },
      { name: MenuConfig.name, schema: MenuConfigSchema },
      { name: PageConfig.name, schema: PageConfigSchema },
      { name: Media.name, schema: MediaSchema },
    ]),
    RolesModule,
    AuditLogsModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [ContentController, MediaController],
  providers: [ContentService, MediaService],
  exports: [ContentService, MediaService],
})
export class ContentModule {}
