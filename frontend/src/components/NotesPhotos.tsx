import { useEffect, useRef, useState, type DragEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { AlertCircle, Camera, Check, NotebookPen, X } from 'lucide-react'
import { NotesCamera } from '@/components/NotesCamera'
import { NotesSketch } from '@/components/NotesSketch'
import { Panel } from '@/components/Panel'
import { Button } from '@/components/ui/button'
import { formatFileSize } from '@/lib/format'
import { spring } from '@/lib/motion'
import { cn } from '@/lib/utils'
import type { NotePhoto } from '@/types'

const MAX_PHOTOS = 5
const MAX_MB = 15
const TYPES = ['image/jpeg', 'image/png', 'image/webp']
// Clear photos are read more accurately, and misread doses are the costly mistakes.
const TIPS = ['Lay the page flat in good light', 'One page per photo, filling the frame', 'Write doses and units clearly']
let nextId = 0

type NotesPhotosProps = {
  photos: NotePhoto[]
  onAdd: (photos: NotePhoto[]) => void
  onRemove: (id: string) => void
}

// Students write by hand on rounds; a photo of each page is enough. On a phone, choosing a photo also offers the camera.
export function NotesPhotos({ photos, onAdd, onRemove }: NotesPhotosProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLButtonElement>(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cameraOpen, setCameraOpen] = useState(false)

  // A convenience check only. The server checks every photo again, by its content.
  function addFiles(list: FileList | File[] | null) {
    if (!list) return
    const accepted: NotePhoto[] = []
    const problems: string[] = []

    for (const file of Array.from(list)) {
      const duplicate = [...photos, ...accepted].some(
        (photo) => photo.file.name === file.name && photo.file.size === file.size,
      )
      if (!TYPES.includes(file.type)) problems.push(`${file.name} is not a JPEG, PNG or WebP photo.`)
      else if (file.size > MAX_MB * 1024 * 1024) problems.push(`${file.name} is larger than ${MAX_MB} MB.`)
      else if (duplicate) problems.push(`${file.name} is already added.`)
      else if (photos.length + accepted.length >= MAX_PHOTOS) {
        problems.push(`You can add up to ${MAX_PHOTOS} photos.`)
        break
      } else accepted.push({ id: `photo-${++nextId}`, file })
    }

    if (accepted.length) onAdd(accepted)
    setError(problems[0] ?? null)
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault()
    setDragging(true)
  }

  function handleDragLeave(event: DragEvent) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false)
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault()
    setDragging(false)
    addFiles(event.dataTransfer.files)
  }

  return (
    <Panel icon={NotebookPen} title="Handwritten notes" description="Photos of the notes you wrote by hand. WardWise reads them.">
      {cameraOpen ? (
        <NotesCamera
          room={MAX_PHOTOS - photos.length}
          onCapture={(file) => addFiles([file])}
          onClose={() => setCameraOpen(false)}
        />
      ) : (
        <>
          <motion.button
            ref={dropRef}
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            animate={{ scale: dragging ? 1.02 : 1 }}
            whileTap={{ scale: 0.99 }}
            transition={spring}
            className={cn(
              'hand-radius flex w-full flex-1 flex-col items-center justify-center gap-2 border-2 border-dashed px-4 py-5 text-center transition-colors outline-none focus-visible:ring-4 focus-visible:ring-ring/30',
              dragging ? 'border-primary bg-accent' : 'border-input hover:border-primary/50 hover:bg-accent/40',
            )}
          >
            <NotesSketch replay={dragging} className="h-24 w-auto lg:h-32" />
            <span className="text-sm font-medium">
              {dragging ? 'Drop to add' : (
                <>
                  Drop photos here or <span className="text-primary underline-offset-4 hover:underline">browse</span>
                </>
              )}
            </span>
            <span className="text-xs text-muted-foreground">
              One photo a page, up to {MAX_PHOTOS}. No patient names or details in the photo.
            </span>
          </motion.button>
          <ul className="mt-3 grid gap-1 text-xs text-muted-foreground">
            {TIPS.map((tip) => (
              <li key={tip} className="flex items-center gap-1.5">
                <Check className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                {tip}
              </li>
            ))}
          </ul>
          <input
            ref={inputRef}
            type="file"
            accept={TYPES.join(',')}
            multiple
            className="hidden"
            onChange={(event) => {
              addFiles(event.target.files)
              event.target.value = ''
            }}
          />
          <Button
            variant="link"
            size="sm"
            className="mt-3 h-auto self-center p-0 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:no-underline"
            aria-disabled={photos.length >= MAX_PHOTOS}
            onClick={() => photos.length < MAX_PHOTOS && setCameraOpen(true)}
          >
            <Camera /> Or take photos with the camera
          </Button>
        </>
      )}

      <AnimatePresence>
        {error && (
          <motion.p
            role="alert"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 overflow-hidden pt-3 text-sm text-destructive"
          >
            <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
            <span className="flex-1">{error}</span>
            <button type="button" onClick={() => setError(null)} aria-label="Dismiss message" className="rounded p-0.5 hover:bg-accent">
              <X className="size-3.5" />
            </button>
          </motion.p>
        )}
      </AnimatePresence>

      <ol className="grid grid-cols-3 gap-2 empty:hidden not-empty:mt-3 sm:grid-cols-5">
        <AnimatePresence initial={false}>
          {photos.map((photo, index) => (
            <motion.li
              key={photo.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              transition={spring}
              title={`${photo.file.name} · ${formatFileSize(photo.file.size)}`}
              className="relative aspect-3/4 overflow-hidden rounded-md border bg-background/60"
            >
              <Thumbnail file={photo.file} />
              <span className="absolute bottom-1 left-1 rounded bg-background/85 px-1.5 text-xs font-medium tabular-nums">
                {index + 1}
              </span>
              <button
                type="button"
                onClick={() => {
                  onRemove(photo.id)
                  dropRef.current?.focus()
                }}
                aria-label={`Remove page ${index + 1}, ${photo.file.name}`}
                className="absolute top-1 right-1 grid size-6 place-items-center rounded-full bg-background/85 hover:bg-background"
              >
                <X className="size-3.5" />
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
    </Panel>
  )
}

// A preview from a temporary address, released when the photo is removed.
function Thumbnail({ file }: { file: File }) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    const address = URL.createObjectURL(file)
    setUrl(address)
    return () => URL.revokeObjectURL(address)
  }, [file])

  return url ? <img src={url} alt="" className="size-full object-cover" /> : null
}
