import type { Category } from './types'

const MAP: Record<Exclude<Category, 'other'>, string[]> = {
  video: ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v', 'mpg', 'mpeg', '3gp', 'ts', 'm2ts'],
  audio: ['mp3', 'flac', 'wav', 'aac', 'm4a', 'ogg', 'opus', 'wma', 'alac', 'aiff'],
  archive: ['zip', 'rar', '7z', 'tar', 'gz', 'tgz', 'bz2', 'xz', 'zst', 'iso', 'img', 'cab', 'lz', 'lzma'],
  document: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'epub', 'csv', 'odt', 'rtf', 'md', 'mobi'],
  program: ['exe', 'msi', 'dmg', 'pkg', 'deb', 'rpm', 'appimage', 'apk', 'msix', 'appx', 'run', 'bin', 'jar'],
  image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'tiff', 'heic', 'avif', 'psd', 'raw']
}

export function categoryOf(fileName: string): Category {
  const ext = fileName.toLowerCase().split('.').pop() ?? ''
  for (const [cat, exts] of Object.entries(MAP)) if (exts.includes(ext)) return cat as Category
  return 'other'
}

export const CATEGORY_FOLDERS: Record<Category, string> = {
  video: 'Video',
  audio: 'Music',
  archive: 'Compressed',
  document: 'Documents',
  program: 'Programs',
  image: 'Images',
  other: ''
}
