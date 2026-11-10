import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { flushSync } from 'react-dom'
import { Download, Library as LibraryIcon, Trash2, Upload, X } from 'lucide-react'
import { Dialog } from 'radix-ui'
import { Button } from '@/components/ui/button'
import { downloadFile, exportName } from '@/lib/download'
import { plural } from '@/lib/format'
import { StorageError, deleteAllPacks, deletePack, exportBlob, listPacks, savePack, type SavedPack } from '@/lib/storage'
import { revealPack } from '@/lib/reveal'

type LibraryProps = {
  // Goes up by one each time App saves a pack, so an open list shows it.
  version: number
  onOpenPack: (record: SavedPack) => void
  // The shown pack closes when it is deleted.
  onDeleted: (id: string) => void
  // Everything WardWise saved in this browser is gone: the packs and the notes they were written from.
  onDeletedAll: () => void
}

// What the line under the toolbar says, with an Undo for a single deletion.
type Notice = { kind: 'info' | 'error'; text: string; undo?: SavedPack }

const UNDO_MS = 8000
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

function messageOf(error: unknown) {
  return error instanceof StorageError ? error.message : 'Something went wrong. Please try again.'
}

export function Library({ version, onOpenPack, onDeleted, onDeletedAll }: LibraryProps) {
  const [open, setOpen] = useState(false)
  const [packs, setPacks] = useState<SavedPack[] | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [confirmingAll, setConfirmingAll] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const importRef = useRef<HTMLButtonElement>(null)
  const undoRef = useRef<HTMLButtonElement>(null)
  const deleteAllRef = useRef<HTMLButtonElement>(null)
  // Set when the student opens a pack, so closing the drawer hands focus to the pack, not back to the button.
  const openingPack = useRef(false)

  // Bumped after each change made here, to read the list again.
  const [reloads, setReloads] = useState(0)
  const reload = () => setReloads((count) => count + 1)

  // Read from the database each time the drawer opens (another tab may have saved packs), after each save in
  // App, and after each change here. If a newer read starts first, the older answer is ignored.
  useEffect(() => {
    if (!open) return
    let latest = true
    listPacks().then(
      (list) => {
        if (latest) setPacks(list)
      },
      (error) => {
        if (!latest) return
        setPacks([])
        setNotice({ kind: 'error', text: messageOf(error) })
      },
    )
    return () => {
      latest = false
    }
  }, [open, version, reloads])

  // The chance to undo a deletion lasts a few seconds.
  useEffect(() => {
    if (!notice?.undo) return
    const timer = window.setTimeout(() => {
      // Undo is about to disappear; if it has focus, hand focus on first.
      if (document.activeElement === undoRef.current) importRef.current?.focus()
      setNotice(null)
    }, UNDO_MS)
    return () => window.clearTimeout(timer)
  }, [notice])

  function changeOpen(next: boolean) {
    setOpen(next)
    if (!next) {
      setNotice(null)
      setConfirmingAll(false)
    }
  }

  function openPack(record: SavedPack) {
    openingPack.current = true
    onOpenPack(record)
    setOpen(false)
  }

  async function remove(record: SavedPack) {
    try {
      await deletePack(record.id)
      onDeleted(record.id)
      // Drawn at once, so the Undo button exists to take focus: the deleted row's buttons are gone.
      flushSync(() => setNotice({ kind: 'info', text: `Deleted "${record.pack.title}".`, undo: record }))
      undoRef.current?.focus()
      reload()
    } catch (error) {
      setNotice({ kind: 'error', text: messageOf(error) })
    }
  }

  async function undo(record: SavedPack) {
    try {
      await savePack(record)
      importRef.current?.focus()
      setNotice({ kind: 'info', text: `Restored "${record.pack.title}".` })
      reload()
    } catch (error) {
      setNotice({ kind: 'error', text: messageOf(error) })
    }
  }

  function askToRemoveAll() {
    setConfirmingAll(true)
    // Another tab may have saved packs since the list was read.
    reload()
  }

  function cancelRemoveAll() {
    flushSync(() => setConfirmingAll(false))
    deleteAllRef.current?.focus()
  }

  async function removeAll() {
    try {
      await deleteAllPacks()
      onDeletedAll()
      setConfirmingAll(false)
      setNotice({ kind: 'info', text: 'All your packs and notes were deleted from this browser.' })
      reload()
      importRef.current?.focus()
    } catch (error) {
      setNotice({ kind: 'error', text: messageOf(error) })
    }
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      // Loaded on first use: see import-packs.ts.
      const { importPacks } = await import('@/lib/import-packs')
      const { added, alreadyHere, unreadable } = await importPacks(file)
      const parts = [`Imported ${plural(added, 'study pack')}.`]
      if (alreadyHere > 0) parts.push(`${plural(alreadyHere, 'pack')} ${alreadyHere === 1 ? 'was' : 'were'} already here.`)
      if (unreadable > 0) parts.push(`${plural(unreadable, 'pack')} could not be read and ${unreadable === 1 ? 'was' : 'were'} left out.`)
      setNotice({ kind: 'info', text: parts.join(' ') })
      reload()
    } catch (error) {
      setNotice({ kind: 'error', text: messageOf(error) })
    }
  }

  function exportAll() {
    if (packs && packs.length > 0) downloadFile(exportBlob(packs), exportName(null))
  }

  const count = packs?.length ?? 0

  return (
    <Dialog.Root open={open} onOpenChange={changeOpen}>
      <Dialog.Trigger asChild>
        <Button variant="ghost" className="rounded-full">
          <LibraryIcon aria-hidden="true" />
          My packs
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-reduce:animate-none" />
        <Dialog.Content
          onCloseAutoFocus={(event) => {
            if (!openingPack.current) return
            openingPack.current = false
            event.preventDefault()
            revealPack()
          }}
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l bg-card shadow-2xl outline-none data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:animate-in data-[state=open]:slide-in-from-right motion-reduce:animate-none"
        >
          <header className="flex items-start gap-3 border-b p-5">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-base font-semibold">My study packs</Dialog.Title>
              <Dialog.Description className="text-sm text-muted-foreground">
                Saved in this browser only, not on WardWise's server.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close">
                <X />
              </Button>
            </Dialog.Close>
          </header>

          <div className="flex flex-wrap items-center gap-2 border-b px-5 py-3">
            <Button ref={importRef} variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload aria-hidden="true" />
              Import
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleImport}
              className="hidden"
              aria-hidden="true"
              tabIndex={-1}
            />
            <Button variant="outline" size="sm" onClick={exportAll} disabled={count === 0}>
              <Download aria-hidden="true" />
              Export all
            </Button>
            <span className="ml-auto text-xs text-muted-foreground tabular-nums">{packs && plural(count, 'pack')}</span>
          </div>

          <div role="status" className="px-5">
            {notice && (
              <p className={notice.kind === 'error' ? 'pt-3 text-sm text-destructive' : 'pt-3 text-sm text-muted-foreground'}>
                {notice.text}{' '}
                {notice.undo && (
                  <button
                    ref={undoRef}
                    type="button"
                    onClick={() => notice.undo && undo(notice.undo)}
                    className="font-medium text-primary hover:underline"
                  >
                    Undo
                  </button>
                )}
              </p>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-3">
            {packs === null ? (
              <p className="text-sm text-muted-foreground">Loading your packs...</p>
            ) : packs.length === 0 ? (
              <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                No saved packs yet. Every study pack WardWise writes is saved here automatically.
              </p>
            ) : (
              <ul className="flex flex-col gap-2" aria-label="Saved study packs">
                {packs.map((record) => (
                  <li key={record.id} className="flex items-start gap-2 rounded-lg border bg-background/50 p-3">
                    <button
                      type="button"
                      onClick={() => openPack(record)}
                      className="min-w-0 flex-1 cursor-pointer rounded-md text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      <span className="block truncate text-sm font-medium">{record.pack.title}</span>
                      <span className="block text-xs text-muted-foreground">
                        {dateFormat.format(new Date(record.savedAt))}
                        {' · '}
                        {plural(record.pack.flashcards.length, 'card')}, {plural(record.pack.questions.length, 'question')}
                        {record.origin === 'imported' && ' · Imported'}
                      </span>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Export "${record.pack.title}"`}
                      onClick={() => downloadFile(exportBlob([record]), exportName(record.pack.title))}
                    >
                      <Download />
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label={`Delete "${record.pack.title}"`} onClick={() => remove(record)}>
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <footer className="flex flex-col gap-3 border-t p-5 text-xs text-muted-foreground">
            <p>
              Clearing your browsing data, or using a private window, removes these packs. Export to keep a copy: the
              file includes your notes and transcript, so store it as you would your own notes.
            </p>
            {packs !== null &&
              (confirmingAll ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-foreground">
                    Delete all your packs and notes from this browser? This cannot be undone.
                  </span>
                  <Button variant="destructive" size="sm" onClick={removeAll}>
                    Delete all
                  </Button>
                  {/* Focus lands on the safe choice. */}
                  <Button variant="ghost" size="sm" autoFocus onClick={cancelRemoveAll}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <button
                  ref={deleteAllRef}
                  type="button"
                  onClick={askToRemoveAll}
                  className="self-start font-medium text-destructive hover:underline"
                >
                  Delete all packs and notes (for example on a shared computer)
                </button>
              ))}
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
