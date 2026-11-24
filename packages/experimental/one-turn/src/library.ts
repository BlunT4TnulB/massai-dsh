/**
 * The library, as the mask sees it.
 *
 * The workshop's own published projects are a convention hint: the house style is
 * whatever the house already builds. The profile is computed from Postgres once
 * at boot and refreshed on a timer, then read synchronously by `normalise()` and
 * `compile()` — neither of which may await.
 *
 * @module @deepseek-ai/dsh-one-turn/library
 */

import { inferSkills, setCatalog } from './skills.ts'
import { libraryProfile, storeConfigured, type LibraryProfile } from './store.ts'

/** What is remembered in memory. */
let cache: LibraryProfile | undefined

/** Refresh the profile from storage. Called at boot and on a timer. */
export async function hydrateLibrary(): Promise<number> {
  try {
    if (!storeConfigured()) return 0
    cache = await libraryProfile()
    // The catalog is derived from the same rows: paths in, capabilities out.
    setCatalog(inferSkills((cache?.projects_detail ?? []).map(project => ({ name: project.name, paths: project.paths }))))
    return cache?.projects ?? 0
  } catch {
    return 0
  }
}

/** The profile in effect, or undefined when nothing has been published. */
export function currentLibrary(): LibraryProfile | undefined {
  return cache
}

/**
 * The mask section describing the library.
 * @returns the section body, or '' when the shelf is empty.
 */
export function libraryBlock(): string {
  if (cache === undefined || cache.projects === 0) return ''
  const stacks = cache.extensions.map(item => `${item.ext} (${item.files})`).join(', ')
  return [
    `THE WORKSHOP'S OWN LIBRARY holds ${cache.projects} published project(s).`,
    `The stacks that recur there: ${stacks}.`,
    'When the request is in the same family as one of those, follow their conventions: the same',
    'file layout, the same naming, the same dependency restraint. You are building for a house',
    'that already has a style, not for a blank page.',
  ].join('\n')
}
