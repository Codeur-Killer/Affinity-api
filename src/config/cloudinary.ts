import { v2 as cloudinary } from 'cloudinary';
import { env } from './env';

export function initCloudinary(): void {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key:    env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure:     true,
  });
  console.log('✅ Cloudinary initialisé (cloud:', env.CLOUDINARY_CLOUD_NAME, ')');
}

export async function uploadToCloudinary(
  buffer:   Buffer,
  folder:   string = 'affinity',
  publicId?: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id:     publicId,
        resource_type: 'image',
        transformation: [{ quality: 'auto', fetch_format: 'auto' }],
      },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error('Cloudinary: résultat vide'));
        } else {
          resolve(result.secure_url);
        }
      },
    );
    stream.end(buffer);
  });
}

export async function deleteFromCloudinary(url: string): Promise<void> {
  try {
    // Extraire le public_id depuis l'URL Cloudinary
    const match = url.match(/\/v\d+\/(.+)\.\w+$/);
    if (match) {
      await cloudinary.uploader.destroy(match[1]);
    }
  } catch {
    /* non critique */
  }
}
