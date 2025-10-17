import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const JWT_SECRET = process.env.JWT_SECRET || 'your-default-secret';
export const DATABASE_URL = process.env.DATABASE_URL;
export const REDIS_URL = process.env.REDIS_URL;
export const PORT = process.env.PORT || 3001; 