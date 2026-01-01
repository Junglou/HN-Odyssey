import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Req,
  Ip,
  Headers,
} from '@nestjs/common';
import { TagsService } from './tags.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { TagScope } from '../../../common/enums/tag-scope.enum';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { MergeTagsDto } from './dto/merge-tag.dto';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { RequirePermissions } from 'src/common/decorators/permissions.decorator';
import { Action, Resource } from 'src/common/enums/resource.enum';
import { Public } from 'src/common/decorators/public.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { IUser } from 'src/common/interfaces/user.interface';

@Controller('tags')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Post()
  @RequirePermissions(Resource.TAGS, Action.CREATE)
  create(
    @Body() createTagDto: CreateTagDto,
    @CurrentUser() user: IUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.tagsService.create(createTagDto, user._id, ip, userAgent);
  }

  @Get()
  @Public()
  findAll(@Query('scope') scope?: TagScope) {
    return this.tagsService.findAll(scope);
  }

  @Patch(':id')
  @RequirePermissions(Resource.TAGS, Action.UPDATE)
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
  @Roles(Role.MANAGER, Role.SUPER_ADMIN)
  @RequirePermissions(Resource.TAGS, Action.DELETE)
  remove(
    @Param('id') id: string,
    @CurrentUser() user: IUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.tagsService.remove(id, user._id, ip, userAgent);
  }

  @Post('merge')
  @Roles(Role.MANAGER, Role.SUPER_ADMIN)
  @RequirePermissions(Resource.TAGS, Action.UPDATE)
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
