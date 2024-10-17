export enum SocketEventConstants {
  ServerClosed = "@@ServerClosed",

  SSH_CONNECT = "@@SSH_CONNECT",
  SSH_READY = "@@SSH_READY",
  SSH_EMIT_INPUT = "@@SSH_EMIT_INPUT",
  SSH_EMIT_DATA = "@@SSH_EMIT_DATA",
  SSH_EMIT_ERROR = "@@SSH_EMIT_ERROR",
  SSH_DISCONNECTED = "@@SSH_DISCONNECTED",
  CLIENT_CONNECTED = "@@CLIENT_CONNECTED",

  SSH_BANNER = "@@SSH_BANNER",
  SSH_TCP_CONNECTION = "@@SSH_TCP_CONNECTION",
  SSH_HOST_KEYS = "@@SSH_HOST_KEYS",

  // SFTP
  SFTP_GET_FILE = "@@SFTP_GET_FILE",
  SFTP_FILES_LIST = "@@SFTP_FILES_LIST",
  SFTP_RENAME_FILE = "@@SFTP_RENAME_FILE",
  SFTP_MOVE_FILE = "@@SFTP_MOVE_FILE",
  SFTP_DELETE_FILE_OR_DIR = "@@SFTP_DELETE_FILE_OR_DIR",
  SFTP_COPY_FILE = "@@SFTP_COPY_FILE",
  SFTP_CREATE_FILE = "@@SFTP_CREATE_FILE",
  SFTP_CREATE_DIR = "@@SFTP_CREATE_DIR",

  SUCCESS = "@@SUCCESS",
  ERROR = "@@ERROR"

}
