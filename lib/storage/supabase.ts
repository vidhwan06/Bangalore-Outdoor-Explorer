// Supabase Storage provider.
//
// Implements the StorageProvider contract declared in ./index using the
// Supabase Storage REST API, so no additional SDK dependency is required.
// All calls use the service-role key and therefore run server-side only;
// this provider must never be imported into a client component.

import {
  FILE_CATEGORIES,
  PLACE_PHOTOS_BUCKET,
  generateUniqueKey,
  type ListOptions,
  type ListResult,
  type PresignedUrlOptions,
  type StorageFile,
  type StorageProvider,
  type UploadOptions,
  type UploadResult,
} from './index';

export interface SupabaseStorageConfig {
  /** e.g. https://<project-ref>.supabase.co */
  projectUrl: string;
  /** service_role key — server-side only, never exposed to the browser */
  serviceRoleKey: string;
  bucket: string;
}

interface StorageObjectRecord {
  id: string;
  bucket_id: string;
  name: string;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  last_accessed_at?: string | null;
}

export class StorageError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

export class SupabaseStorageProvider implements StorageProvider {
  readonly name = 'supabase';

  private readonly baseUrl: string;
  private readonly bucket: string;
  private readonly headers: Record<string, string>;

  constructor(private readonly config: SupabaseStorageConfig) {
    if (!config.projectUrl) throw new Error('SupabaseStorageProvider requires projectUrl');
    if (!config.serviceRoleKey) throw new Error('SupabaseStorageProvider requires serviceRoleKey');
    this.baseUrl = `${config.projectUrl.replace(/\/+$/, '')}/storage/v1`;
    this.bucket = config.bucket || PLACE_PHOTOS_BUCKET;
    this.headers = {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
    };
  }

  // ---------------------------------------------------------------- upload

  async upload(options: UploadOptions): Promise<UploadResult> {
    const body = await toBody(options.file);
    const res = await this.request(`/object/${this.bucket}/${encodeKey(options.key)}`, {
      method: 'POST',
      headers: { 'Content-Type': options.mimeType, 'x-upsert': 'true' },
      body,
    });
    const record = (await res.json()) as { Key: string; Id?: string };
    return {
      file: await this.buildFile(options.key, options.mimeType, body.byteLength, {
        ...(options.metadata ?? {}),
        ...(record.Id ? { storageId: record.Id } : {}),
      }),
    };
  }

  async uploadMultipart(options: UploadOptions): Promise<{ uploadId: string; partUrls: string[] }> {
    // The REST API does not expose S3 multipart semantics; a single-part upload
    // is sufficient for images bounded by MAX_FILE_SIZES.IMAGE (10 MiB).
    const { file } = await this.upload(options);
    return { uploadId: `single:${file.key}`, partUrls: [] };
  }

  async completeMultipartUpload(
    uploadId: string,
    key: string,
    parts: Array<{ partNumber: number; etag: string }>
  ): Promise<UploadResult> {
    if (!uploadId.startsWith('single:')) {
      throw new StorageError(`Unsupported uploadId: ${uploadId}`, 400);
    }
    const existing = await this.getFile(key);
    if (!existing) throw new StorageError(`Object not found after upload: ${key}`, 404);
    return { file: existing };
  }

  // -------------------------------------------------------------- download

  async getFile(key: string): Promise<StorageFile | null> {
    const res = await fetch(`${this.baseUrl}/object/info/${this.bucket}/${encodeKey(key)}`, {
      headers: this.headers,
      cache: 'no-store',
    });
    if (res.status === 404) return null;
    if (!res.ok) throw await this.toError(res);
    const record = (await res.json()) as StorageObjectRecord;
    return this.toStorageFile(record, key);
  }

  async getPresignedUrl(options: PresignedUrlOptions): Promise<string> {
    if (options.operation === 'read') {
      // This bucket is public, so a plain public URL needs no signature.
      return this.getPublicUrl(options.key);
    }
    throw new StorageError(
      'Supabase Storage provider only issues read URLs; writes go through upload()',
      400
    );
  }

  getPublicUrl(key: string): string {
    return `${this.baseUrl}/object/public/${this.bucket}/${encodeKey(key)}`;
  }

  // ------------------------------------------------------------------ list

  async list(options: ListOptions = {}): Promise<ListResult> {
    const params = new URLSearchParams();
    if (options.prefix) params.set('prefix', options.prefix);
    if (options.limit !== undefined) params.set('limit', String(options.limit));
    if (options.offset !== undefined) params.set('offset', String(options.offset));
    const res = await fetch(`${this.baseUrl}/object/list/${this.bucket}?${params}`, {
      headers: this.headers,
      cache: 'no-store',
    });
    if (!res.ok) throw await this.toError(res);
    const records = (await res.json()) as StorageObjectRecord[];
    const files = records.map((r) => this.toStorageFile(r, r.name));
    const limit = options.limit ?? files.length;
    return { files, hasMore: files.length >= limit };
  }

  // ---------------------------------------------------------------- delete

  async delete(key: string): Promise<boolean> {
    const res = await fetch(`${this.baseUrl}/object/${this.bucket}/${encodeKey(key)}`, {
      method: 'DELETE',
      headers: this.headers,
    });
    if (res.status === 404) return false;
    if (!res.ok) throw await this.toError(res);
    return true;
  }

  async deleteMany(keys: string[]): Promise<number> {
    let deleted = 0;
    for (const key of keys) {
      if (await this.delete(key)) deleted++;
    }
    return deleted;
  }

  // --------------------------------------------------------------- metadata

  async updateMetadata(key: string, metadata: Record<string, unknown>): Promise<StorageFile> {
    const existing = await this.getFile(key);
    if (!existing) throw new StorageError(`Object not found: ${key}`, 404);
    const merged = { ...existing.metadata, ...metadata };
    // The Storage API exposes metadata through the user_metadata column.
    await this.request(`/object/${this.bucket}/${encodeKey(key)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metadata: merged }),
    });
    const updated = await this.getFile(key);
    if (!updated) throw new StorageError(`Object disappeared: ${key}`, 404);
    return updated;
  }

  // ----------------------------------------------------------- copy / move

  async copy(sourceKey: string, destinationKey: string): Promise<StorageFile> {
    const res = await this.request(`/object/${this.bucket}/copy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bucketId: this.bucket,
        sourceKey,
        destinationKey,
      }),
    });
    const record = (await res.json()) as { Key: string };
    const file = await this.getFile(record.Key ?? destinationKey);
    if (!file) throw new StorageError(`Object not found after copy: ${destinationKey}`, 404);
    return file;
  }

  async move(sourceKey: string, destinationKey: string): Promise<StorageFile> {
    const copied = await this.copy(sourceKey, destinationKey);
    await this.delete(sourceKey);
    return copied;
  }

  // ---------------------------------------------------------------- health

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/bucket/${this.bucket}`, {
        headers: this.headers,
        cache: 'no-store',
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  // --------------------------------------------------------------- helpers

  private async request(path: string, init: RequestInit): Promise<Response> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: { ...this.headers, ...(init.headers ?? {}) },
    });
    if (!res.ok) throw await this.toError(res);
    return res;
  }

  private async toError(res: Response): Promise<StorageError> {
    let code: string | undefined;
    let message = res.statusText;
    try {
      const body = (await res.json()) as { message?: string; errorCode?: string; statusCode?: number };
      if (body.message) message = body.message;
      code = body.errorCode;
    } catch {
      /* non-JSON error body */
    }
    return new StorageError(`${res.status} ${message}`, res.status, code);
  }

  private toStorageFile(record: StorageObjectRecord, key: string): StorageFile {
    return {
      id: record.id,
      key,
      url: this.getPublicUrl(key),
      mimeType: String((record.metadata?.mimetype as string | undefined) ?? ''),
      size: Number((record.metadata?.size as number | undefined) ?? 0),
      metadata: (record.metadata ?? {}) as Record<string, unknown>,
      createdAt: new Date(record.created_at),
    };
  }

  private async buildFile(
    key: string,
    mimeType: string,
    size: number,
    metadata: Record<string, unknown>
  ): Promise<StorageFile> {
    const existing = await this.getFile(key);
    return {
      id: String(metadata.storageId ?? key),
      key,
      url: this.getPublicUrl(key),
      mimeType: String(metadata.mimetype ?? mimeType),
      size: Number(metadata.size ?? size),
      metadata,
      createdAt: existing?.createdAt ?? new Date(),
    };
  }
}

/** Percent-encodes each path segment while preserving separators. */
function encodeKey(key: string): string {
  return key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

async function toBody(file: Buffer | ReadableStream | Blob | File): Promise<ArrayBuffer> {
  if (file instanceof ArrayBuffer) return file;
  if (typeof Blob !== 'undefined' && file instanceof Blob) return file.arrayBuffer();
  if (typeof ReadableStream !== 'undefined' && file instanceof ReadableStream) {
    return new Response(file).arrayBuffer();
  }
  if (Buffer.isBuffer(file)) {
    return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer;
  }
  throw new Error('Unsupported file payload for SupabaseStorageProvider.upload');
}

/** Convenience: build the standard place-photo provider from env vars. */
export function createPlacePhotoStorageProvider(): SupabaseStorageProvider {
  const projectUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  return new SupabaseStorageProvider({
    projectUrl,
    serviceRoleKey,
    bucket: PLACE_PHOTOS_BUCKET,
  });
}

/** Re-exported so callers can validate against the same list the bucket enforces. */
export { FILE_CATEGORIES, generateUniqueKey };
