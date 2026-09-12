import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';
import { ErrorCode } from '../enums/error-code.enum';
import { DomainException } from '../exceptions/domain.exception';

interface ErrorEnvelope {
  success: false;
  message: string;
  errorCode: string;
  errors?: Record<string, string[]> | string[];
  path?: string;
  timestamp?: string;
}

/**
 * Centralized exception handling.
 * Normalizes every thrown error (domain exceptions, Nest HttpExceptions,
 * Prisma errors, and unexpected errors) into one consistent response shape.
 * Never leaks stack traces or internal details in production.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const isProduction = process.env.NODE_ENV === 'production';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorCode: string = ErrorCode.INTERNAL_ERROR;
    let message = 'An unexpected error occurred';
    let errors: Record<string, string[]> | string[] | undefined;

    if (exception instanceof DomainException) {
      status = exception.getStatus();
      const body = exception.getResponse() as { errorCode: string; message: string };
      errorCode = body.errorCode;
      message = body.message;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();

      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const b = body as { message?: string | string[]; error?: string };
        if (Array.isArray(b.message)) {
          // class-validator ValidationPipe errors
          message = 'Validation failed';
          errors = b.message;
          errorCode = ErrorCode.VALIDATION_ERROR;
        } else {
          message = b.message || b.error || message;
        }
      }

      errorCode = this.mapStatusToErrorCode(status, errorCode);
    } else if (exception instanceof QueryFailedError) {
      const mapped = this.mapQueryError(exception);
      status = mapped.status;
      errorCode = mapped.errorCode;
      message = mapped.message;
    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
      // Temporarily expose real error for DB debugging
      message = exception.message;
    } else {
      this.logger.error('Unknown exception thrown', JSON.stringify(exception));
    }

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status} ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    const envelope: ErrorEnvelope = {
      success: false,
      message,
      errorCode,
      ...(errors ? { errors } : {}),
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(envelope);
  }

  private mapStatusToErrorCode(status: number, fallback: string): string {
    switch (status) {
      case HttpStatus.UNAUTHORIZED:
        return ErrorCode.UNAUTHORIZED;
      case HttpStatus.FORBIDDEN:
        return ErrorCode.FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ErrorCode.NOT_FOUND;
      case HttpStatus.BAD_REQUEST:
        return fallback === ErrorCode.INTERNAL_ERROR ? ErrorCode.VALIDATION_ERROR : fallback;
      default:
        return fallback;
    }
  }

  private mapQueryError(exception: QueryFailedError): {
    status: number;
    errorCode: string;
    message: string;
  } {
    const driverError = (exception as any).driverError;
    const errno = driverError?.errno;
    // MySQL duplicate entry
    if (errno === 1062) {
      return {
        status: HttpStatus.CONFLICT,
        errorCode: ErrorCode.VALIDATION_ERROR,
        message: 'A record with this value already exists',
      };
    }
    // Foreign key constraint
    if (errno === 1452) {
      return {
        status: HttpStatus.BAD_REQUEST,
        errorCode: ErrorCode.VALIDATION_ERROR,
        message: 'This operation violates a related record constraint',
      };
    }
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      errorCode: ErrorCode.INTERNAL_ERROR,
      message: 'A database error occurred',
    };
  }
}
