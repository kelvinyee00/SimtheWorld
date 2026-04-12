import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server } from "socket.io";
import { SimulationRuntimeSnapshot } from "./src/simulation/types";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = 3000;
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer);

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.on("join-room", (modelId: string) => {
      console.log(`Socket ${socket.id} joining room ${modelId}`);
      socket.join(modelId);
    });

    socket.on("leave-room", (modelId: string) => {
      console.log(`Socket ${socket.id} leaving room ${modelId}`);
      socket.leave(modelId);
    });

    socket.on("simulation-snapshot", (data: { modelId: string; snapshot: SimulationRuntimeSnapshot }) => {
      // Broadcast to everyone in the room except the sender
      socket.to(data.modelId).emit("simulation-update", data.snapshot);
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  httpServer
    .once("error", (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
});
