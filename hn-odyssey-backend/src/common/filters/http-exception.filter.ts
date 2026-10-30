import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';

interface MongoError {
  code?: number;
  keyPattern?: Record<string, number>;
}

interface NestErrorResponse {
  message?: string | string[];
  error?: string;
  statusCode?: number;
  error_code?: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal Server Error';
    let errorCode: string | undefined;

    // TH 1: Nếu là lỗi chuẩn của NestJS (HttpException)
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resBody = exception.getResponse() as NestErrorResponse | string;

      message =
        typeof resBody === 'object'
          ? resBody.message || exception.message
          : resBody;

      if (typeof resBody === 'object' && resBody.error_code) {
        errorCode = resBody.error_code;
      }
    }
    // TH 2: Nếu là lỗi từ MongoDB (ép kiểu qua interface MongoError)
    else if ((exception as MongoError).code === 11000) {
      status = HttpStatus.CONFLICT;
      const mongoErr = exception as MongoError;
      const keyPattern = mongoErr.keyPattern || {};
      const field = Object.keys(keyPattern)[0] || 'dữ liệu';
      message = `Dữ liệu bị trùng lặp: Trường [${field}] đã tồn tại trên hệ thống.`;
    }
    // TH 3: Lỗi validate của Mongoose (thiếu field required, sai enum...) → 400
    else if (
      exception instanceof Error &&
      exception.name === 'ValidationError'
    ) {
      status = HttpStatus.BAD_REQUEST;
      message = exception.message;
    }
    // TH 4: Các lỗi kế thừa từ class Error thông thường
    else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(
        `Unhandled Error: ${exception.message}`,
        exception.stack,
      );
    }

    // Gửi phản hồi về Postman
    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: message,
      ...(errorCode ? { error_code: errorCode } : {}),
    });
  }
}
