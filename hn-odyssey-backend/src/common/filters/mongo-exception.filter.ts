import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

interface MongoError {
  code: number;
  keyPattern?: Record<string, number>;
  keyValue?: Record<string, any>;
}

@Catch()
export class MongoExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const err = exception as MongoError;

    if (err && err.code === 11000) {
      return response.status(HttpStatus.CONFLICT).json({
        statusCode: HttpStatus.CONFLICT,
        message: 'Dữ liệu đã tồn tại trong hệ thống (Trùng lặp dữ liệu).',
        error: 'Conflict',
      });
    }

    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal Server Error',
    });
  }
}
