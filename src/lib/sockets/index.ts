import { io } from 'socket.io-client';
const URL = import.meta.env.VITE_APP_ENV === "PROD"? "https://terminus-web-api.onrender.com/" : 'http://localhost:7145';
console.log(URL)
export const socket = io(URL);
