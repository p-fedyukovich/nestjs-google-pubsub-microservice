import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  RequestTimeoutException,
  applyDecorators,
  UseInterceptors,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  constructor(private reflector: Reflector) {}
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const time = this.reflector.get<number>(
      'GCPubSubTimeoutTime',
      context.getHandler(),
    );
    if (!time || time < 0) throw new Error('Invalid Time');
    return next.handle().pipe(
      timeout(time),
      catchError((err) => {
        if (err instanceof TimeoutError) {
          return throwError(() => new RequestTimeoutException());
        }
        return throwError(() => err);
      }),
    );
  }
}

export function GCPubSubClientTimeoutInterceptor(ms: number) {
  return applyDecorators(
    SetMetadata('GCPubSubTimeoutTime', ms),
    UseInterceptors(TimeoutInterceptor),
  );
}
