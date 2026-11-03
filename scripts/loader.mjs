import { pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const SRC_DIR = path.resolve(process.cwd(), 'src');

function resolveExtension(targetPath) {
  if (fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) {
    return targetPath;
  }
  if (fs.existsSync(targetPath + '.ts')) {
    return targetPath + '.ts';
  }
  if (fs.existsSync(targetPath + '.tsx')) {
    return targetPath + '.tsx';
  }
  if (fs.existsSync(path.join(targetPath, 'index.ts'))) {
    return path.join(targetPath, 'index.ts');
  }
  return targetPath;
}

export async function resolve(specifier, context, nextResolve) {
  let resolvedPath = specifier;

  if (specifier.startsWith('@/')) {
    const subpath = specifier.slice(2);
    const fullPath = path.resolve(SRC_DIR, subpath);
    resolvedPath = resolveExtension(fullPath);
    return nextResolve(pathToFileURL(resolvedPath).href, context);
  }

  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    const parentURL = context.parentURL;
    if (parentURL && parentURL.startsWith('file://')) {
      const parentDir = path.dirname(new URL(parentURL).pathname);
      const fullPath = path.resolve(parentDir, specifier);
      resolvedPath = resolveExtension(fullPath);
      if (resolvedPath !== fullPath) {
        return nextResolve(pathToFileURL(resolvedPath).href, context);
      }
    }
  }

  return nextResolve(specifier, context);
}
