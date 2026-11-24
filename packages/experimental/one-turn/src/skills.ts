/**
 * Skills: what the workshop has actually built, grouped so it can be reached for.
 *
 * A library of raw files is an archive. A library that knows it contains four
 * geometry projects, a dozen dashboards and a scanner stack is a *capability* —
 * and a capability can be handed to the mask as context before a single token is
 * spent.
 *
 * Skills are inferred from file paths plus project names, not from a taxonomy
 * somebody typed by hand. That means the catalog grows by itself: publish a
 * project with `.dxf` files and "geometry" gains an example.
 *
 * @module @deepseek-ai/dsh-one-turn/skills
 */

/** One capability the library demonstrably has. */
export interface Skill {
  /** Stable id, used in URLs and logs. */
  readonly id: string
  /** Human label. */
  readonly label: string
  /** How many published projects show this capability. */
  readonly projects: number
  /** How many files across those projects are signals of it. */
  readonly files: number
  /** Up to three project names that show it, best evidence first. */
  readonly examples: readonly string[]
  /** Words in a request that should summon this skill. */
  readonly triggers: readonly string[]
}

/** How one capability is recognised. */
interface Rule {
  readonly id: string
  readonly label: string
  /** File extensions or path fragments that count as evidence. */
  readonly evidence: readonly string[]
  /** Words in a request that mean "this is that kind of work". */
  readonly triggers: readonly string[]
}

/** The catalog's rules. Extend this list, not the code around it. */
const RULES: readonly Rule[] = [
  {
    id: 'geometry',
    label: 'geometry & vector drawing',
    evidence: ['.dxf', '.svg', '.stl', '.step', '.obj', '.geo', 'three', 'canvas', 'shader', 'vectors'],
    triggers: ['geometry', 'geometric', 'vector', 'flower of life', 'sacred', 'diagram', 'drawing', 'shape', 'render', '3d', 'svg', 'cad', 'dxf'],
  },
  {
    id: 'dashboard',
    label: 'dashboards & data views',
    evidence: ['.csv', 'chart', 'dashboard', 'recharts', 'd3', 'table'],
    triggers: ['dashboard', 'chart', 'graph', 'report', 'metric', 'analytics', 'data view', 'table'],
  },
  {
    id: 'web-app',
    label: 'browser apps',
    evidence: ['.tsx', '.jsx', '.html', 'react', 'vite', 'tailwind'],
    triggers: ['page', 'site', 'app', 'interface', 'ui', 'form', 'button', 'landing'],
  },
  {
    id: 'scripting',
    label: 'scripts & automation',
    evidence: ['.py', '.sh', '.ps1', 'cli', 'argparse'],
    triggers: ['script', 'automate', 'rename', 'clean', 'backup', 'batch', 'cron', 'folder'],
  },
  {
    id: 'scanner',
    label: 'scanners & inventory',
    evidence: ['scan', 'scanner', 'inventory', 'cambium', 'ptt'],
    triggers: ['scanner', 'scan', 'inventory', 'cambium', 'network', 'device'],
  },
  {
    id: 'docs',
    label: 'documents & specs',
    evidence: ['.md', '.pdf', '.tex', 'readme', 'spec'],
    triggers: ['resume', 'invoice', 'readme', 'document', 'spec', 'parts list', 'plan'],
  },
  {
    id: 'testing',
    label: 'tests & verification',
    evidence: ['.test.', '.spec.', 'vitest', 'pytest', 'jest'],
    triggers: ['test', 'verify', 'check', 'validate'],
  },
  {
    id: 'service',
    label: 'services & APIs',
    evidence: ['api', 'server', 'express', 'fastapi', 'docker', 'dockerfile', 'route'],
    triggers: ['api', 'server', 'endpoint', 'service', 'backend'],
  },
]

/** A cached catalog, hydrated alongside the library profile. */
let catalog: Skill[] = []

/** One project's evidence. */
export interface ProjectEvidence {
  readonly name: string
  readonly paths: readonly string[]
}

/**
 * Infer the catalog from published projects.
 * @param projects - every published project with its file paths.
 * @returns the skills the library demonstrably has, strongest first.
 */
export function inferSkills(projects: readonly ProjectEvidence[]): Skill[] {
  const skills: Skill[] = []
  for (const rule of RULES) {
    const hits: Array<{ name: string; files: number }> = []
    for (const project of projects) {
      let files = 0
      for (const path of project.paths) {
        const lower = path.toLowerCase()
        if (rule.evidence.some(marker => lower.includes(marker))) files += 1
      }
      // A project name is evidence too: "Scanner-Tool" says what it is.
      const named = rule.evidence.some(marker => project.name.toLowerCase().includes(marker))
      if (files > 0 || named) hits.push({ name: project.name, files: named ? Math.max(files, 1) : files })
    }
    if (hits.length === 0) continue
    skills.push({
      id: rule.id,
      label: rule.label,
      projects: hits.length,
      files: hits.reduce((sum, hit) => sum + hit.files, 0),
      examples: hits.sort((a, b) => b.files - a.files).slice(0, 3).map(hit => hit.name),
      triggers: rule.triggers,
    })
  }
  return skills.sort((a, b) => b.projects - a.projects)
}

/** Replace the cached catalog. Called when the library profile refreshes. */
export function setCatalog(skills: readonly Skill[]): void {
  catalog = [...skills]
}

/** The catalog in effect. */
export function catalogOf(): readonly Skill[] {
  return catalog
}

/**
 * The skills a request is reaching for.
 * @param goal - the request as typed.
 * @param shape - the artifact shape.
 * @returns matching skills, strongest first, at most three.
 */
export function skillsFor(goal: string, shape: string): Skill[] {
  const text = ` ${goal.toLowerCase()} `
  const scored = catalog.map(skill => {
    const words = skill.triggers.filter(trigger => text.includes(trigger)).length
    // A document request inherits docs; a data view inherits dashboards.
    const shapeBonus = (shape === 'data-view' && skill.id === 'dashboard')
      || (shape === 'document' && skill.id === 'docs')
      || (shape === 'script' && skill.id === 'scripting')
      || (shape === 'single-file-app' && skill.id === 'web-app')
      ? 2
      : 0
    return { skill, score: words * 2 + shapeBonus }
  })
  return scored
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(entry => entry.skill)
}

/**
 * The mask section: the capabilities the request can lean on.
 * @param matches - skills the request is reaching for.
 * @returns the section body, or '' when nothing matches.
 */
export function skillBlock(matches: readonly Skill[]): string {
  if (matches.length === 0) return ''
  const lines = matches.map(skill =>
    `- ${skill.label}: this workshop has built it ${skill.projects} time(s) (${skill.files} files). Examples: ${skill.examples.join(', ')}.`)
  return [
    'THE WORKSHOP HAS BUILT THIS KIND OF THING BEFORE. Borrow the approach, not the content:',
    ...lines,
    'If the request sits inside one of these capabilities, say so in your report and reuse the shape',
    'of the existing work — the same structure, the same restraint. Do not copy text or data across.',
  ].join('\n')
}
