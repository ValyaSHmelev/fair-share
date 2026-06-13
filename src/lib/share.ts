import type { FairEvent } from '@/types/models'

/**
 * Кодирует FairEvent в строку base64url через CompressionStream (встроен в браузер).
 * Результат помещается в hash URL: /share#{encoded}
 */
export async function encodeEvent(event: FairEvent): Promise<string> {
  const json = JSON.stringify(event)
  const encoder = new TextEncoder()
  const input = encoder.encode(json)

  const cs = new CompressionStream('gzip')
  const writer = cs.writable.getWriter()
  writer.write(input)
  writer.close()

  const compressed = await new Response(cs.readable).arrayBuffer()
  const bytes = new Uint8Array(compressed)

  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

/**
 * Декодирует строку base64url обратно в FairEvent.
 * Бросает Error если данные повреждены или невалидны.
 */
export async function decodeEvent(encoded: string): Promise<FairEvent> {
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '=='.slice(0, (4 - (base64.length % 4)) % 4)

  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }

  const ds = new DecompressionStream('gzip')
  const writer = ds.writable.getWriter()
  writer.write(bytes)
  writer.close()

  const decompressed = await new Response(ds.readable).arrayBuffer()
  const decoder = new TextDecoder()
  const json = decoder.decode(decompressed)

  const event = JSON.parse(json)
  if (!event || typeof event !== 'object' || !event.id || !event.name || !Array.isArray(event.expenses)) {
    throw new Error('Невалидные данные мероприятия')
  }
  return event as FairEvent
}

/** Строит полный URL для страницы /share с закодированным мероприятием. */
export async function buildShareUrl(event: FairEvent): Promise<string> {
  const encoded = await encodeEvent(event)
  const base = `${window.location.origin}${import.meta.env.BASE_URL}share`
  return `${base}#${encoded}`
}
