import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import multer from 'multer';

export const uploadDir = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'));
fs.mkdirSync(uploadDir, { recursive: true });

const extensions: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

export const imageUpload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (_req, file, callback) => callback(null, `${Date.now()}-${randomUUID()}${extensions[file.mimetype] || ''}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => callback(null, Boolean(extensions[file.mimetype])),
});
