import type { ClientMessage, ServerMessage } from "../shared/types";

type MessageHandler = (msg: ServerMessage) => void;

let ws: WebSocket | null = null;
let handler: MessageHandler = () => {};
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function getWsUrl(): string {
  if ((window as any).__WS_URL__) {
    return (window as any).__WS_URL__;
  }
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}`;
}

export function connect(onMessage: MessageHandler): void {
  handler = onMessage;
  doConnect();
}

function doConnect() {
  if (ws && ws.readyState <= WebSocket.OPEN) return;

  ws = new WebSocket(getWsUrl());

  ws.onopen = () => {
    console.log("[ws] connected");
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data) as ServerMessage;
      handler(msg);
    } catch (err) {
      console.error("[ws] parse error", err);
    }
  };

  ws.onclose = () => {
    console.log("[ws] disconnected");
    ws = null;
    reconnectTimer = setTimeout(doConnect, 2000);
  };

  ws.onerror = () => {
    ws?.close();
  };
}

export function send(msg: ClientMessage): void {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}
