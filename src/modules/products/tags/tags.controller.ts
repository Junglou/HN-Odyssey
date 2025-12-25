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

@Controller('tags')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Post()
  @RequirePermissions(Resource.TAGS, Action.CREATE)
  create(
    @Body() createTagDto: CreateTagDto,
    @Req() req,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.tagsService.create(
      createTagDto,
      req.user.userId,
      ip,
      userAgent,
    );
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
    @Req() req,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.tagsService.update(
      id,
      updateTagDto,
      req.user.userId,
      ip,
      userAgent,
    );
  }

  @Delete(':id')
  @Roles(Role.MANAGER, Role.SUPER_ADMIN)
  @RequirePermissions(Resource.TAGS, Action.DELETE)
  remove(
    @Param('id') id: string,
    @Req() req,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.tagsService.remove(id, req.user.userId, ip, userAgent);
  }

  @Post('merge')
  @Roles(Role.MANAGER, Role.SUPER_ADMIN)
  @RequirePermissions(Resource.TAGS, Action.UPDATE)
  merge(
    @Body() mergeDto: MergeTagsDto,
    @Req() req,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.tagsService.mergeTags(
      mergeDto.targetTagId,
      mergeDto.sourceTagId,
      req.user.userId,
      ip,
      userAgent,
    );
  }
}
