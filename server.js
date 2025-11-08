// Retrocast NetPlay Server (Node.js + WebSocket)
import { WebSocketServer } from "ws";

const PORT = process.env.PORT || 3000;
const wss = new WebSocketServer({ port: PORT });
const lobbies = new Map();

console.log(`🚀 Servidor Retrocast NetPlay iniciado na porta ${PORT}`);

wss.on("connection", (ws) => {
  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg);

      if (data.type === "create") {
        const lobbyId = Math.random().toString(36).substring(2, 8);
        lobbies.set(lobbyId, [ws]);
        ws.lobbyId = lobbyId;
        ws.send(JSON.stringify({ type: "created", lobbyId }));
        console.log(`🎮 Novo lobby criado: ${lobbyId}`);
      }

      if (data.type === "join") {
        const lobby = lobbies.get(data.lobbyId);
        if (!lobby) {
          ws.send(JSON.stringify({ type: "error", message: "Lobby não encontrado" }));
          return;
        }
        lobby.push(ws);
        ws.lobbyId = data.lobbyId;
        console.log(`👥 Jogador entrou no lobby ${data.lobbyId} (${lobby.length} players)`);

        lobby.forEach((client) => {
          if (client.readyState === ws.OPEN) {
            client.send(JSON.stringify({ type: "player-joined", count: lobby.length }));
          }
        });
      }

      if (data.type === "signal" && ws.lobbyId) {
        const lobby = lobbies.get(ws.lobbyId);
        lobby.forEach((client) => {
          if (client !== ws && client.readyState === ws.OPEN) {
            client.send(JSON.stringify({ type: "signal", signal: data.signal }));
          }
        });
      }
    } catch (err) {
      console.error("❌ Erro ao processar mensagem:", err);
    }
  });

  ws.on("close", () => {
    if (ws.lobbyId) {
      const lobby = lobbies.get(ws.lobbyId);
      if (lobby) {
        const updated = lobby.filter((c) => c !== ws);
        if (updated.length === 0) {
          lobbies.delete(ws.lobbyId);
          console.log(`🏁 Lobby ${ws.lobbyId} fechado`);
        } else {
          lobbies.set(ws.lobbyId, updated);
          updated.forEach((client) => {
            if (client.readyState === ws.OPEN) {
              client.send(
                JSON.stringify({ type: "player-left", count: updated.length })
              );
            }
          });
        }
      }
    }
  });
});
