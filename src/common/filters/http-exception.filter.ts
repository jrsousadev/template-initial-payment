import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { FastifyReply } from 'fastify';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);
  private readonly isDevelopment = process.env.NODE_ENV === 'development';

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let details: any = undefined;

    // ✅ NOVA VERIFICAÇÃO: Tratar TypeError específico do class-transformer
    if (exception instanceof TypeError) {
      const errorMessage = exception.message;

      // Verificar se é o erro específico do class-transformer/throwError
      if (errorMessage.includes('Cannot read properties of undefined')) {
        status = HttpStatus.BAD_REQUEST;
        message = 'Invalid request data format';

        // Log detalhado para debug
        this.logger.error(
          `Class-transformer/RxJS error: ${errorMessage}`,
          exception.stack,
        );

        // Em desenvolvimento, adicionar mais detalhes
        if (this.isDevelopment) {
          details = {
            type: 'SerializationError',
            originalError: errorMessage,
            hint: 'Check if response objects have undefined properties or invalid @Transform decorators',
          };
        }
      } else {
        // Outros TypeErrors
        message = this.isDevelopment
          ? exception.message
          : 'Type validation error';
        this.logger.error(`TypeError: ${exception.message}`, exception.stack);
      }
    }
    // Tratamento de exceções do Prisma
    else if (this.isPrismaError(exception)) {
      const prismaError = this.handlePrismaError(
        exception as Prisma.PrismaClientKnownRequestError,
      );
      status = prismaError.status;
      message = prismaError.message;
      details = this.isDevelopment ? prismaError.details : undefined;
    }
    // Tratamento de HttpException do NestJS
    else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        message = (exceptionResponse as any).message || 'An error occurred';
        // Remover campos sensíveis de validação
        if ((exceptionResponse as any).error) {
          details = this.sanitizeValidationErrors(exceptionResponse);
        }
      }
    }
    // ✅ NOVA VERIFICAÇÃO: Tratar erros do RxJS/Observable
    else if (
      exception &&
      typeof exception === 'object' &&
      'name' in exception
    ) {
      const err = exception as any;

      // Verificar se é um erro do RxJS
      if (
        err.name === 'ObjectUnsubscribedError' ||
        err.name === 'EmptyError' ||
        err.name === 'TimeoutError'
      ) {
        status = HttpStatus.SERVICE_UNAVAILABLE;
        message = 'Service temporarily unavailable';

        this.logger.error(`RxJS Error: ${err.name}`, err.stack);

        if (this.isDevelopment) {
          details = {
            type: 'ObservableError',
            name: err.name,
            originalMessage: err.message,
          };
        }
      }
    }
    // Tratamento de erros genéricos
    else if (exception instanceof Error) {
      // Não expor mensagens de erro internas em produção
      message = this.isDevelopment ? exception.message : 'An error occurred';

      // Log completo do erro (não enviado ao cliente)
      this.logger.error(
        `Unhandled error: ${exception.message}`,
        exception.stack,
      );
    }
    // ✅ NOVA VERIFICAÇÃO: Tratamento para objetos undefined/null
    else if (exception === undefined || exception === null) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'An unexpected error occurred';

      this.logger.error('Received undefined or null exception');

      if (this.isDevelopment) {
        details = {
          type: 'UndefinedException',
          value: exception,
        };
      }
    }

    // Log detalhado para debugging (apenas no servidor)
    this.logError(exception, status, message);

    // ✅ GARANTIR que a resposta sempre tem uma estrutura válida
    const errorResponse: any = {
      statusCode: status,
      message: message,
      timestamp: new Date().toISOString(),
      path: ctx.getRequest()?.url || 'unknown',
    };

    // Adicionar detalhes apenas em desenvolvimento
    if (this.isDevelopment && details) {
      errorResponse.details = details;
    }

    // ✅ Garantir que o response está disponível antes de enviar
    if (
      response &&
      typeof response.code === 'function' &&
      typeof response.send === 'function'
    ) {
      response.code(status).send(errorResponse);
    } else {
      // Fallback se o response não estiver disponível
      this.logger.error('Response object not available', { errorResponse });
    }
  }

  private isPrismaError(exception: unknown): boolean {
    return (
      exception instanceof Prisma.PrismaClientKnownRequestError ||
      exception instanceof Prisma.PrismaClientUnknownRequestError ||
      exception instanceof Prisma.PrismaClientRustPanicError ||
      exception instanceof Prisma.PrismaClientInitializationError ||
      exception instanceof Prisma.PrismaClientValidationError
    );
  }

  private handlePrismaError(error: Prisma.PrismaClientKnownRequestError): {
    status: number;
    message: string;
    details?: any;
  } {
    // Mapeamento de códigos de erro do Prisma para mensagens amigáveis
    const errorMessages: Record<string, { status: number; message: string }> = {
      P2000: {
        status: HttpStatus.BAD_REQUEST,
        message: 'The provided value is too long for the field',
      },
      P2001: {
        status: HttpStatus.NOT_FOUND,
        message: 'The requested record was not found',
      },
      P2002: {
        status: HttpStatus.CONFLICT,
        message: 'A unique constraint violation occurred',
      },
      P2003: {
        status: HttpStatus.BAD_REQUEST,
        message: 'Foreign key constraint failed',
      },
      P2004: {
        status: HttpStatus.BAD_REQUEST,
        message: 'A constraint failed on the database',
      },
      P2005: {
        status: HttpStatus.BAD_REQUEST,
        message: 'Invalid value provided for the field',
      },
      P2006: {
        status: HttpStatus.BAD_REQUEST,
        message: 'The provided value is invalid',
      },
      P2007: {
        status: HttpStatus.BAD_REQUEST,
        message: 'Data validation error',
      },
      P2008: {
        status: HttpStatus.BAD_REQUEST,
        message: 'Failed to parse the query',
      },
      P2009: {
        status: HttpStatus.BAD_REQUEST,
        message: 'Failed to validate the query',
      },
      P2010: {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Raw query failed',
      },
      P2011: {
        status: HttpStatus.BAD_REQUEST,
        message: 'Null constraint violation',
      },
      P2012: {
        status: HttpStatus.BAD_REQUEST,
        message: 'Missing a required value',
      },
      P2013: {
        status: HttpStatus.BAD_REQUEST,
        message: 'Missing required argument',
      },
      P2014: {
        status: HttpStatus.BAD_REQUEST,
        message: 'Relation violation',
      },
      P2015: {
        status: HttpStatus.NOT_FOUND,
        message: 'Related record not found',
      },
      P2016: {
        status: HttpStatus.BAD_REQUEST,
        message: 'Query interpretation error',
      },
      P2017: {
        status: HttpStatus.BAD_REQUEST,
        message: 'Records for relation are not connected',
      },
      P2018: {
        status: HttpStatus.NOT_FOUND,
        message: 'Required connected records not found',
      },
      P2019: {
        status: HttpStatus.BAD_REQUEST,
        message: 'Input error',
      },
      P2020: {
        status: HttpStatus.BAD_REQUEST,
        message: 'Value out of range',
      },
      P2021: {
        status: HttpStatus.NOT_FOUND,
        message: 'Table does not exist',
      },
      P2022: {
        status: HttpStatus.NOT_FOUND,
        message: 'Column does not exist',
      },
      P2023: {
        status: HttpStatus.BAD_REQUEST,
        message: 'Inconsistent column data',
      },
      P2024: {
        status: HttpStatus.REQUEST_TIMEOUT,
        message: 'Operation timed out',
      },
      P2025: {
        status: HttpStatus.NOT_FOUND,
        message: 'Record to update not found',
      },
      P2026: {
        status: HttpStatus.BAD_REQUEST,
        message: 'Unsupported feature used',
      },
      P2027: {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Multiple errors occurred during execution',
      },
      P2028: {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Transaction API error',
      },
      P2030: {
        status: HttpStatus.BAD_REQUEST,
        message: 'Cannot find a fulltext index',
      },
      P2033: {
        status: HttpStatus.BAD_REQUEST,
        message: 'A number used in the query does not fit',
      },
      P2034: {
        status: HttpStatus.CONFLICT,
        message: 'Transaction conflict',
      },
    };

    const errorMapping = errorMessages[error.code] || {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'An unexpected database error occurred',
    };

    // Extrair informações úteis sem expor dados sensíveis
    let details: any = undefined;

    if (this.isDevelopment) {
      details = {
        code: error.code,
        meta: this.sanitizePrismaMeta(error.meta),
      };
    }

    return {
      status: errorMapping.status,
      message: errorMapping.message,
      details,
    };
  }

  private sanitizePrismaMeta(meta: any): any {
    if (!meta) return undefined;

    const sanitized: any = {};

    // Lista de campos seguros para incluir
    const safeFields = ['target', 'model', 'argument_name', 'argument_value'];

    for (const field of safeFields) {
      if (meta[field]) {
        // Remover valores sensíveis
        if (field === 'argument_value' || field === 'target') {
          // Apenas indicar o tipo de campo, não o valor
          sanitized[field] = Array.isArray(meta[field])
            ? '[fields]'
            : typeof meta[field];
        } else {
          sanitized[field] = meta[field];
        }
      }
    }

    return Object.keys(sanitized).length > 0 ? sanitized : undefined;
  }

  private sanitizeValidationErrors(response: any): any {
    if (!response || typeof response !== 'object') {
      return undefined;
    }

    const sanitized: any = {};

    // Remover campos que possam conter dados sensíveis
    const allowedFields = ['error', 'statusCode'];

    for (const field of allowedFields) {
      if (response[field]) {
        sanitized[field] = response[field];
      }
    }

    // Se houver mensagens de validação, sanitizá-las
    if (response.message && Array.isArray(response.message)) {
      sanitized.validationErrors = response.message.map((msg: string) => {
        // Remover valores específicos das mensagens de validação
        return msg
          .replace(/: ".*?"/, ': [hidden]')
          .replace(/: '.*?'/, ': [hidden]')
          .replace(/: \d+/, ': [number]');
      });
    }

    return sanitized;
  }

  private logError(exception: unknown, status: number, message: string): void {
    const errorDetails: any = {
      status,
      message,
      timestamp: new Date().toISOString(),
    };

    // ✅ Tratamento mais robusto para diferentes tipos de exceção
    if (exception instanceof Error) {
      errorDetails['error'] = exception.name;
      errorDetails['stack'] = exception.stack;

      if (this.isPrismaError(exception)) {
        errorDetails['prismaCode'] = (exception as any).code;
        errorDetails['prismaMeta'] = (exception as any).meta;
      }
    } else if (exception && typeof exception === 'object') {
      errorDetails['type'] = 'object';
      errorDetails['keys'] = Object.keys(exception);
      errorDetails['constructor'] = exception.constructor?.name;
    } else {
      errorDetails['type'] = typeof exception;
      errorDetails['value'] = exception;
    }

    // Log de erro completo (apenas no servidor)
    if (status >= 500) {
      this.logger.error('Server Error:', errorDetails);
    } else if (status >= 400) {
      this.logger.warn('Client Error:', errorDetails);
    } else {
      this.logger.debug('Error:', errorDetails);
    }
  }
}
