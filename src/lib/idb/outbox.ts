import { set, del, entries } from 'idb-keyval'
import { useState, useEffect } from 'react'
import { outboxStore } from './index'
import {
  updateRiderDeliveryStatusFn,
  depositRiderCashFn,
  updateRiderLiveFn,
} from '#/server/operations/operations.functions'
import { toast } from 'sonner'

export type OutboxType = 'delivery_status' | 'cash_handover' | 'rider_live'

export interface OutboxAction {
  id: string // client-generated UUID idempotency key
  type: OutboxType
  payload: any
  createdAt: number
  retries: number
  status: 'pending' | 'syncing' | 'failed'
}

let isFlushing = false
const listeners = new Set<() => void>()

function notifyListeners() {
  for (const listener of listeners) {
    listener()
  }
}

/**
 * Queue an action for offline-first reliable dispatch.
 */
export async function queueOutboxAction(
  type: OutboxType,
  payload: any,
): Promise<string> {
  const id = `outbox_${crypto.randomUUID()}`
  const action: OutboxAction = {
    id,
    type,
    payload,
    createdAt: Date.now(),
    retries: 0,
    status: 'pending',
  }

  if (outboxStore) {
    await set(id, action, outboxStore)
  }

  notifyListeners()

  // Attempt immediate flush if online
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    flushOutboxQueue().catch(() => {})
  } else {
    toast.info('Action saved offline. Will sync when reconnected.')
  }

  return id
}

/**
 * Get all actions currently pending in outbox.
 */
export async function getPendingOutboxActions(): Promise<OutboxAction[]> {
  if (!outboxStore) return []
  try {
    const all = await entries<string, OutboxAction>(outboxStore)
    return all
      .map(([, action]) => action)
      .sort((a, b) => a.createdAt - b.createdAt)
  } catch {
    return []
  }
}

/**
 * Flush all pending outbox actions in FIFO order.
 */
export async function flushOutboxQueue(): Promise<{
  successCount: number
  failedCount: number
}> {
  if (isFlushing || !outboxStore) {
    return { successCount: 0, failedCount: 0 }
  }

  isFlushing = true
  let successCount = 0
  let failedCount = 0

  try {
    const queue = await getPendingOutboxActions()
    if (queue.length === 0) {
      isFlushing = false
      return { successCount: 0, failedCount: 0 }
    }

    for (const item of queue) {
      try {
        if (item.type === 'delivery_status') {
          await updateRiderDeliveryStatusFn({
            data: item.payload,
          })
        } else if (item.type === 'cash_handover') {
          await depositRiderCashFn({
            data: item.payload,
          })
        } else {
          await updateRiderLiveFn({
            data: item.payload,
          })
        }

        // Successfully processed, remove from IDB
        await del(item.id, outboxStore)
        successCount++
      } catch (err: any) {
        console.warn(`[Outbox] Action ${item.id} sync failed:`, err)
        item.retries += 1
        item.status = 'failed'
        await set(item.id, item, outboxStore)
        failedCount++
        // Stop processing further items to preserve order on network failures
        break
      }
    }

    if (successCount > 0) {
      toast.success(`Synced ${successCount} offline action(s) successfully!`)
    }
  } finally {
    isFlushing = false
    notifyListeners()
  }

  return { successCount, failedCount }
}

// Set up automatic listeners in browser environment
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    toast.info('Back online! Syncing outbox queue...')
    flushOutboxQueue()
  })

  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && navigator.onLine) {
      flushOutboxQueue()
    }
  })
}

/**
 * React hook to observe offline outbox state.
 */
export function useRiderOutbox() {
  const [pendingCount, setPendingCount] = useState(0)
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  )

  useEffect(() => {
    let mounted = true

    async function update() {
      const pending = await getPendingOutboxActions()
      if (mounted) {
        setPendingCount(pending.length)
      }
    }

    update()
    listeners.add(update)

    const onOnline = () => {
      setIsOnline(true)
      update()
    }
    const onOffline = () => {
      setIsOnline(false)
      update()
    }

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    return () => {
      mounted = false
      listeners.delete(update)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  return {
    pendingCount,
    isOnline,
    flushOutbox: flushOutboxQueue,
  }
}
