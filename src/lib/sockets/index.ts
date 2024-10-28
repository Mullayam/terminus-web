import { io } from 'socket.io-client';
import { __config } from '../config';
export const socket = io(__config.API_URL);
