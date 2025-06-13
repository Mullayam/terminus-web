import { PermissionFormData } from "@/pages/sftp/components/edit-permission";
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

// Source: https://freesound.org/people/altemark/sounds/45759/
// This sound is released under the Creative Commons Attribution 3.0 Unported
// (CC BY 3.0) license. It was created by 'altemark'. No modifications have been
// made, apart from the conversion to base64.
export const sound = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjMyLjEwNAAAAAAAAAAAAAAA//tQxAADB8AhSmxhIIEVCSiJrDCQBTcu3UrAIwUdkRgQbFAZC1CQEwTJ9mjRvBA4UOLD8nKVOWfh+UlK3z/177OXrfOdKl7pyn3Xf//WreyTRUoAWgBgkOAGbZHBgG1OF6zM82DWbZaUmMBptgQhGjsyYqc9ae9XFz280948NMBWInljyzsNRFLPWdnZGWrddDsjK1unuSrVN9jJsK8KuQtQCtMBjCEtImISdNKJOopIpBFpNSMbIHCSRpRR5iakjTiyzLhchUUBwCgyKiweBv/7UsQbg8isVNoMPMjAAAA0gAAABEVFGmgqK////9bP/6XCykxBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq'

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
export function extractPath(filePath: string) {
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
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const formatSpeed = (bytesPerSecond: number): string => {
  return formatBytes(bytesPerSecond) + '/s';
};


export const getStatusColor = (status: string) => {
  switch (status) {
    case 'downloading':
    case 'uploading':
      return 'bg-blue-500';
    case 'completed': return 'bg-green-500';
    case 'paused': return 'bg-yellow-500';
    case 'abort':
    case 'aborted':
    case 'error':
      return 'bg-red-500';
    default: return 'bg-gray-500';
  }
};