/**
 * The typed route table: every path this app may call, with its parameters, body and success
 * shape, taken from the generated OpenAPI documents. `request()` in `client.ts` only accepts a
 * path that exists here with the method it exists for, so a renamed or removed route, a new
 * required parameter or a changed body fails `tsc` at the call site instead of failing on a phone.
 */

import type { paths as BffPaths } from './generated/bff';
import type { paths as CorePaths } from './generated/core-api';
import type { paths as IdentityPaths } from './generated/identity-tenant-service';
import type { paths as MeetingPaths } from './generated/meeting-service';
import type { paths as NotificationPaths } from './generated/notification-service';

/** The gateway routes by path prefix, so one table covers every service behind it. */
export type Paths = BffPaths & CorePaths & IdentityPaths & MeetingPaths & NotificationPaths;

export type Method = 'get' | 'post' | 'patch' | 'put' | 'delete';

/** Paths that exist with this method. */
export type PathsWith<M extends Method> = {
  [P in keyof Paths]: Paths[P] extends { [K in M]: infer O } ? ([O] extends [never] ? never : O extends undefined ? never : P) : never;
}[keyof Paths] &
  string;

export type Op<P extends keyof Paths, M extends Method> = Paths[P] extends { [K in M]: infer O } ? NonNullable<O> : never;

type Params<O> = O extends { parameters: infer X } ? X : never;

export type PathParams<O> = Params<O> extends { path: infer X } ? ([X] extends [never] ? undefined : X) : undefined;

export type QueryParams<O> = Params<O> extends { query?: infer Q } ? ([Q] extends [never] ? undefined : Q) : undefined;

export type Body<O> = O extends { requestBody: { content: { 'application/json': infer B } } }
  ? B
  : O extends { requestBody?: { content: { 'application/json': infer B } } }
    ? B | undefined
    : undefined;

type JsonOf<R> = R extends { content: { 'application/json': infer J } } ? J : undefined;

/** The 200 body, else the 201 body, else nothing (204). */
export type Success<O> = O extends { responses: infer R }
  ? 200 extends keyof R
    ? JsonOf<R[200]>
    : 201 extends keyof R
      ? JsonOf<R[201]>
      : undefined
  : never;
