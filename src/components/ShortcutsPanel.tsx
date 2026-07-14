// The Shortcuts panel (⌘/) — a clean sheet over the ONE keymap (lib/keymap.ts).
// House overlay styling via Modal (Escape closes, both themes for free);
// reached from the ⌘/ chord, the sidebar's "⌨ Shortcuts" row, and the
// Omnibar's "Keyboard shortcuts" command — all three open THIS panel.

import { Modal } from './Modal'
import { KEYMAP } from '../lib/keymap'
import { closeShortcuts } from '../lib/ui'

export function ShortcutsPanel() {
  return (
    <Modal onClose={closeShortcuts} width={420} labelledBy="shortcuts-title">
      <div className="shortcuts" data-testid="shortcuts-panel">
        <h2 className="shortcuts-title" id="shortcuts-title">
          Keyboard shortcuts
        </h2>
        <table className="shortcuts-table">
          <tbody>
            {KEYMAP.map((k) => (
              <tr key={k.keys}>
                <td className="shortcuts-keys">
                  <kbd>{k.keys}</kbd>
                </td>
                <td className="shortcuts-does">
                  {k.does}
                  {k.where && <span className="shortcuts-where">{k.where}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  )
}
