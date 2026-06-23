import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Patch,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AddressesService } from './addresses.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';

@ApiTags('Addresses (Sổ địa chỉ)')
@Controller('users/addresses')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CUSTOMER)
@ApiBearerAuth()
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Get()
  @ApiOperation({ summary: 'AC1: Lấy danh sách sổ địa chỉ' })
  async getMyAddresses(@CurrentUser('_id') userId: string) {
    return this.addressesService.getMyAddresses(userId);
  }

  @Post()
  @ApiOperation({ summary: 'AC2 -> AC5, AC8: Thêm địa chỉ mới' })
  async createAddress(
    @CurrentUser('_id') userId: string,
    @Body() dto: CreateAddressDto,
  ) {
    return this.addressesService.createAddress(userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'AC2, AC4, AC9: Chỉnh sửa địa chỉ' })
  async updateAddress(
    @CurrentUser('_id') userId: string,
    @Param('id') addressId: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.addressesService.updateAddress(userId, addressId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'AC6, AC7, AC9: Xóa địa chỉ' })
  async deleteAddress(
    @CurrentUser('_id') userId: string,
    @Param('id') addressId: string,
  ) {
    return this.addressesService.deleteAddress(userId, addressId);
  }
}
