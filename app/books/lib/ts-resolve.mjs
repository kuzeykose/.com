import path from 'node:path'
import { pathToFileURL } from 'node:url'

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && !path.extname(specifier)) {
    try {
      return await nextResolve(specifier + '.ts', context)
    } catch {
      try {
        const dir = context.parentURL
          ? new URL('.', context.parentURL)
          : pathToFileURL(process.cwd() + '/')
        return await nextResolve(new URL(specifier + '.ts', dir).href, context)
      } catch {
        return nextResolve(specifier, context)
      }
    }
  }
  return nextResolve(specifier, context)
}
