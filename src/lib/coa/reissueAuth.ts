import 'server-only';
import { timingSafeEqual } from 'node:crypto';

type AdminRequest = Pick<Request, 'headers'>;

export class CertAdminError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

/** Reissue remains admin-only until a separate purchaser verification exists. */
export function requireCertAdmin(request: AdminRequest | undefined): void {
  const expected = process.env.ADMIN_API_TOKEN;
  if (!expected) throw new CertAdminError(500, 'missing_ADMIN_API_TOKEN');
  const authorization = request?.headers.get('authorization');
  const provided = request?.headers.get('x-meish-admin-token') ??
    (authorization?.startsWith('Bearer ') ? authorization.slice(7) : null);
  if (!provided) throw new CertAdminError(401, 'missing_admin_token');
  const actualBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);
  if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) {
    throw new CertAdminError(403, 'invalid_admin_token');
  }
}
