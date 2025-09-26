import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { FastifyRequest } from 'fastify';

export interface RequestMetadata {
  ipAddress: string;
  userAgent: string;
  referer: string | null;
}

export const RequestMetadata = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): RequestMetadata => {
    const request = ctx.switchToHttp().getRequest<FastifyRequest>();

    // Obter IP Address
    const forwardedFor = request.headers['x-forwarded-for'];
    const realIp = request.headers['x-real-ip'];

    let ipAddress: string;
    if (forwardedFor) {
      const ips = Array.isArray(forwardedFor)
        ? forwardedFor[0]
        : forwardedFor.split(',')[0];
      ipAddress = ips.trim();
    } else if (realIp) {
      ipAddress = Array.isArray(realIp) ? realIp[0] : realIp;
    } else {
      ipAddress = request.ip || '127.0.0.1';
    }

    // Obter User-Agent
    const userAgentHeader = request.headers['user-agent'];
    const userAgent = Array.isArray(userAgentHeader)
      ? userAgentHeader[0]
      : userAgentHeader || 'Unknown';

    // Obter Referer
    const refererHeader =
      request.headers['referer'] || request.headers['referrer'];
    const referer = Array.isArray(refererHeader)
      ? refererHeader[0]
      : refererHeader || null;

    return {
      ipAddress,
      userAgent,
      referer,
    };
  },
);
