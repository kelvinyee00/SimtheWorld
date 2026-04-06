import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyEdgeChanges,
  applyNodeChanges,
  Edge,
  EdgeChange,
  Node,
  NodeChange,
  Connection,
  addEdge,
} from "reactflow";

/**
 * P13-4: Real-time Collaborative Model Sync (Experimental)
 *
 * Design Intent:
 * - Enable multiple users to edit the same simulation graph in real-time.
 * - Leverage WebSocket for low-latency broadcast of graph mutations.
 * - Follow "Last Write Wins" (LWW) conflict resolution for simplicity in this experimental phase.
 * - Isolate network-driven updates from local interactions to prevent broadcast loops.
 */

export type SyncMessageType =
  | "NODE_CHANGES"
  | "EDGE_CHANGES"
  | "CONNECT"
  | "FULL_SYNC"
  | "TIMING_UPDATE"
  | "CURSOR_MOVE";

export interface SyncMessage {
  type: SyncMessageType;
  payload: unknown;
  senderId: string;
  timestamp: number;
}

export interface CollaborationSyncOptions {
  nodes: Node[];
  edges: Edge[];
  setNodes: (nodes: Node[] | ((nds: Node[]) => Node[])) => void;
  setEdges: (edges: Edge[] | ((eds: Edge[]) => Edge[])) => void;
  setTiming: (params: { simulationTimeMs?: number; stepTimeMs?: number }) => void;
  enabled: boolean;
  url: string;
}

export function useCollaborationSync({
  nodes,
  edges,
  setNodes,
  setEdges,
  setTiming,
  enabled,
  url,
}: CollaborationSyncOptions) {
  const socketRef = useRef<WebSocket | null>(null);
  const [senderId] = useState(() => 
    typeof crypto !== "undefined" && "randomUUID" in crypto 
      ? crypto.randomUUID() 
      : Math.random().toString(36).slice(2)
  );
  
  const isRemoteUpdateRef = useRef(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const broadcast = useCallback((params: { type: SyncMessageType; payload: unknown }) => {
    if (
      !socketRef.current ||
      socketRef.current.readyState !== WebSocket.OPEN ||
      isRemoteUpdateRef.current
    ) {
      return;
    }

    const message: SyncMessage = {
      ...params,
      senderId,
      timestamp: Date.now(),
    };

    socketRef.current.send(JSON.stringify(message));
  }, [senderId]);

  useEffect(() => {
    if (!enabled || !url) {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    const socket = new WebSocket(url);
    socketRef.current = socket;

    socket.onopen = () => {
      setIsConnected(true);
      setError(null);
      // On connection, announce ourselves and share state if we have one
      if (nodes.length > 0 || edges.length > 0) {
        broadcast({
          type: "FULL_SYNC",
          payload: { nodes, edges },
        });
      }
    };

    socket.onmessage = (event) => {
      try {
        const message: SyncMessage = JSON.parse(event.data);
        if (message.senderId === senderId) return;

        isRemoteUpdateRef.current = true;
        
        switch (message.type) {
          case "NODE_CHANGES":
            setNodes((nds) => applyNodeChanges(message.payload as NodeChange[], nds));
            break;
          case "EDGE_CHANGES":
            setEdges((eds) => applyEdgeChanges(message.payload as EdgeChange[], eds));
            break;
          case "CONNECT":
            setEdges((eds) => addEdge(message.payload as Connection, eds));
            break;
          case "TIMING_UPDATE":
            setTiming(message.payload as { simulationTimeMs?: number; stepTimeMs?: number });
            break;
          case "FULL_SYNC": {
            const payload = message.payload as { nodes: Node[]; edges: Edge[] };
            setNodes(payload.nodes);
            setEdges(payload.edges);
            break;
          }
        }


        // Reset the flag in the next microtask to allow local changes again
        setTimeout(() => {
          isRemoteUpdateRef.current = false;
        }, 0);
      } catch (err) {
        console.error("Collaboration: Failed to parse message", err);
      }
    };

    socket.onerror = () => {
      setError("WebSocket connection error.");
    };

    socket.onclose = () => {
      setIsConnected(false);
    };

    return () => {
      socket.close();
    };
  }, [enabled, url, nodes, edges, setNodes, setEdges, setTiming, broadcast, senderId]);


  const onNodesChangeSync = useCallback(
    (changes: NodeChange[]) => {
      broadcast({ type: "NODE_CHANGES", payload: changes });
    },
    [broadcast]
  );


  const onEdgesChangeSync = useCallback(
    (changes: EdgeChange[]) => {
      broadcast({ type: "EDGE_CHANGES", payload: changes });
    },
    [broadcast]
  );

  const onConnectSync = useCallback(
    (connection: Connection) => {
      broadcast({ type: "CONNECT", payload: connection });
    },
    [broadcast]
  );

  const onTimingUpdateSync = useCallback(
    (params: { simulationTimeMs?: number; stepTimeMs?: number }) => {
      broadcast({ type: "TIMING_UPDATE", payload: params });
    },
    [broadcast]
  );

  return {
    isConnected,
    error,
    onNodesChangeSync,
    onEdgesChangeSync,
    onConnectSync,
    onTimingUpdateSync,
  };
}

