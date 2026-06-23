import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const UserAgent = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
    }>();

    return request.headers['user-agent'] || 'Unknown';
  },
);
