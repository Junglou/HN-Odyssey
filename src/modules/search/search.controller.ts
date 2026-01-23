import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchSuggestionDto } from './dto/search-query.dto';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';

@Controller('search')
@UseGuards(ThrottlerGuard) // AC17: Bảo vệ DDoS
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('suggestions')
  @Throttle({ default: { limit: 10, ttl: 1000 } })
  async getSuggestions(
    @Query() query: SearchSuggestionDto,
    @Request() req: import('express').Request & { user?: { id?: string } },
  ) {
    const userId = req.user?.id;
    // Client cần gửi device-id (ví dụ UUID lưu ở LocalStorage) nếu chưa login
    const deviceId =
      query.deviceId ||
      (req.headers && typeof req.headers['x-device-id'] === 'string'
        ? req.headers['x-device-id']
        : undefined);

    return this.searchService.getSuggestions(query.keyword, userId, deviceId);
  }
}
