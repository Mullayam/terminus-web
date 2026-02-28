

import { useEffect, useState } from 'react';
import { getIconForFile, getIconForFolder, getIconForOpenFolder } from 'vscode-icons-js';
import { cachedIconUrl } from '@/lib/iconCache';

const CDN_BASE = 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons';

interface Props {
  name: string;
  isDirectory: boolean;
  isOpen?: boolean;
  size?: number;
  className?: string;
}

export default function FileIcon({ name, isDirectory, isOpen = false, size = 16, className = '' }: Props) {
  const iconFile = isDirectory
    ? (isOpen ? getIconForOpenFolder(name) : getIconForFolder(name))
    : getIconForFile(name);

  /* fallback: the package returns undefined for truly unknown names */
  const rawSrc = iconFile
    ? `${CDN_BASE}/${iconFile}`
    : `${CDN_BASE}/${isDirectory ? 'default_folder.svg' : 'default_file.svg'}`;

  const [src, setSrc] = useState(rawSrc);

  useEffect(() => {
    let cancelled = false;
    cachedIconUrl(rawSrc).then((url) => {
      if (!cancelled) setSrc(url);
    });
    return () => { cancelled = true; };
  }, [rawSrc]);

  return (
    <img
      src={src}
      alt={name}
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      loading="lazy"
      decoding="async"
      draggable={false}
    />
  );
}
