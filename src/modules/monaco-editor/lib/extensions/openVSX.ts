/**
 * @module lib/monaco/openVSX
 *
 * Client for the Open VSX Registry API (https://open-vsx.org).
 * Allows searching, fetching metadata, and downloading VS Code extensions
 * (VSIX files) from the registry.
 */

const OPEN_VSX = "https://open-vsx.org/api";

/* ── Types ─────────────────────────────────────────────────── */

export interface OpenVSXExtensionFile {
  download: string;
  manifest?: string;
  readme?: string;
  changelog?: string;
  icon?: string;
  license?: string;
}

export interface OpenVSXExtension {
  namespaceUrl: string;
  reviewsUrl: string;
  name: string;
  namespace: string;
  displayName: string;
  description: string;
  version: string;
  timestamp: string;
  averageRating?: number;
  downloadCount?: number;
  reviewCount?: number;
  verified?: boolean;
  publishedBy: {
    loginName: string;
    homepage?: string;
    avatarUrl?: string;
  };
  files: OpenVSXExtensionFile;
  categories?: string[];
  tags?: string[];
  allVersions?: Record<string, string>;
  engines?: Record<string, string>;
}

export interface OpenVSXSearchResult {
  offset: number;
  totalSize: number;
  extensions: OpenVSXExtension[];
}

/* ── API Functions ─────────────────────────────────────────── */

/**
 * Search extensions on Open VSX.
 *
 * @param query       Search query string
 * @param size        Number of results (default: 20)
 * @param offset      Pagination offset (default: 0)
 * @param category    Filter by category
 * @param sortOrder   Sort order: "relevance" | "timestamp" | "averageRating" | "downloadCount"
 * @param sortBy      Sort direction: "asc" | "desc"
 */
export async function searchExtensions(
  query: string,
  options?: {
    size?: number;
    offset?: number;
    category?: string;
    sortOrder?: string;
    sortBy?: string;
  },
): Promise<OpenVSXSearchResult> {
  const params = new URLSearchParams({
    query,
    size: String(options?.size ?? 20),
    offset: String(options?.offset ?? 0),
  });

  if (options?.category) params.set("category", options.category);
  if (options?.sortOrder) params.set("sortOrder", options.sortOrder);
  if (options?.sortBy) params.set("sortBy", options.sortBy);

  const res = await fetch(`${OPEN_VSX}/-/search?${params}`);
  if (!res.ok) throw new Error(`Open VSX search failed: ${res.status}`);
  return res.json();
}

/**
 * Get extension metadata (latest version).
 */
export async function getExtension(
  publisher: string,
  name: string,
): Promise<OpenVSXExtension> {
  const res = await fetch(`${OPEN_VSX}/${publisher}/${name}`);
  if (!res.ok) throw new Error(`Extension not found: ${publisher}.${name} (${res.status})`);
  return res.json();
}

/**
 * Get a specific version of an extension.
 */
export async function getExtensionVersion(
  publisher: string,
  name: string,
  version: string,
): Promise<OpenVSXExtension> {
  const res = await fetch(`${OPEN_VSX}/${publisher}/${name}/${version}`);
  if (!res.ok)
    throw new Error(`Extension version not found: ${publisher}.${name}@${version} (${res.status})`);
  return res.json();
}

/**
 * Download a VSIX (extension zip archive) as an ArrayBuffer.
 * Uses the download URL from the extension metadata.
 */
export async function downloadVSIX(
  downloadUrl: string,
): Promise<ArrayBuffer> {
  const res = await fetch(downloadUrl);
  if (!res.ok) throw new Error(`VSIX download failed: ${res.status}`);
  return res.arrayBuffer();
}
