import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { Server } from 'socket.io';
import { deviceAuth } from './middleware/auth';
import { errorHandler } from './middleware/error';
import { health } from './routes/health';
import { tour } from './routes/tour';
import { weather } from './routes/weather';
import { courses } from './routes/courses';
import { recommend } from './routes/recommend';
import { runs } from './routes/runs';
import { missions } from './routes/missions';
import { crews } from './routes/crews';
import { events } from './routes/events';
import { mates } from './routes/mates';
import { rankings } from './routes/rankings';
import { me } from './routes/me';
import { ai } from './routes/ai';
import { attachLive } from './live/ranking';

const app = express();
const origins = (process.env.CORS_ORIGINS || 'http://localhost:3000').split(',').map((s) => s.trim());
const corsOpts = { origin: (origin: string | undefined, cb: (e: Error | null, ok?: boolean) => void) => cb(null, !origin || origins.includes(origin) || origins.includes('*') || /\.vercel\.app$/.test(new URL(origin).hostname)), credentials: true };

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors(corsOpts));
app.use(express.json({ limit: '2mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(deviceAuth);

app.get('/', (_req, res) => res.json({ name: 'LOCAL STRIDE API', docs: '/api/health' }));
app.use('/api', health, tour, weather, courses, recommend, runs, missions, crews, events, mates, rankings, me, ai);
app.use((_req, res) => res.status(404).json({ error: 'not found' }));
app.use(errorHandler);

const server = http.createServer(app);
const io = new Server(server, { cors: corsOpts });
attachLive(io);

const port = Number(process.env.PORT || 4000);
server.listen(port, () => console.log(`LOCAL STRIDE API on :${port}`));
