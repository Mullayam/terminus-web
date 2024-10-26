import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
 
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPermissions(rights: { user: string; group: string; other: string }): string {
  // Function to map each permission level to its corresponding characters
  const mapPermissions = (perm: string) => 
      `${perm.includes("r") ? "r" : "-"}${perm.includes("w") ? "w" : "-"}${perm.includes("x") ? "x" : "-"}`;

  // Combine permissions for user, group, and other
  return `-${mapPermissions(rights.user)}${mapPermissions(rights.group)}${mapPermissions(rights.other)}`;
}