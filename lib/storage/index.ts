// Storage abstraction
// Allows switching between local, S3, Cloudinary, etc.

export interface StorageFile {
  id: string;
  key: string;
  url: string;
  thumbnailUrl?: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  duration?: number; // For videos (seconds)
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface UploadOptions {
  key: string;
  file: Buffer | ReadableStream | Blob | File;
  mimeType: string;
  metadata?: Record<string, unknown>;
  generateThumbnail?: boolean;
  thumbnailOptions?: {
    width: number;
    height: number;
    quality: number;
  };
  accessControl?: 'public' | 'private' | 'authenticated';
}

export interface UploadResult {
  file: StorageFile;
  uploadId?: string; // For multipart uploads
}

export interface ListOptions {
  prefix?: string;
  limit?: number;
  offset?: number;
  includeMetadata?: boolean;
}

export interface ListResult {
  files: StorageFile[];
  nextOffset?: number;
  hasMore: boolean;
}

export interface PresignedUrlOptions {
  key: string;
  operation: 'read' | 'write';
  expiresIn?: number; // Seconds
  contentType?: string;
}

export interface StorageProvider {
  name: string;

  // Upload
  upload(options: UploadOptions): Promise<UploadResult>;
  uploadMultipart?(options: UploadOptions): Promise<{ uploadId: string; partUrls: string[] }>;
  completeMultipartUpload?(
    uploadId: string,
    key: string,
    parts: Array<{ partNumber: number; etag: string }>
  ): Promise<UploadResult>;

  // Download/Access
  getFile(key: string): Promise<StorageFile | null>;
  getPresignedUrl(options: PresignedUrlOptions): Promise<string>;
  getPublicUrl(key: string): string;

  // List
  list(options?: ListOptions): Promise<ListResult>;

  // Delete
  delete(key: string): Promise<boolean>;
  deleteMany(keys: string[]): Promise<number>;

  // Metadata
  updateMetadata(key: string, metadata: Record<string, unknown>): Promise<StorageFile>;

  // Copy/Move
  copy(sourceKey: string, destinationKey: string): Promise<StorageFile>;
  move(sourceKey: string, destinationKey: string): Promise<StorageFile>;

  // Health
  healthCheck(): Promise<boolean>;
}

export interface StorageProviderConfig {
  provider: StorageProviderType;
  bucket?: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  endpoint?: string;
  cdnUrl?: string;
  maxFileSize?: number;
  allowedMimeTypes?: string[];
}

export type StorageProviderType = 'local' | 's3' | 'cloudinary' | 'supabase' | 'gcs' | 'azure';

export interface StorageProviderFactory {
  create(config: StorageProviderConfig): Promise<StorageProvider>;
  getName(): StorageProviderType;
}

// File type categories
export const FILE_CATEGORIES = {
  IMAGE: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/avif'],
  VIDEO: ['video/mp4', 'video/webm', 'video/quicktime'],
  DOCUMENT: ['application/pdf', 'application/gpx+xml', 'application/octet-stream'],
  GPX: ['application/gpx+xml', 'application/xml', 'text/xml'],
} as const;

export type FileCategory = keyof typeof FILE_CATEGORIES;

export const MAX_FILE_SIZES = {
  IMAGE: 10 * 1024 * 1024, // 10MB
  VIDEO: 100 * 1024 * 1024, // 100MB
  DOCUMENT: 5 * 1024 * 1024, // 5MB
  GPX: 2 * 1024 * 1024, // 2MB
};

export function getFileCategory(mimeType: string): FileCategory | null {
  for (const [category, types] of Object.entries(FILE_CATEGORIES)) {
    if ((types as readonly string[]).includes(mimeType)) {
      return category as FileCategory;
    }
  }
  return null;
}

export function getMaxFileSize(category: FileCategory): number {
  return MAX_FILE_SIZES[category];
}

export function validateFile(mimeType: string, size: number): { valid: boolean; error?: string } {
  const category = getFileCategory(mimeType);
  if (!category) {
    return { valid: false, error: `Unsupported file type: ${mimeType}` };
  }

  const maxSize = getMaxFileSize(category);
  if (size > maxSize) {
    return {
      valid: false,
      error: `File too large. Max size for ${category.toLowerCase()}: ${formatBytes(maxSize)}`,
    };
  }

  return { valid: true };
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Storage paths for different entity types
export const STORAGE_PATHS = {
  PLACE_PHOTOS: 'places/{placeId}/photos',
  PLACE_VIDEOS: 'places/{placeId}/videos',
  TRAIL_GPX: 'trails/{trailId}/gpx',
  USER_AVATARS: 'users/{userId}/avatar',
  POST_PHOTOS: 'posts/{postId}/photos',
  SUBMISSION_PHOTOS: 'submissions/{submissionId}/photos',
  VERIFICATION_EVIDENCE: 'verifications/{verificationId}/evidence',
  HAZARD_PHOTOS: 'hazards/{hazardId}/photos',
  TEMP: 'temp/{userId}',
} as const;

export function generateStoragePath(template: string, params: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => params[key] || `{${key}}`);
}

export function generateUniqueKey(prefix: string, originalName: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const extension = originalName.split('.').pop() || '';
  return `${prefix}/${timestamp}-${random}.${extension}`;
}
