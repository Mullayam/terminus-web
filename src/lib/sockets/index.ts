import { io } from "socket.io-client";
export const socket = io("http://localhost:7145", {
  transports: ["polling"],
  // upgrade: false,
  // reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  // rejectUnauthorized: false,
  // forceNew: true,
  // path: '/socket.io',
});
// export const socket = io("http://localhost:7145");
