import type { ChatMessage } from "../types";

export function ChatBubble({ message }: { message: ChatMessage }) {
  const time = new Intl.DateTimeFormat("es-CO", {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(message.createdAt));

  return (
    <div className={`message-row ${message.role}`}>
      <div className="message-bubble">
        <p>{message.text}</p>
        <span className="message-time">
          {time}
          {message.role === "user" && (
            <span aria-label="enviado"> ✓✓</span>
          )}
        </span>
      </div>
    </div>
  );
}
