import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response, Request } from 'express';
import { TransactionsService } from './transactions.service';
import { CreateImportNoteDto } from './dto/create-import-note.dto';
import { GetTransactionsDto } from './dto/get-transactions.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { RequirePermissions } from 'src/common/decorators/permissions.decorator';
import { Action, Resource } from 'src/common/enums/resource.enum';
import { BaseResponse } from 'src/common/dtos/base-response.dto';
import { CreateExportNoteDto } from './dto/create-export-note.dto';

interface RequestUser {
  _id: string;
  email: string;
  roles: string[];
  userId: string;
}
interface RequestWithUser extends Request {
  user: RequestUser;
}

@Controller('inventory/transactions')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  // 1. NGHIỆP VỤ NHẬP KHO (IMPORT STOCK)

  @Post('import')
  @RequirePermissions(Resource.TRANSFERS, Action.CREATE)
  async createImportNote(
    @Body() dto: CreateImportNoteDto,
    @Req() req: RequestWithUser,
  ) {
    const actorId = req.user?._id;
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    if (!actorId) {
      throw new UnauthorizedException(
        'Không tìm thấy thông tin người thực hiện',
      );
    }

    const result = await this.transactionsService.createImportNote(
      dto,
      actorId,
      ip,
      userAgent,
    );

    return new BaseResponse(
      true,
      'Tạo phiếu nhập hàng và cập nhật tồn kho thành công',
      { transaction_code: result.transaction_code },
    );
  }

  @Get('import/history')
  @RequirePermissions(Resource.TRANSFERS, Action.READ)
  async getImportHistory(@Query() query: GetTransactionsDto) {
    const result = await this.transactionsService.getImportHistory(query);

    return new BaseResponse(
      true,
      'Lấy lịch sử nhập hàng thành công',
      result.data,
      {
        totalItems: result.total,
        itemCount: result.data.length,
        itemsPerPage: result.limit,
        totalPages: Math.ceil(result.total / result.limit),
        currentPage: result.page,
      },
    );
  }

  @Get('import/history/:id')
  @RequirePermissions(Resource.TRANSFERS, Action.READ)
  async getImportDetail(@Param('id') id: string) {
    const data = await this.transactionsService.getImportDetail(id);
    return new BaseResponse(true, 'Lấy chi tiết phiếu nhập thành công', data);
  }

  @Post('import/excel/preview')
  @RequirePermissions(Resource.TRANSFERS, Action.CREATE)
  @UseInterceptors(
    FileInterceptor('file', {
      fileFilter: (req, file, cb) => {
        if (!file.originalname.match(/\.(xls|xlsx)$/)) {
          return cb(
            new BadRequestException(
              'Chỉ chấp nhận file định dạng Excel (.xls, .xlsx)',
            ),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async previewExcelImport(@UploadedFile() file: Express.Multer.File) {
    const result = await this.transactionsService.previewExcelImport(file);
    return new BaseResponse(
      true,
      'Đọc file Excel thành công. Vui lòng kiểm tra dữ liệu xem trước.',
      result,
    );
  }

  @Get('import/history/export/excel')
  @RequirePermissions(Resource.TRANSFERS, Action.EXPORT)
  async exportHistoryExcel(
    @Query() query: GetTransactionsDto,
    @Res() res: Response,
  ) {
    await this.transactionsService.exportHistoryExcel(query, res);
    // Lưu ý: thư viện exceljs workbook.xlsx.write(res) sẽ tự động end stream
  }

  @Get('import/history/export/excel/:id')
  @RequirePermissions(Resource.TRANSFERS, Action.EXPORT)
  async exportDetailExcel(@Param('id') id: string, @Res() res: Response) {
    await this.transactionsService.exportDetailExcel(id, res);
  }

  // 2. NGHIỆP VỤ XUẤT KHO (EXPORT STOCK)

  @Post('export')
  @RequirePermissions(Resource.TRANSFERS, Action.CREATE)
  async createExportNote(
    @Body() dto: CreateExportNoteDto,
    @Req() req: RequestWithUser,
  ) {
    const actorId = req.user?._id;
    if (!actorId)
      throw new UnauthorizedException(
        'Không tìm thấy thông tin người thực hiện',
      );

    const result = await this.transactionsService.createExportNote(
      dto,
      actorId,
      req.ip,
      req.headers['user-agent'],
    );

    return new BaseResponse(
      true,
      'Tạo phiếu xuất hàng và trừ tồn kho thành công',
      { transaction_code: result.transaction_code },
    );
  }

  @Post('export/:id/cancel')
  @RequirePermissions(Resource.TRANSFERS, Action.UPDATE)
  async cancelExportNote(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Req() req: RequestWithUser,
  ) {
    const actorId = req.user?._id;
    if (!actorId) throw new UnauthorizedException('Không xác định được user');
    if (!reason)
      throw new BadRequestException('Bắt buộc phải nhập lý do hủy phiếu');

    await this.transactionsService.cancelExportNote(
      id,
      reason,
      actorId,
      req.ip,
      req.headers['user-agent'],
    );
    return new BaseResponse(
      true,
      'Hủy phiếu xuất và hoàn trả tồn kho thành công',
      null,
    );
  }

  @Get('export/history')
  @RequirePermissions(Resource.TRANSFERS, Action.READ)
  async getExportHistory(@Query() query: GetTransactionsDto) {
    const result = await this.transactionsService.getExportHistory(query);
    return new BaseResponse(
      true,
      'Lấy lịch sử xuất hàng thành công',
      result.data,
      {
        totalItems: result.total,
        itemCount: result.data.length,
        itemsPerPage: result.limit,
        totalPages: Math.ceil(result.total / result.limit),
        currentPage: result.page,
      },
    );
  }

  @Get('export/history/:id')
  @RequirePermissions(Resource.TRANSFERS, Action.READ)
  async getExportDetail(@Param('id') id: string) {
    const data = await this.transactionsService.getExportDetail(id);
    return new BaseResponse(true, 'Lấy chi tiết phiếu xuất thành công', data);
  }

  @Post('export/excel/preview')
  @RequirePermissions(Resource.TRANSFERS, Action.CREATE)
  @UseInterceptors(
    FileInterceptor('file', {
      fileFilter: (req, file, cb) => {
        if (!file.originalname.match(/\.(xls|xlsx)$/)) {
          return cb(
            new BadRequestException(
              'Chỉ chấp nhận file định dạng Excel (.xls, .xlsx)',
            ),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async previewExcelExport(@UploadedFile() file: Express.Multer.File) {
    const result = await this.transactionsService.previewExcelExport(file);
    return new BaseResponse(true, 'Đọc file Excel thành công.', result);
  }

  @Get('export/history/export/excel')
  @RequirePermissions(Resource.TRANSFERS, Action.EXPORT)
  async exportHistoryExcelReport(
    @Query() query: GetTransactionsDto,
    @Res() res: Response,
  ) {
    await this.transactionsService.exportHistoryExcelReport(query, res);
  }

  @Get('export/history/export/excel/:id')
  @RequirePermissions(Resource.TRANSFERS, Action.EXPORT)
  async exportDetailExcelReport(@Param('id') id: string, @Res() res: Response) {
    await this.transactionsService.exportDetailExcelReport(id, res);
  }

  // 3. API TẢI FILE MẪU (TEMPLATE)

  @Get('import/excel/template')
  @RequirePermissions(Resource.TRANSFERS, Action.READ)
  async downloadImportTemplate(@Res() res: Response) {
    await this.transactionsService.downloadImportTemplate(res);
  }

  @Get('export/excel/template')
  @RequirePermissions(Resource.TRANSFERS, Action.READ)
  async downloadExportTemplate(@Res() res: Response) {
    await this.transactionsService.downloadExportTemplate(res);
  }

  @Get('export/history/pdf/:id')
  @RequirePermissions(Resource.TRANSFERS, Action.READ) // Hoặc Action.EXPORT tùy bạn
  async exportDetailPdf(@Param('id') id: string, @Res() res: Response) {
    await this.transactionsService.exportDetailPdf(id, res);
  }
}
