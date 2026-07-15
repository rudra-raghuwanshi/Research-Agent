"use client";
import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Message } from "@/app/page";

type Props = {
  messages: Message[];
  onSend: (question: string) => void;
  loading: boolean;
};

const SUGGESTIONS = [
  "Summarize the main contributions of this paper",
  "What methodology did the authors use?",
  "What were the key findings and results?",
  "Extract all citations from the paper",
];

export default function ChatWindow({ messages, onSend, loading }: Props) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = () => {
    if (!input.trim() || loading) return;
    onSend(input.trim());
    setInput("");
  };

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#2d3154] bg-[#1a1d2e]">
        <h2 className="text-white font-semibold">Research Paper Chat</h2>
        <p className="text-xs text-slate-400">Ask anything about your uploaded papers</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            {/* Avatar */}
            <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center
              ${msg.role === "assistant" ? "bg-violet-600" : "bg-slate-600"}`}>
              {msg.role === "assistant"
                ? <Bot size={16} className="text-white" />
                : <User size={16} className="text-white" />}
            </div>

            {/* Bubble */}
            <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed
              ${msg.role === "assistant"
                ? "bg-[#1a1d2e] text-slate-200 rounded-tl-none"
                : "bg-violet-600 text-white rounded-tr-none"}`}>
              <ReactMarkdown>{msg.content}</ReactMarkdown>
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-2 pt-2 border-t border-[#3b4263] flex flex-wrap gap-1.5">
                  {msg.sources.map((s, i) => (
                    <span key={i} className="text-[11px] bg-violet-900/50 text-violet-300 px-2 py-0.5 rounded">
                      {s.file}{s.page != null ? ` (p. ${s.page})` : ""}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {loading && (
          <div className="flex gap-3">
            <div className="shrink-0 w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center">
              <Bot size={16} className="text-white" />
            </div>
            <div className="bg-[#1a1d2e] rounded-2xl rounded-tl-none px-4 py-3">
              <Loader2 size={18} className="text-violet-400 animate-spin" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      {messages.length <= 1 && (
        <div className="px-6 py-3 flex gap-2 flex-wrap">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => onSend(s)}
              className="text-xs bg-[#1a1d2e] hover:bg-[#2d3154] text-slate-300 px-3 py-2 rounded-full border border-[#2d3154] transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-6 py-4 border-t border-[#2d3154] bg-[#1a1d2e]">
        <div className="flex gap-3 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask anything about your research papers..."
            rows={1}
            className="flex-1 bg-[#0f1117] border border-[#2d3154] rounded-xl px-4 py-3 text-sm text-slate-200
              placeholder-slate-500 resize-none focus:outline-none focus:border-violet-500 transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed
              text-white p-3 rounded-xl transition-colors shrink-0"
          >
            <Send size={18} />
          </button>
        </div>
        <p className="text-xs text-slate-600 mt-2 text-center">Press Enter to send • Shift+Enter for new line</p>
      </div>
    </div>
  );
}
