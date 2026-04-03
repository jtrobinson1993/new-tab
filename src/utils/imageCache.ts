const DB_NAME = 'new-tab-bg'
const STORE_NAME = 'images'
const MAX_IMAGES = 6
const MAX_AGE = 60 * 60 * 1000 // 1 hour

interface CachedImage {
  id: string
  blob: Blob
  timestamp: number
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME)
}

function getAllImages(db: IDBDatabase): Promise<CachedImage[]> {
  return new Promise((resolve, reject) => {
    const req = tx(db, 'readonly').getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function pruneExpired(db: IDBDatabase): Promise<CachedImage[]> {
  const all = await getAllImages(db)
  const now = Date.now()
  const expired = all.filter((img) => now - img.timestamp > MAX_AGE)
  const store = tx(db, 'readwrite')
  for (const img of expired) {
    store.delete(img.id)
  }
  return all.filter((img) => now - img.timestamp <= MAX_AGE)
}

export async function getCachedBackground(): Promise<string | null> {
  const db = await openDB()
  const valid = await pruneExpired(db)
  if (valid.length === 0) return null
  const pick = valid[Math.floor(Math.random() * valid.length)]!
  return URL.createObjectURL(pick.blob)
}

export async function getCachedImageCount(): Promise<number> {
  const db = await openDB()
  const valid = await pruneExpired(db)
  return valid.length
}

export async function cacheImage(url: string): Promise<string> {
  const res = await fetch(url)
  const blob = await res.blob()
  const id = crypto.randomUUID()

  const db = await openDB()
  const store = tx(db, 'readwrite')
  const entry: CachedImage = { id, blob, timestamp: Date.now() }
  store.put(entry)

  return URL.createObjectURL(blob)
}
