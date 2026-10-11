import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { SearchService } from './search.service';
import { SearchSuggestionDto } from './dto/search-query.dto';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { AlgoliaService } from './algolia.service';
import { Public } from 'src/common/decorators/public.decorator';
import { OptionalJwtAuthGuard } from 'src/common/guards/optional-auth.guard'; // Thay thế import

// Interface đã chuẩn hóa theo JwtStrategy
interface RequestWithUser extends ExpressRequest {
  user?: {
    _id: string;
    email: string;
    roles: string[];
  };
}

@Controller('search')
@UseGuards(ThrottlerGuard) // AC17: Bảo vệ DDoS
export class SearchController {
  constructor(
    private readonly searchService: SearchService,
    private readonly algoliaService: AlgoliaService,
  ) {}

  @Public()
  @UseGuards(OptionalJwtAuthGuard) // Dùng Optional Guard thay vì Guard cứng
  @Get('credentials')
  getAlgoliaCredentials(@Request() req: RequestWithUser) {
    const userId = req.user?._id; // Lấy đúng trường _id
    const token = this.algoliaService.generateSecuredApiKey(userId);

    return {
      appId: process.env.ALGOLIA_APP_ID,
      indexName: process.env.ALGOLIA_INDEX_NAME,
      securedApiKey: token,
    };
  }

  @Public()
  @Get('suggestions')
  @Throttle({ default: { limit: 10, ttl: 1000 } })
  async getSuggestions(
    @Query() query: SearchSuggestionDto,
    @Request() req: RequestWithUser,
  ) {
    const userId = req.user?._id; // Lấy đúng trường _id

    // Client cần gửi device-id (ví dụ UUID lưu ở LocalStorage) nếu chưa login
    const deviceId =
      query.deviceId ||
      (req.headers && typeof req.headers['x-device-id'] === 'string'
        ? req.headers['x-device-id']
        : undefined);

    return this.searchService.getSuggestions(query.keyword, userId, deviceId);
  }
}
