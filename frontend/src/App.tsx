import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { MotionConfig, motion } from 'motion/react'
import { Background } from '@/components/Background'
import { GenerateBar } from '@/components/GenerateBar'
import { Header } from '@/components/Header'
import { Hero } from '@/components/Hero'
import { KintsugiSeam } from '@/components/Kintsugi'
import { Library } from '@/components/Library'
import { MaterialsPanel } from '@/components/MaterialsPanel'
import { NotesPhotos } from '@/components/NotesPhotos'
import { PackView, type SaveStatus } from '@/components/PackView'
import { PrivacyNotice } from '@/components/PrivacyNotice'
import { Recorder } from '@/components/Recorder'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useLeaveWarning } from '@/hooks/use-leave-warning'
import { useLimits } from '@/hooks/use-limits'
import { useTheme } from '@/hooks/use-theme'
import { ApiError, sendSession, waitForJob, writePack } from '@/lib/api'
import { canWriteStraightAway, hasCorrections, needsCheck } from '@/lib/materials'
import { stagger } from '@/lib/motion'
import { StorageError, askToKeepPacks, newRecord, savePack, type SavedPack } from '@/lib/storage'
import type { Materials, NotePhoto, Recording, SendState, WriteState } from '@/types'

export default function App() {
  const { theme, chooseTheme } = useTheme()
  const limits = useLimits()
  const [recording, setRecording] = useState<Recording | null>(null)
  const [recordingLive, setRecordingLive] = useState(false)
  const [photos, setPhotos] = useState<NotePhoto[]>([])
  const [sendState, setSendState] = useState<SendState>({ status: 'idle' })
  // The student's corrected copy of what WardWise heard and read; the AI will write from this.
  const [draft, setDraft] = useState<Materials | null>(null)
  const [writeState, setWriteState] = useState<WriteState>({ status: 'idle' })
  // The pack on screen: just written, or opened from My packs. It stays until another replaces it.
  const [shown, setShown] = useState<{ record: SavedPack; save: SaveStatus } | null>(null)
  // What the last saved pack was written from, to tell whether a recording or corrections are only in memory.
  const [savedFrom, setSavedFrom] = useState<{ draft: Materials; recording: Recording | null; photos: NotePhoto[] } | null>(null)
  const [libraryVersion, setLibraryVersion] = useState(0)
  const generateRef = useRef<HTMLButtonElement>(null)
  // Each write gets a number. A write that finishes after the student moved on (closed the panel or
  // read again) is no longer the latest, and its result is ignored.
  const latestWrite = useRef(0)
  // The pack written from the current reading. Writing again after a correction replaces it, so My packs
  // does not keep the uncorrected version beside the corrected one.
  const packFromReading = useRef<string | null>(null)
  // The inputs as they are now, for code that resumes after a wait.
  const inputsNow = useRef({ recording, photos })
  useEffect(() => {
    inputsNow.current = { recording, photos }
  }, [recording, photos])

  function forgetWrite() {
    latestWrite.current += 1
    setWriteState({ status: 'idle' })
  }

  // An error about the old text no longer applies once the student changes it.
  function clearWriteError() {
    if (writeState.status === 'error') setWriteState({ status: 'idle' })
  }

  // The panel's close button disappears with it, so keyboard focus moves to a sensible place.
  // flushSync redraws first: until then the Generate button is still switched off and cannot take focus.
  function closeMaterials() {
    flushSync(() => {
      setSendState({ status: 'idle' })
      setDraft(null)
      forgetWrite()
    })
    const generate = generateRef.current
    if (generate && !generate.disabled) generate.focus()
  }

  async function handleGenerate() {
    setSendState({ status: 'sending' })
    setDraft(null)
    forgetWrite()
    packFromReading.current = null
    let materials: Materials
    try {
      const { job_id, receipt } = await sendSession(recording, photos)
      setSendState({ status: 'working', step: 'Waiting to start', receipt })
      const job = await waitForJob(job_id, (step) => setSendState({ status: 'working', step, receipt }))
      if (!job.materials) throw new ApiError('WardWise could not read your material.')
      materials = job.materials
      setSendState({ status: 'ready', materials, recording, photos })
      setDraft(materials)
    } catch (error) {
      setSendState({ status: 'error', message: messageOf(error) })
      return
    }
    // The pack is written straight away; the student checks what WardWise heard afterwards, below the pack.
    // Not if the student changed the recording or photos while WardWise was reading: they need reading again.
    const unchanged = inputsNow.current.recording === recording && inputsNow.current.photos === photos
    if (unchanged && canWriteStraightAway(materials, limits)) await handleWrite(materials)
  }

  // Writes from the corrected copy. The review state stays as it is, so a failure loses no corrections.
  async function handleWrite(materials: Materials) {
    const run = ++latestWrite.current
    const isLatest = () => run === latestWrite.current
    const update = (state: WriteState) => isLatest() && setWriteState(state)
    // The recording this pack comes from: the one WardWise read, since a changed recording means reading again.
    const source = recording
    const sourcePhotos = photos
    update({ status: 'writing', step: 'Sending to WardWise' })
    let record: SavedPack
    try {
      const { job_id } = await writePack(materials)
      const job = await waitForJob(job_id, (step) => update({ status: 'writing', step }))
      if (!job.pack) throw new ApiError('WardWise could not write your study pack.')
      record = newRecord(job.pack, { notes: materials.notes ?? '', transcript: materials.transcript })
    } catch (error) {
      update({ status: 'error', message: messageOf(error) })
      return
    }
    if (!isLatest()) return
    record = { ...record, id: packFromReading.current ?? record.id }
    packFromReading.current = record.id
    setWriteState({ status: 'done' })
    setShown({ record, save: { status: 'saving' } })

    // Saved straight away, so a reload or a closed tab cannot lose it.
    let save: SaveStatus
    try {
      await savePack(record)
      save = { status: 'saved' }
      setSavedFrom({ draft: materials, recording: source, photos: sourcePhotos })
      setLibraryVersion((version) => version + 1)
      void askToKeepPacks()
    } catch (error) {
      save = { status: 'failed', message: error instanceof StorageError ? error.message : '' }
    }
    // Only if the student has not opened another pack meanwhile.
    setShown((current) => (current?.record.id === record.id ? { record, save } : current))
  }

  function handleDeleted(id: string) {
    setShown((current) => (current?.record.id === id ? null : current))
  }

  function handleDeletedAll() {
    setShown(null)
  }

  // Adding or removing a photo makes a new list, and a new recording is a new object, so comparing
  // them with what WardWise read tells us whether the panel still matches the inputs.
  const inputsChanged =
    sendState.status === 'ready' &&
    (sendState.recording !== recording || sendState.photos !== photos)
  const corrected = sendState.status === 'ready' && draft !== null && hasCorrections(sendState.materials, draft)
  const packText = draft
    ? [draft.notes ?? '', draft.transcript ?? ''].join('\n')
    : ''
  const packSize = draft ? { chars: packText.length, empty: packText.trim() === '' } : null
  const showPanel = sendState.status === 'ready' && needsCheck(sendState.materials)

  // Ask before a reload or closed tab throws away work that exists only in this page: a job under way,
  // a recording or photos no saved pack was written from, or corrections made since the last saved pack.
  // Photos are not kept as a draft, since pictures of notes stay out of browser storage.
  const busy = sendState.status === 'sending' || sendState.status === 'working' || writeState.status === 'writing'
  const recordingAtRisk = recordingLive || (recording !== null && recording !== savedFrom?.recording)
  const photosAtRisk = photos.length > 0 && photos !== savedFrom?.photos
  const correctionsAtRisk = corrected && draft !== savedFrom?.draft
  useLeaveWarning(busy || recordingAtRisk || photosAtRisk || correctionsAtRisk)

  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider delayDuration={300}>
        <Background />
        <motion.main
          variants={stagger}
          initial="hidden"
          animate="show"
          className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:py-10"
        >
          <Header
            theme={theme}
            onThemeChange={chooseTheme}
            actions={
              <Library
                version={libraryVersion}
                onOpenPack={(record) => setShown({ record, save: { status: 'saved' } })}
                onDeleted={handleDeleted}
                onDeletedAll={handleDeletedAll}
              />
            }
          />
          <Hero />

          {/* The two ways in, side by side on wide screens and the same height, so neither leaves a gap. */}
          <div className="grid gap-6 md:grid-cols-2">
            <Recorder recording={recording} onChange={setRecording} onLiveChange={setRecordingLive} />
            <NotesPhotos
              photos={photos}
              onAdd={(added) => setPhotos((current) => [...current, ...added])}
              onRemove={(id) => setPhotos((current) => current.filter((photo) => photo.id !== id))}
            />
          </div>

          {/* A new key starts each pack with fresh cards, quiz and reading, including a pack written again. */}
          {shown && <PackView key={`${shown.record.id}:${shown.record.savedAt}`} record={shown.record} save={shown.save} />}

          {showPanel && sendState.status === 'ready' && draft && (
            <MaterialsPanel
              heard={sendState.materials}
              draft={draft}
              locked={writeState.status === 'writing'}
              attention={writeState.status !== 'writing' && writeState.status !== 'done'}
              onChange={(next) => {
                setDraft(next)
                clearWriteError()
              }}
              onClose={closeMaterials}
            />
          )}

          <GenerateBar
            generateRef={generateRef}
            photoCount={photos.length}
            recording={recording}
            recordingLive={recordingLive}
            sendState={sendState}
            inputsChanged={inputsChanged}
            corrected={corrected}
            correctionsPending={correctionsAtRisk}
            writeState={writeState}
            packSize={packSize}
            limits={limits}
            onGenerate={handleGenerate}
            onWrite={() => draft && handleWrite(draft)}
            onDismiss={() => setSendState({ status: 'idle' })}
          />

          <PrivacyNotice />

          <footer className="flex flex-col items-center gap-3 pb-2">
            <KintsugiSeam className="h-3 w-56 opacity-80" />
            <p className="text-center text-xs text-muted-foreground">
              Study packs are AI-generated and can contain mistakes. Check them against trusted sources.
            </p>
          </footer>
        </motion.main>
      </TooltipProvider>
    </MotionConfig>
  )
}

function messageOf(error: unknown) {
  return error instanceof ApiError ? error.message : 'Something went wrong. Please try again.'
}
