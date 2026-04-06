import { SignalValue, SimulationBlockDefinition } from "@/src/simulation/types";

/**
 * WebSocket Send/Receive Blocks (P13-1a)
 *
 * Design Philosophy:
 * - WebSocket I/O is inherently asynchronous and non-deterministic.
 * - The simulation engine remains deterministic by treating WebSocket operations as external.
 * - Actual WebSocket connections are managed by a_side-channel_ WebSocketManager in the UI layer.
 * - Blocks expose connection state and message buffers through runtime state.
 *
 * Contract:
 * - WebSocketSend: Captures input value, queues for transmission post-tick.
 * - WebSocketReceive: Emits last received message (or default if none).
 * - Connection lifecycle (open/close/error) tracked in state but managed externally.
 *
 * Determinism Notes:
 * - Send: Transmission happens after step completes (fire-and-forget).
 * - Receive: Last-message-wins per tick; duplicates overwrite.
 * - Reconnection: Managed by external WebSocketManager with exponential backoff.
 */

// --- WebSocket Send Block ---

export const WEBSOCKET_SEND_BLOCK_TYPE = "webSocketSend" as const;

export type WebSocketMessageFormat = "json" | "binary";

export interface WebSocketSendBlockState {
  url: string;
  messageFormat: WebSocketMessageFormat;
  reconnectIntervalMs: number;
  heartbeatIntervalMs: number;
  connected: boolean;
  connecting: boolean;
  lastError: string | null;
  messagesSent: number;
  lastSendTick: number;
}

export interface WebSocketSendParams {
  url: string;
  messageFormat: WebSocketMessageFormat;
  reconnectIntervalMs: number;
  heartbeatIntervalMs: number;
}

const DEFAULT_WEBSOCKET_URL = "ws://localhost:8080/sim";
const DEFAULT_MESSAGE_FORMAT: WebSocketMessageFormat = "json";
const DEFAULT_RECONNECT_INTERVAL_MS = 5000;
const DEFAULT_HEARTBEAT_INTERVAL_MS = 0; // Disabled by default

function sanitizeUrl(raw: unknown): string {
  if (typeof raw !== "string") {
    return DEFAULT_WEBSOCKET_URL;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return DEFAULT_WEBSOCKET_URL;
  }
  // Basic validation - must start with ws:// or wss://
  if (!trimmed.startsWith("ws://") && !trimmed.startsWith("wss://")) {
    return DEFAULT_WEBSOCKET_URL;
  }
  return trimmed.slice(0, 512); // Max URL length
}

function sanitizeMessageFormat(raw: unknown): WebSocketMessageFormat {
  return raw === "binary" ? "binary" : DEFAULT_MESSAGE_FORMAT;
}

function sanitizeIntervalMs(raw: unknown, defaultValue: number): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return defaultValue;
  }
  const integer = Math.max(0, Math.floor(raw));
  return Math.min(integer, 300000); // Max 5 minutes
}

function buildWebSocketSendState(
  params: Record<string, unknown>,
  previousState: unknown
): WebSocketSendBlockState {
  const parsedParams: WebSocketSendParams = {
    url: sanitizeUrl(params.url),
    messageFormat: sanitizeMessageFormat(params.messageFormat),
    reconnectIntervalMs: sanitizeIntervalMs(
      params.reconnectIntervalMs,
      DEFAULT_RECONNECT_INTERVAL_MS
    ),
    heartbeatIntervalMs: sanitizeIntervalMs(
      params.heartbeatIntervalMs,
      DEFAULT_HEARTBEAT_INTERVAL_MS
    ),
  };

  // Preserve runtime state if available
  if (
    typeof previousState === "object" &&
    previousState !== null &&
    "url" in previousState
  ) {
    const candidate = previousState as WebSocketSendBlockState;
    return {
      ...parsedParams,
      connected: candidate.connected ?? false,
      connecting: candidate.connecting ?? false,
      lastError: candidate.lastError ?? null,
      messagesSent: candidate.messagesSent ?? 0,
      lastSendTick: candidate.lastSendTick ?? -1,
    };
  }

  return {
    ...parsedParams,
    connected: false,
    connecting: false,
    lastError: null,
    messagesSent: 0,
    lastSendTick: -1,
  };
}

/**
 * WebSocket Send Block
 *
 * Captures input values and makes them available for external transmission.
 * Actual WebSocket operations are handled by the UI layer WebSocketManager.
 */
export const WebSocketSendBlock: SimulationBlockDefinition = {
  type: WEBSOCKET_SEND_BLOCK_TYPE,
  inputPortTypes: { value: "any" },
  outputPortTypes: {
    connected: "boolean",
    messagesSent: "number",
  },
  initialize: (params) => buildWebSocketSendState(params, undefined),
  step: ({ tick, timeMs, params, inputs, previousState }) => {
    const state = buildWebSocketSendState(params, previousState);
    const inputValue = inputs.value ?? null;

    // Increment message counter if we have a value to send
    const hasValueToSend = inputValue !== null && inputValue !== undefined;
    const messagesSent = hasValueToSend
      ? state.messagesSent + 1
      : state.messagesSent;

    const nextState: WebSocketSendBlockState = {
      ...state,
      messagesSent,
      lastSendTick: hasValueToSend ? tick : state.lastSendTick,
    };

    // The actual send operation happens post-tick via side-channel.
    // We expose: current input value, connection status, send metrics.
    return {
      outputs: {
        // Connection status for feedback/debugging
        connected: state.connected,
        // Message counter for debugging
        messagesSent: messagesSent,
      },
      nextState,
      // Side-channel payload for WebSocketManager
      _sideChannel: {
        type: "webSocketSend",
        payload: {
          tick,
          timeMs,
          value: inputValue,
          url: state.url,
          format: state.messageFormat,
        },
      },
    };
  },
};

// --- WebSocket Receive Block ---

export const WEBSOCKET_RECEIVE_BLOCK_TYPE = "webSocketReceive" as const;

export type WebSocketOutputType = "number" | "boolean" | "json" | "string";

export interface WebSocketReceiveBlockState {
  url: string;
  outputType: WebSocketOutputType;
  defaultValue: SignalValue;
  connected: boolean;
  connecting: boolean;
  lastError: string | null;
  messagesReceived: number;
  lastMessage: SignalValue;
  lastReceiveTick: number;
}

export interface WebSocketReceiveParams {
  url: string;
  outputType: WebSocketOutputType;
  defaultValue: SignalValue;
}

const DEFAULT_OUTPUT_TYPE: WebSocketOutputType = "json";
const DEFAULT_SIGNAL_VALUE: SignalValue = null;

function sanitizeOutputType(raw: unknown): WebSocketOutputType {
  if (
    raw === "number" ||
    raw === "boolean" ||
    raw === "json" ||
    raw === "string"
  ) {
    return raw;
  }
  return DEFAULT_OUTPUT_TYPE;
}

function coerceValue(
  raw: unknown,
  outputType: WebSocketOutputType
): SignalValue {
  switch (outputType) {
    case "number":
      if (typeof raw === "number" && Number.isFinite(raw)) {
        return raw;
      }
      if (typeof raw === "string") {
        const parsed = parseFloat(raw);
        return Number.isFinite(parsed) ? parsed : 0;
      }
      return 0;
    case "boolean":
      if (typeof raw === "boolean") {
        return raw;
      }
      if (typeof raw === "number") {
        return raw !== 0;
      }
      if (typeof raw === "string") {
        return raw.toLowerCase() === "true" || raw === "1";
      }
      return false;
    case "string":
      if (typeof raw === "string") {
        return raw;
      }
      if (raw === null || raw === undefined) {
        return "";
      }
      return String(raw);
    case "json":
    default:
      // Pass through as-is for json type
      return raw as SignalValue;
  }
}

function sanitizeDefaultValue(
  raw: unknown,
  outputType: WebSocketOutputType
): SignalValue {
  if (raw === null || raw === undefined) {
    switch (outputType) {
      case "number":
        return 0;
      case "boolean":
        return false;
      case "string":
        return "";
      case "json":
      default:
        return null;
    }
  }
  return coerceValue(raw, outputType);
}

function buildWebSocketReceiveState(
  params: Record<string, unknown>,
  previousState: unknown
): WebSocketReceiveBlockState {
  const outputType = sanitizeOutputType(params.outputType);
  const defaultValue = sanitizeDefaultValue(params.defaultValue, outputType);

  const parsedParams: WebSocketReceiveParams = {
    url: sanitizeUrl(params.url),
    outputType,
    defaultValue,
  };

  // Preserve runtime state if available
  if (
    typeof previousState === "object" &&
    previousState !== null &&
    "url" in previousState
  ) {
    const candidate = previousState as WebSocketReceiveBlockState;
    return {
      ...parsedParams,
      connected: candidate.connected ?? false,
      connecting: candidate.connecting ?? false,
      lastError: candidate.lastError ?? null,
      messagesReceived: candidate.messagesReceived ?? 0,
      lastMessage: candidate.lastMessage ?? defaultValue,
      lastReceiveTick: candidate.lastReceiveTick ?? -1,
    };
  }

  return {
    ...parsedParams,
    connected: false,
    connecting: false,
    lastError: null,
    messagesReceived: 0,
    lastMessage: defaultValue,
    lastReceiveTick: -1,
  };
}

/**
 * WebSocket Receive Block
 *
 * Emits the last message received from the WebSocket connection.
 * Messages are delivered via side-channel from the UI layer WebSocketManager.
 */
export const WebSocketReceiveBlock: SimulationBlockDefinition = {
  type: WEBSOCKET_RECEIVE_BLOCK_TYPE,
  inputPortTypes: {},
  outputPortTypes: {
    value: "any",
    connected: "boolean",
    messagesReceived: "number",
  },
  initialize: (params) => buildWebSocketReceiveState(params, undefined),
  step: ({ params, previousState, inputs }) => {
    // NOTE: WebSocket messages are delivered via side-channel.
    // The WebSocketManager updates block state before each tick.
    const state = buildWebSocketReceiveState(params, previousState);

    // Determine output value (last received message or default)
    const outputValue = state.lastMessage ?? state.defaultValue;

    return {
      outputs: {
        value: outputValue,
        connected: state.connected,
        messagesReceived: state.messagesReceived,
      },
      nextState: state,
    };
  },
};

// --- Side-Channel Utilities ---

/**
 * Type guard for WebSocket send side-channel payloads.
 */
export function isWebSocketSendPayload(
  payload: unknown
): payload is {
  tick: number;
  timeMs: number;
  value: SignalValue;
  url: string;
  format: WebSocketMessageFormat;
} {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "tick" in payload &&
    "timeMs" in payload &&
    "value" in payload &&
    "url" in payload &&
    "format" in payload
  );
}

/**
 * Default message serializer for WebSocket send.
 */
export function serializeWebSocketMessage(
  tick: number,
  timeMs: number,
  value: SignalValue,
  format: WebSocketMessageFormat
): string | ArrayBuffer {
  if (format === "binary") {
    // Placeholder: JSON string to ArrayBuffer
    const str = JSON.stringify({ tick, timeMs, value });
    const encoder = new TextEncoder();
    return encoder.encode(str).buffer;
  }

  // Default JSON format with envelope
  return JSON.stringify({
    tick,
    timeMs,
    timestamp: new Date(timeMs).toISOString(),
    payload: value,
  });
}

/**
 * Default message deserializer for WebSocket receive.
 */
export function deserializeWebSocketMessage(
  data: string | ArrayBuffer | Blob,
  outputType: WebSocketOutputType
): SignalValue {
  let raw: unknown;

  try {
    if (typeof data === "string") {
      raw = JSON.parse(data);
    } else if (data instanceof ArrayBuffer) {
      const decoder = new TextDecoder();
      raw = JSON.parse(decoder.decode(data));
    } else if (data instanceof Blob) {
      // Async - handled by caller
      return null;
    }
  } catch {
    // If parsing fails, treat as raw string for string type, null otherwise
    if (outputType === "string" && typeof data === "string") {
      return data;
    }
    return null;
  }

  // Handle enveloped messages (with payload field)
  if (
    typeof raw === "object" &&
    raw !== null &&
    "payload" in (raw as Record<string, unknown>)
  ) {
    raw = (raw as Record<string, unknown>).payload;
  }

  return coerceValue(raw, outputType);
}