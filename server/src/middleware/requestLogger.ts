import type { RequestHandler } from 'express';

export const requestLogger: RequestHandler = (request, response, next) => {
  const startedAt = performance.now();
  response.on('finish', () => {
    const durationMs = Math.round((performance.now() - startedAt) * 10) / 10;
    console.log(`${request.method} ${request.originalUrl} ${response.statusCode} ${durationMs}ms`);
  });
  next();
};
