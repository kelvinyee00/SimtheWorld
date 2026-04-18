"use client";

import { useEffect, useState } from "react";
import { useSimulationRuntimeStore } from "../store/simulationRuntimeStore";
import { getSocket } from "../utils/socket";

export const useCollaborationSync = () => {
  const modelId = useSimulationRuntimeStore((state) => state.modelId);
  const isFollowerMode = useSimulationRuntimeStore((state) => state.isFollowerMode);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const socket = getSocket();

    const handleConnect = () => {
      setIsConnected(true);
      if (modelId) {
        socket.emit("join-room", modelId);
      }
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    
    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
    };
  }, [modelId]);

  const sendCommand = (command: "run" | "pause" | "reset") => {
    if (modelId && !isFollowerMode) {
      const socket = getSocket();
      socket.emit(`simulation-${command}`, modelId);
    }
  };

  return {
    isConnected,
    sendCommand,
  };
};
