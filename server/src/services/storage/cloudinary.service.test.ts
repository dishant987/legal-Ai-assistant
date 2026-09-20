import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const upload = vi.fn();
const destroy = vi.fn();
const url = vi.fn((_id: string, _options: Record<string, unknown>) => 'https://res.cloudinary.com/signed');
const config = vi.fn();

vi.mock('cloudinary', () => ({
  v2: { config, uploader: { upload, destroy }, url },
}));

const env = {
  NODE_ENV: 'test',
  // The logger reads this at import time; without it pino refuses to construct.
  LOG_LEVEL: 'silent',
  CLOUDINARY_CLOUD_NAME: 'demo',
  CLOUDINARY_API_KEY: 'key',
  CLOUDINARY_API_SECRET: 'secret',
};

vi.mock('../../config/env.js', () => ({
  getEnv: () => env,
}));

const { isStorageConfigured, remove, signedUrl, store } = await import('./cloudinary.service.js');

const BYTES = new TextEncoder().encode('SECURITY DEPOSIT: six months rent');

interface UploadOptions {
  type: string;
  access_mode: string;
  public_id: string;
  overwrite: boolean;
  folder: string;
}

/** The options passed to the nth upload call. */
function uploadOptions(call: number): UploadOptions {
  return upload.mock.calls[call]?.[1] as UploadOptions;
}

beforeEach(() => {
  vi.clearAllMocks();
  upload.mockResolvedValue({ public_id: 'legal-assist/test/documents/abc' });
});

afterEach(() => {
  Object.assign(env, {
    CLOUDINARY_CLOUD_NAME: 'demo',
    CLOUDINARY_API_KEY: 'key',
    CLOUDINARY_API_SECRET: 'secret',
  });
});

describe('store — the upload must not be public', () => {
  it('uploads as authenticated, never Cloudinary’s public default', async () => {
    // The default `type: 'upload'` produces a PUBLIC url. Someone's rent
    // agreement on a guessable public address is the failure this exists to
    // prevent, so this assertion is the whole point of the file.
    await store(BYTES, 'application/pdf');

    const options = uploadOptions(0);
    expect(options.type).toBe('authenticated');
    expect(options.access_mode).toBe('authenticated');
    expect(options.type).not.toBe('upload');
  });

  it('names the file with a fresh uuid, never the uploaded filename', async () => {
    // Filenames leak employers, landlords, case numbers and people's names.
    await store(BYTES, 'application/pdf');

    const publicId = uploadOptions(0).public_id;
    expect(publicId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('uses a different id every time', async () => {
    await store(BYTES, 'application/pdf');
    await store(BYTES, 'application/pdf');

    const first = uploadOptions(0).public_id;
    const second = uploadOptions(1).public_id;
    expect(first).not.toBe(second);
  });

  it('never overwrites an existing asset', async () => {
    await store(BYTES, 'application/pdf');
    expect(uploadOptions(0).overwrite).toBe(false);
  });

  it('separates environments by folder', async () => {
    await store(BYTES, 'application/pdf');
    expect(uploadOptions(0).folder).toContain('/test/');
  });
});

describe('store — storage is best-effort (R3.9)', () => {
  it('returns undefined instead of throwing when the upload fails', async () => {
    // An analysis that works is worth more than a copy of the file.
    upload.mockRejectedValue(new Error('cloudinary is down'));
    await expect(store(BYTES, 'application/pdf')).resolves.toBeUndefined();
  });

  it('does nothing at all when storage is not configured', async () => {
    env.CLOUDINARY_API_SECRET = undefined as unknown as string;

    await expect(store(BYTES, 'application/pdf')).resolves.toBeUndefined();
    expect(upload).not.toHaveBeenCalled();
  });

  it('treats a half-configured Cloudinary as not configured', () => {
    env.CLOUDINARY_API_KEY = undefined as unknown as string;
    expect(isStorageConfigured()).toBe(false);
  });
});

describe('signedUrl', () => {
  it('signs the url and gives it an expiry', () => {
    signedUrl('some-id');

    const options = (url.mock.calls[0]?.[1] ?? {}) as {
      sign_url: boolean;
      type: string;
      expires_at: number;
    };
    expect(options.sign_url).toBe(true);
    expect(options.type).toBe('authenticated');
    expect(options.expires_at).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });
});

describe('remove', () => {
  it('deletes each asset', async () => {
    destroy.mockResolvedValue({ result: 'ok' });
    await expect(remove(['a', 'b'])).resolves.toBe(2);
    expect(destroy).toHaveBeenCalledTimes(2);
  });

  it('keeps going when one refuses to delete', async () => {
    // Stopping at the first stubborn asset would strand every one after it.
    destroy.mockRejectedValueOnce(new Error('nope')).mockResolvedValue({ result: 'ok' });

    await expect(remove(['a', 'b', 'c'])).resolves.toBe(2);
    expect(destroy).toHaveBeenCalledTimes(3);
  });

  it('does nothing for an empty list', async () => {
    await expect(remove([])).resolves.toBe(0);
    expect(destroy).not.toHaveBeenCalled();
  });
});
