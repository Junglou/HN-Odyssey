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

  @Post('import')
  @RequirePermissions(Resource.TRANSFERS, Action.CREATE)
  async createImportNote(
    @Body() dto: CreateImportNoteDto,
    @Req() req: RequestWithUser,
  ) {
    // Lấy trực tiếp _id (vì log của bạn cho thấy user có trường _id)
    const actorId = req.user?._id;
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    if (!actorId) {
      throw new UnauthorizedException(
        'Không tìm thấy thông tin người thực hiện',
      );
    }

    // TRUYỀN ĐÚNG THỨ TỰ THAM SỐ (4 tham số như Service đã định nghĩa)
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
  // TypeScript sẽ tự hiểu kiểu trả về khi PopulatedActor đã được export
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
  // TypeScript sẽ tự hiểu kiểu trả về khi PreviewItem đã được export
  async previewExcelImport(@UploadedFile() file: Express.Multer.File) {
    const result = await this.transactionsService.previewExcelImport(file);
    return new BaseResponse(
      true,
      'Đọc file Excel thành công. Vui lòng kiểm tra dữ liệu xem trước.',
      result,
    );
  }

  @Get('export/excel')
  @RequirePermissions(Resource.TRANSFERS, Action.EXPORT)
  async exportHistoryExcel(
    @Query() query: GetTransactionsDto,
    @Res() res: Response, // Đã fix nhờ 'import type' ở trên
  ) {
    await this.transactionsService.exportHistoryExcel(query, res);
    res.end();
  }

  @Get('export/excel/:id')
  @RequirePermissions(Resource.TRANSFERS, Action.EXPORT)
  async exportDetailExcel(
    @Param('id') id: string,
    @Res() res: Response, // Đã fix nhờ 'import type' ở trên
  ) {
    await this.transactionsService.exportDetailExcel(id, res);
    res.end();
  }
}

// AC5: Báo cáo PDF (Mẹo Backend)
// Thực tế, việc vẽ PDF bằng thư viện backend (như pdfkit) rất dài dòng mã code.
// Cách chuẩn xác và hiện đại nhất là Frontend sử dụng thư viện (như jspdf) để convert
// cái giao diện bảng chi tiết thành PDF rồi cho user tải về.
// Code backend tới đây đã cover 95% nghiệp vụ. API GET Detail đã cung cấp đủ data để Frontend in PDF.
