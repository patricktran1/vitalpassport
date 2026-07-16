import { useEffect } from 'react'

const DROP_ZONE_SELECTOR = '.drop-zone'

function isFileDrag(event: DragEvent) {
  return Array.from(event.dataTransfer?.types || []).includes('Files')
}

function dropZoneFromEvent(event: DragEvent) {
  const target = event.target
  return target instanceof Element ? target.closest<HTMLElement>(DROP_ZONE_SELECTOR) : null
}

function fileInputForZone(zone: HTMLElement) {
  const sibling = zone.nextElementSibling
  if (sibling instanceof HTMLInputElement && sibling.type === 'file') return sibling
  return zone.parentElement?.querySelector<HTMLInputElement>('input[type="file"]') || null
}

export function FileDropGuard() {
  useEffect(() => {
    let activeZone: HTMLElement | null = null

    const clearActiveZone = () => {
      activeZone?.classList.remove('is-dragging')
      activeZone = null
    }

    const setActiveZone = (zone: HTMLElement | null) => {
      if (zone === activeZone) return
      clearActiveZone()
      activeZone = zone
      activeZone?.classList.add('is-dragging')
    }

    const onDragEnter = (event: DragEvent) => {
      if (!isFileDrag(event)) return
      event.preventDefault()
      const zone = dropZoneFromEvent(event)
      if (zone) setActiveZone(zone)
    }

    const onDragOver = (event: DragEvent) => {
      if (!isFileDrag(event)) return
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
      setActiveZone(dropZoneFromEvent(event))
    }

    const onDragLeave = (event: DragEvent) => {
      if (!activeZone) return
      const relatedTarget = event.relatedTarget
      if (relatedTarget instanceof Node && activeZone.contains(relatedTarget)) return
      const hovered = document.elementFromPoint(event.clientX, event.clientY)
      if (hovered && activeZone.contains(hovered)) return
      clearActiveZone()
    }

    const onDrop = (event: DragEvent) => {
      if (!isFileDrag(event)) return
      event.preventDefault()

      const zone = dropZoneFromEvent(event)
      clearActiveZone()
      if (!zone) return

      event.stopPropagation()
      const droppedFiles = event.dataTransfer?.files
      const input = fileInputForZone(zone)
      if (!droppedFiles?.length || !input) return

      const transfer = new DataTransfer()
      transfer.items.add(droppedFiles[0])
      input.files = transfer.files
      input.dispatchEvent(new Event('change', { bubbles: true }))
    }

    const onDragEnd = () => clearActiveZone()

    document.addEventListener('dragenter', onDragEnter, true)
    document.addEventListener('dragover', onDragOver, true)
    document.addEventListener('dragleave', onDragLeave, true)
    document.addEventListener('drop', onDrop, true)
    document.addEventListener('dragend', onDragEnd, true)
    window.addEventListener('blur', onDragEnd)

    return () => {
      clearActiveZone()
      document.removeEventListener('dragenter', onDragEnter, true)
      document.removeEventListener('dragover', onDragOver, true)
      document.removeEventListener('dragleave', onDragLeave, true)
      document.removeEventListener('drop', onDrop, true)
      document.removeEventListener('dragend', onDragEnd, true)
      window.removeEventListener('blur', onDragEnd)
    }
  }, [])

  return null
}
