import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Ip,
  Headers,
} from '@nestjs/common';
import { TagsService } from './tags.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { TagScope } from '../../../common/enums/tag-scope.enum';
import { MergeTagsDto } from './dto/merge-tag.dto';
import { RequirePermissions } from 'src/common/decorators/permissions.decorator';
import { Action, Resource } from 'src/common/enums/resource.enum';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { IUser } from 'src/common/interfaces/user.interface';
import { Public } from 'src/common/decorators/public.decorator';

@Controller('tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Post()
  @RequirePermissions(Resource.CATALOG_TAGS, Action.CREATE)
  create(
    @Body() createTagDto: CreateTagDto,
    @CurrentUser() user: IUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.tagsService.create(createTagDto, user._id, ip, userAgent);
  }

  // 1. DÀNH CHO PORTAL ADMIN (Quản lý Tag, lấy tất cả)
  @Get()
  @RequirePermissions(Resource.CATALOG_TAGS, Action.READ)
  findAllAdmin(@Query('scope') scope?: TagScope) {
    return this.tagsService.findAll(scope);
  }

  // 2. DÀNH CHO CLIENT PUBLIC (Lọc sản phẩm, chỉ lấy Tag đang hiển thị)
  @Get('public/active')
  @Public()
  findAllPublic(@Query('scope') scope?: TagScope) {
    // Tương tự, gọi hàm service chỉ lấy các Tag có is_active = true
    return this.tagsService.findActiveTags(scope);
  }

  @Patch(':id')
  @RequirePermissions(Resource.CATALOG_TAGS, Action.UPDATE)
  update(
    @Param('id') id: string,
    @Body() updateTagDto: UpdateTagDto,
    @CurrentUser() user: IUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.tagsService.update(id, updateTagDto, user._id, ip, userAgent);
  }

  @Delete(':id')
  @RequirePermissions(Resource.CATALOG_TAGS, Action.DELETE)
  remove(
    @Param('id') id: string,
    @CurrentUser() user: IUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.tagsService.remove(id, user._id, ip, userAgent);
  }

  @Post('merge')
  @RequirePermissions(Resource.CATALOG_TAGS, Action.UPDATE)
  merge(
    @Body() mergeDto: MergeTagsDto,
    @CurrentUser() user: IUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.tagsService.mergeTags(
      mergeDto.targetTagId,
      mergeDto.sourceTagId,
      user._id,
      ip,
      userAgent,
    );
  }
}
