// Which database (if any) a note path belongs to — powers the row-as-page
// editable property panel in the Pages editor. A task note opened as a page
// shows the Tracker's fields as editable properties at the top, Notion-style.
//
// Scripts are intentionally NOT registered yet: their editor flow is the
// established daily driver, and adding a 9-field panel there is a separate,
// opt-in decision. Adding SCRIPTS_DB here is the one-line extension when wanted.

import type { DatabaseDef } from '../lib/types'
import { TRACKER_DB } from './tracker'

const REGISTRY: DatabaseDef[] = [TRACKER_DB]

export function databaseForPath(path: string): DatabaseDef | null {
  return REGISTRY.find((d) => path.startsWith(d.pathPrefix)) ?? null
}
