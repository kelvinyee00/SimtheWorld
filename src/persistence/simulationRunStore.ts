import { ToFileExportFormat } from "@/src/simulation/blocks/toFileBlock";

/**
 * IndexedDB persistence adapter for P3-2 simulation run exports.
 *
 * Database policy:
 * - Database name: `web-simulink`
 * - Object store: `simulationRunExports`
 * - Key path: `id` (UUID-like string)
 *
 * Why IndexedDB:
 * - Supports offline, browser-local archival of larger payloads than localStorage.
 * - Asynchronous API avoids blocking interaction/render loops.
 */
const DB_NAME = "web-simulink";
const DB_VERSION = 1;
const RUN_STORE_NAME = "simulationRunExports";
const RUN_STORE_CREATED_AT_INDEX = "byCreatedAtMs";

export interface PersistedSimulationRunRecord {
  id: string;
  nodeId: string;
  fileName: string;
  format: ToFileExportFormat;
  sampleCount: number;
  payload: string;
  createdAtMs: number;
}

interface SaveSimulationRunRecordInput {
  nodeId: string;
  fileName: string;
  format: ToFileExportFormat;
  sampleCount: number;
  payload: string;
}

function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

function makeRecordId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `run-${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (!isIndexedDbAvailable()) {
    return Promise.resolve(null);
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(RUN_STORE_NAME)) {
        const store = database.createObjectStore(RUN_STORE_NAME, { keyPath: "id" });
        store.createIndex(RUN_STORE_CREATED_AT_INDEX, "createdAtMs", { unique: false });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error ?? new Error("IndexedDB open failed."));
    };
  });
}

function runTransaction<T>(params: {
  database: IDBDatabase;
  mode: IDBTransactionMode;
  execute: (store: IDBObjectStore) => IDBRequest<T>;
}): Promise<T> {
  const { database, mode, execute } = params;

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(RUN_STORE_NAME, mode);
    const store = transaction.objectStore(RUN_STORE_NAME);
    const request = execute(store);

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error ?? new Error("IndexedDB transaction request failed."));
    };

    transaction.onerror = () => {
      reject(transaction.error ?? new Error("IndexedDB transaction failed."));
    };
  });
}

export async function saveSimulationRunRecord(
  input: SaveSimulationRunRecordInput
): Promise<PersistedSimulationRunRecord | null> {
  const database = await openDatabase();
  if (!database) {
    return null;
  }

  const record: PersistedSimulationRunRecord = {
    id: makeRecordId(),
    createdAtMs: Date.now(),
    nodeId: input.nodeId,
    fileName: input.fileName,
    format: input.format,
    sampleCount: input.sampleCount,
    payload: input.payload,
  };

  await runTransaction({
    database,
    mode: "readwrite",
    execute: (store) => store.put(record),
  });

  return record;
}

export async function listRecentSimulationRunRecords(
  limit = 20
): Promise<PersistedSimulationRunRecord[]> {
  const database = await openDatabase();
  if (!database) {
    return [];
  }

  const records = await runTransaction<PersistedSimulationRunRecord[]>({
    database,
    mode: "readonly",
    execute: (store) => store.getAll(),
  });

  const sorted = records
    .slice()
    .sort((left, right) => right.createdAtMs - left.createdAtMs);

  return sorted.slice(0, Math.max(1, Math.floor(limit)));
}
