import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = 'argus.offlineQueue.v1';

export interface QueuedRequest {
  id:        string;
  sessionId: string;
  message:   string;
  timestamp: number;
  attempts:  number;
  lastError?: string;
}

const MAX_RETRIES = 90;

const uuid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const loadQueue = async (): Promise<QueuedRequest[]> => {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedRequest[]) : [];
  } catch {
    return [];
  }
};

const saveQueue = async (queue: QueuedRequest[]): Promise<void> => {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
};

export const enqueueRequest = async (
  sessionId: string,
  message:   string,
): Promise<void> => {
  const queue = await loadQueue();
  queue.push({
    id:        uuid(),
    sessionId,
    message,
    timestamp: Date.now(),
    attempts:  0,
  });
  await saveQueue(queue);
};

export const processQueue = async (
  sendFn:  (sessionId: string, message: string) => Promise<void>,
  onError?: (req: QueuedRequest, error: Error) => void,
): Promise<void> => {
  const queue = await loadQueue();
  const remaining: QueuedRequest[] = [];

  for (const req of queue) {
    if (req.attempts >= MAX_RETRIES) {
      // Drop after 90 attempts
      onError?.(req, new Error(`Max retries (${MAX_RETRIES}) exceeded: ${req.lastError ?? 'unknown'}`));
      continue;
    }

    try {
      await sendFn(req.sessionId, req.message);
      // Success — do not add back to queue
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      onError?.(req, error);
      remaining.push({
        ...req,
        attempts:  req.attempts + 1,
        lastError: error.message,
      });
    }
  }

  await saveQueue(remaining);
};

export const getQueueStats = async (): Promise<{
  total:       number;
  maxAttempts: number;
}> => {
  const queue = await loadQueue();
  return {
    total:       queue.length,
    maxAttempts: queue.reduce((m, r) => Math.max(m, r.attempts), 0),
  };
};

export const clearQueue = async (): Promise<void> => {
  await AsyncStorage.removeItem(QUEUE_KEY);
};
