import { PermissionFormData } from "@/pages/sftp/components/edit-permission";
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPermissions(rights: { user: string; group: string; other: string }): string {
  const mapPermissions = (perm: string) =>
    `${perm.includes("r") ? "r" : "-"}${perm.includes("w") ? "w" : "-"}${perm.includes("x") ? "x" : "-"}`;

  return `-${mapPermissions(rights.user)}${mapPermissions(rights.group)}${mapPermissions(rights.other)}`;
}
export function uuid_v4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
          var r = (Math.random() * 16) | 0,
              v = c == "x" ? r : (r & 0x3) | 0x8;
          return v.toString(16);
      }
  );
}
export function extractPath(filePath:string) {
  if (typeof filePath !== 'string') {
      throw new Error('Invalid input: Expected a string');
  }
  const lastIndex = filePath.lastIndexOf('/');
  if (lastIndex === -1) {
      return '';  
  }
  return filePath.substring(0, lastIndex);
}
export const convertToPermissions = (permissions: {
  group: string
  other: string
  user: string
}): PermissionFormData => {
  const convertPermissionString = (perm: string) => ({
    read: perm.includes('r'),
    write: perm.includes('w'),
    execute: perm.includes('x'),
  });

  return {
    owner: convertPermissionString(permissions.user),
    groups: convertPermissionString(permissions.group),
    others: convertPermissionString(permissions.other),
  };
};
export const formatBytes = (bytes: number): string => {
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
};