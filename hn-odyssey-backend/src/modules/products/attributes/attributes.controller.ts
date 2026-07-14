import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Ip,
  Headers,
} from '@nestjs/common';
import { AttributesService } from './attributes.service';
import { CreateAttributeDto } from './dto/create-attribute.dto';
import { UpdateAttributeDto } from './dto/update-attribute.dto';
import { RequirePermissions } from 'src/common/decorators/permissions.decorator';
import { Action, Resource } from 'src/common/enums/resource.enum';
import { Public } from 'src/common/decorators/public.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { IUser } from 'src/common/interfaces/user.interface';

@Controller('attributes')
export class AttributesController {
  constructor(private readonly attributesService: AttributesService) {}

  // 1. TẠO MỚI
  @Post()
  @RequirePermissions(Resource.ATTRIBUTES, Action.CREATE)
  create(
    @Body() createAttributeDto: CreateAttributeDto,
    @CurrentUser() user: IUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.attributesService.create(
      createAttributeDto,
      user._id,
      ip,
      userAgent,
    );
  }

  // 2. DANH SÁCH
  @Get()
  @Public()
  findAll() {
    return this.attributesService.findAll();
  }

  // 3. CHI TIẾT
  @Get(':id')
  @Public()
  findOne(@Param('id') id: string) {
    return this.attributesService.findOne(id);
  }

  // 4. CẬP NHẬT
  @Patch(':id')
  @RequirePermissions(Resource.ATTRIBUTES, Action.UPDATE)
  update(
    @Param('id') id: string,
    @Body() updateAttributeDto: UpdateAttributeDto,
    @CurrentUser() user: IUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.attributesService.update(
      id,
      updateAttributeDto,
      user._id,
      ip,
      userAgent,
    );
  }

  // 5. XÓA
  @Delete(':id')
  @RequirePermissions(Resource.ATTRIBUTES, Action.DELETE)
  remove(
    @Param('id') id: string,
    @CurrentUser() user: IUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.attributesService.remove(id, user._id, ip, userAgent);
  }
}
