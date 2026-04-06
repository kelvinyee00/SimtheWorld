# P13-1 MQTT/WebSocket Bridge Specification

**Phase:** P13 (Advanced Control & External I/O)  
**Task:** P13-1 MQTT/WebSocket Bridge (External I/O)  
**Status:** In Specification  
**Created:** 2026-04-05

---

## 1. Overview

The MQTT/WebSocket Bridge enables bidirectional communication between the web-simulink simulation engine and external systems. This enables:

- **Hardware-in-the-Loop (HIL):** Connect physical sensors/actuators
- **Distributed Simulation:** Multiple browser instances synchronizing state
- **External Control:** Remote dashboards commanding the simulation
- **Cloud Integration:** Stream data to cloud analytics platforms

---

## 2. Technical Requirements

### 2.1 Transport Layer Options

| Protocol | Use Case | Implementation Notes |
|----------|----------|---------------------|
| **WebSocket** | Low-latency browser-to-browser, browser-to-local-server | Native browser API, sub-10ms latency |
| **MQTT** | IoT device integration, cloud pub/sub | Via MQTT.js over WebSocket transport |
| **MQTT over TLS** | Production IoT security | wss:// transport required |

### 2.2 Block Types

#### A. MQTT Publish Block (Sink)
- **Type ID:** `mqttPublish`
- **Inputs:** `value` (any signal type)
- **Parameters:**
  - `brokerUrl`: WebSocket endpoint (e.g., `ws://broker.hivemq.com:8000/mqtt`)
  - `topic`: MQTT topic string (supports template variables: `${tick}`, `${timeMs}`)
  - `qos`: 0 (at most once) | 1 (at least once) | 2 (exactly once)
  - `retain`: boolean
  - `clientId`: Auto-generated or user-defined
  - `username`, `password`: Optional authentication
- **Serialization:** JSON (default) | Binary (future)

#### B. MQTT Subscribe Block (Source)
- **Type ID:** `mqttSubscribe`
- **Outputs:** `value` (deserialized payload)
- **Parameters:**
  - `brokerUrl`: Same as Publish
  - `topic`: MQTT topic filter (+/# wildcards supported)
  - `qos`: Subscription QoS level
  - `clientId`: Must be unique per connection
  - `outputType`: `number` | `boolean` | `json` (passthrough)
  - `defaultValue`: Initial output before first message
- **Message Handling:**
  - Last-message-wins semantics per tick
  - Message queue limited to 1 (drop stale messages)

#### C. WebSocket Send Block (Sink)
- **Type ID:** `webSocketSend`
- **Inputs:** `value` (any signal type)
- **Parameters:**
  - `url`: WebSocket endpoint (e.g., `ws://localhost:8080/sim`)
  - `messageFormat`: `json` | `binary`
  - `reconnectInterval`: Auto-reconnect delay (ms)
  - `heartbeatInterval`: Keep-alive ping (ms, 0 = disabled)

#### D. WebSocket Receive Block (Source)
- **Type ID:** `webSocketReceive`
- **Outputs:** `value` (deserialized payload)
- **Parameters:**
  - `url`: Same as Send
  - `outputType`: Signal type hint
  - `defaultValue`: Initial output
  - `bufferSize`: Max queued messages (default: 1)

### 2.3 Message Serialization

**Default JSON Schema:**
```json
{
  "tick": 1234,
  "timeMs": 1234000,
  "timestamp": "2026-04-05T12:34:56.789Z",
  "payload": <signal_value>,
  "blockId": "mqtt-publish-1",
  "modelId": "optional-model-identifier"
}
```

**Compact Mode (optional):**
```json
[1234, 1234000, <payload>]
```

### 2.4 Engine Synchronization

| Mode | Description | Use Case |
|------|-------------|----------|
| **Async Fire-and-Forget** | Publisher transmits immediately, no ACK | Telemetry, metrics |
| **Sync Per-Tick** | Subscriber updates held for next tick | Control loops |
| **Time-Stamped Sync** | External events tagged with engine time | Playback, logging |

**Determinism Guarantees:**
- Subscriber values are sampled at tick start (previous message wins)
- Publisher transmits after tick completion (post-step)
- WebSocket guarantees per-tick ordering within a block

### 2.5 Connection Management

**Lifecycle:**
1. **Initialize:** Connect on simulation start (async)
2. **Running:** Transmit/receive each tick
3. **Pause:** Suspend message flow (optional)
4. **Stop:** Graceful disconnect with LWT (Last Will Testament)

**Error Handling:**
- Connection failure: Degrade gracefully, block outputs defaultValue
- Reconnection: Automatic with exponential backoff
- Timeout: Configurable, default 5000ms

### 2.6 Security Considerations

- **CORS:** WebSocket connections respect browser CORS policy
- **TLS:** Production requires wss:// + certificate validation
- **Authentication:** Support username/password, client certificates (future)
- **Credential Storage:** Stored in memory only, never persisted to model JSON

---

## 3. Block Definitions (Draft)

```typescript
// MQTT Publish Block
export const MqttPublishBlock: SimulationBlockDefinition = {
  type: "mqttPublish",
  inputPortTypes: { value: "any" },
  outputPortTypes: {},
  initialize: () => ({ client: null, connected: false }),
  step: ({ inputs, params, previousState }) => {
    // Post-step transmission via async side-channel
    return { outputs: {}, nextState: previousState };
  },
};

// MQTT Subscribe Block
export const MqttSubscribeBlock: SimulationBlockDefinition = {
  type: "mqttSubscribe",
  inputPortTypes: {},
  outputPortTypes: { value: "any" },
  initialize: (params) => ({ 
    lastMessage: params.defaultValue ?? null,
    connected: false 
  }),
  step: ({ previousState }) => ({
    outputs: { value: (previousState as any).lastMessage },
    nextState: previousState,
  }),
};
```

---

## 4. UI Requirements

### Block Visuals
- **Icon:** Radio tower / antenna icon (Wi-Fi signal aesthetic)
- **Color:** Purple (#a855f7) for I/O blocks (distinct from orange sources, blue sinks)
- **Status Indicator:** Small LED dot:
  - Gray: Disconnected
  - Yellow: Connecting
  - Green: Connected
  - Red: Error

### Inspector Panel
- Connection URL input with validation
- Topic field with wildcard helper
- QoS dropdown
- Authentication section (collapsible)
- Connection status display
- Message counter (sent/received)

### Canvas Feedback
- Edge animation: Dashed lines pulse when data flows
- Tooltip on hover: Last message payload (truncated)

---

## 5. Implementation Phases

| Phase | Scope | Deliverable |
|-------|-------|-------------|
| **P13-1a** | WebSocket Send/Receive | Basic ws:// support, JSON payload |
| **P13-1b** | MQTT over WebSocket | mqtt.js integration, QoS 0 |
| **P13-1c** | Security & QoS | TLS, QoS 1/2, authentication |
| **P13-1d** | Validation & Polish | Error recovery, UI polish, tests |

---

## 6. Testing Strategy

### Unit Tests
- Connection state machine
- Message serialization/deserialization
- Reconnection backoff logic

### Integration Tests
- Loopback test (send → receive same payload)
- Public MQTT broker test (test.mosquitto.org)
- Multi-client concurrent simulation

### E2E Scenarios
- Browser A publishes → Browser B subscribes
- Local Node.js MQTT broker + browser simulation
- Cloud broker (HiveMQ/AWS IoT) connectivity

---

## 7. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Browser WebSocket limits | Connection count | Document limits, connection pooling |
| CORS policy rejection | Local development | Provide proxy server, document workarounds |
| Memory leak on reconnect | Performance | Bounded retry, connection cleanup |
| Determinism vs async I/O | Reproducibility | Explicit sync model, timestamped messages |

---

## 8. References

- [MQTT.js Documentation](https://github.com/mqttjs/MQTT.js)
- [WebSocket API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- P12 Python Bridge pattern (`src/simulation/blocks/pythonBlock.ts`)

---

**Next Step:** Implement P13-1a WebSocket Send/Receive blocks (basic transport layer).
