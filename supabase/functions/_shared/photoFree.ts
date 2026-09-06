/**
 * Deep photo-free scanner: the defense-in-depth backstop that runs over any
 * value before it is written to an audit or result row. It is deliberately
 * aggressive (fail closed) about anything that *could* carry photo data,
 * identifiers, or secrets — URIs, storage paths, signed URLs, data URLs,
 * base64 runs, raw byte buffers, JWT-shaped tokens, email addresses — while
 * leaving short human prose alone.
 *
 * This scanner is a backstop, not the primary control. The primary control is
 * the strict versioned allow-list schema (see auditDetail.ts): rows are
 * composed only from known keys with bounded values, and clients cannot
 * insert into these tables at all. A normalized CHECK constraint in the
 * database is the final layer beneath both.
 *
 * Violations intentionally carry only a generic reason code and a sanitized
 * key path — never the offending value — so they are themselves loggable.
 */

export type PhotoFreeViolationReason =
  | 'suspicious_key'
  | 'uri_value'
  | 'data_url_value'
  | 'base64_value'
  | 'token_like_value'
  | 'email_like_value'
  | 'image_filename_value'
  | 'storage_path_value'
  | 'oversized_text'
  | 'oversized_array'
  | 'oversized_object'
  | 'numeric_buffer'
  | 'binary_buffer'
  | 'max_depth_exceeded'
  | 'unsupported_type'
  | 'unserializable_value';

export interface PhotoFreeViolation {
  /** Sanitized dotted key path (values never appear here). */
  path: string;
  reason: PhotoFreeViolationReason;
}

export interface PhotoFreeScanOptions {
  /**
   * Exact key names that are allowed even though they contain a suspicious
   * fragment (for example a domain-level `imageQuality` flag). The values
   * under such keys are still fully scanned.
   */
  allowedKeyNames?: readonly string[];
  /** Longest permitted single string. Audit details need only short codes. */
  maxStringLength?: number;
}

const DEFAULT_MAX_STRING_LENGTH = 1000;
const MAX_ARRAY_LENGTH = 1000;
const MAX_OBJECT_KEYS = 200;
const MAX_DEPTH = 16;
const MAX_NUMERIC_ARRAY_LENGTH = 31;
const BASE64_RUN = /[a-z0-9+/=_-]{120,}/;
const JWT_SHAPE = /\beyj[a-z0-9_-]{8,}\.[a-z0-9_-]{4,}/;
const EMAIL_SHAPE = /[a-z0-9][a-z0-9.+_-]*@[a-z0-9-]+\.[a-z]{2,}/;
const IMAGE_FILENAME = /\.(jpe?g|heic|heif|png|webp|gif|bmp|tiff?|dng|raw)\b/;
const UUID_PATH_SEGMENT =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[^\s]+\//;

const URI_SCHEMES = [
  'file://',
  'content://',
  'asset://',
  'assets-library://',
  'ph://',
  'ftp://',
  'http://',
  'https://',
  'blob:',
];

const STORAGE_PATH_MARKERS = ['/storage/v1/', '/object/sign/', 'analysis-uploads/'];

/**
 * Key-name fragments that mark a key as suspicious regardless of its value.
 * Keys are structural (authored by code, or by an attacker probing for a
 * bypass), so aggressive matching here has no innocent-prose downside.
 */
const SUSPICIOUS_KEY_FRAGMENTS = [
  'uri',
  'url',
  'path',
  'file',
  'image',
  'img',
  'photo',
  'picture',
  'pixel',
  'exif',
  'gps',
  'geometry',
  'landmark',
  'contour',
  'bound',
  'face',
  'base64',
  'bytes',
  'blob',
  'buffer',
  'binary',
  'storage',
  'bucket',
  'signed',
  'thumb',
  'avatar',
  'token',
  'secret',
  'email',
  'jwt',
];

function sanitizePathComponent(component: string): string {
  if (component.length === 0 || component.length > 32 || /[^a-zA-Z0-9_]/.test(component)) {
    return '<key>';
  }
  return component;
}

function isSuspiciousKey(key: string, allowed: ReadonlySet<string>): boolean {
  if (allowed.has(key)) return false;
  const lowered = key.toLowerCase();
  return SUSPICIOUS_KEY_FRAGMENTS.some((fragment) => lowered.includes(fragment));
}

/**
 * All lowercase variants of a string after up to five rounds of
 * percent-decoding, so `%66%69%6C%65%3A%2F%2F` and doubly-encoded payloads
 * are screened in decoded form as well as raw.
 */
function normalizedVariants(value: string): string[] {
  const variants: string[] = [];
  let current = value.toLowerCase();
  variants.push(current);
  for (let round = 0; round < 5; round += 1) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(current);
    } catch {
      break;
    }
    const lowered = decoded.toLowerCase();
    if (lowered === current) break;
    current = lowered;
    variants.push(current);
  }
  return variants;
}

function screenString(value: string, maxStringLength: number): PhotoFreeViolationReason | null {
  if (value.length > maxStringLength) return 'oversized_text';
  for (const variant of normalizedVariants(value)) {
    const compact = variant.replace(/\s+/g, '');
    if (compact.includes('data:')) return 'data_url_value';
    for (const scheme of URI_SCHEMES) {
      if (compact.includes(scheme)) return 'uri_value';
    }
    if (compact.includes(';base64,')) return 'base64_value';
    if (BASE64_RUN.test(compact)) return 'base64_value';
    if (JWT_SHAPE.test(variant)) return 'token_like_value';
    if (EMAIL_SHAPE.test(variant)) return 'email_like_value';
    for (const marker of STORAGE_PATH_MARKERS) {
      if (variant.includes(marker)) return 'storage_path_value';
    }
    if (UUID_PATH_SEGMENT.test(variant)) return 'storage_path_value';
    if (IMAGE_FILENAME.test(variant)) return 'image_filename_value';
  }
  return null;
}

function isBinaryLike(value: object): boolean {
  return (
    value instanceof ArrayBuffer ||
    ArrayBuffer.isView(value) ||
    (typeof SharedArrayBuffer !== 'undefined' && value instanceof SharedArrayBuffer)
  );
}

/**
 * Returns every violation found anywhere in `value`. An empty array means the
 * value is considered photo-free and safe to persist or log.
 */
export function findPhotoDataViolations(
  value: unknown,
  options: PhotoFreeScanOptions = {},
): PhotoFreeViolation[] {
  const allowed = new Set(options.allowedKeyNames ?? []);
  const maxStringLength = options.maxStringLength ?? DEFAULT_MAX_STRING_LENGTH;
  const violations: PhotoFreeViolation[] = [];
  const seen = new Set<object>();

  const visit = (node: unknown, path: string, depth: number): void => {
    if (depth > MAX_DEPTH) {
      violations.push({ path, reason: 'max_depth_exceeded' });
      return;
    }
    if (node === null || node === undefined || typeof node === 'boolean') return;
    if (typeof node === 'number') {
      if (!Number.isFinite(node)) violations.push({ path, reason: 'unsupported_type' });
      return;
    }
    if (typeof node === 'string') {
      const reason = screenString(node, maxStringLength);
      if (reason) violations.push({ path, reason });
      return;
    }
    if (typeof node !== 'object') {
      violations.push({ path, reason: 'unsupported_type' });
      return;
    }
    if (isBinaryLike(node)) {
      violations.push({ path, reason: 'binary_buffer' });
      return;
    }
    if (seen.has(node)) {
      violations.push({ path, reason: 'unserializable_value' });
      return;
    }
    seen.add(node);

    if (Array.isArray(node)) {
      if (node.length > MAX_ARRAY_LENGTH) {
        violations.push({ path, reason: 'oversized_array' });
        return;
      }
      if (
        node.length > MAX_NUMERIC_ARRAY_LENGTH &&
        node.every((item) => typeof item === 'number')
      ) {
        violations.push({ path, reason: 'numeric_buffer' });
        return;
      }
      node.forEach((item, index) => visit(item, `${path}[${index}]`, depth + 1));
      return;
    }

    const prototype = Object.getPrototypeOf(node);
    if (prototype !== Object.prototype && prototype !== null) {
      violations.push({ path, reason: 'unsupported_type' });
      return;
    }
    const entries = Object.entries(node as Record<string, unknown>);
    if (entries.length > MAX_OBJECT_KEYS) {
      violations.push({ path, reason: 'oversized_object' });
      return;
    }
    for (const [key, child] of entries) {
      const childPath = path === '' ? sanitizePathComponent(key) : `${path}.${sanitizePathComponent(key)}`;
      if (isSuspiciousKey(key, allowed)) {
        violations.push({ path: childPath, reason: 'suspicious_key' });
      }
      const keyReason = screenString(key, maxStringLength);
      if (keyReason) violations.push({ path: childPath, reason: keyReason });
      visit(child, childPath, depth + 1);
    }
  };

  visit(value, '', 0);
  return violations;
}

/** True when `value` contains no photo-data violations at all. */
export function isPhotoFree(value: unknown, options: PhotoFreeScanOptions = {}): boolean {
  return findPhotoDataViolations(value, options).length === 0;
}
