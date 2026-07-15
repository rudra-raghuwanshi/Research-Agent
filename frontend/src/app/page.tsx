"use client";
import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import ChatWindow from "@/components/ChatWindow";
import axios from "axios";

const API = "http://localhost:8000";

export type Source = {
  file: string;
  page: number | null;
};

export type Message = {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
};

export default function Home() {
  const [papers, setPapers] = useState<string[]>([]);
  const [papersLoading, setPapersLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "👋 Hello! I'm your Research Paper Analysis Agent. Upload a PDF paper and ask me anything about it!",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fetchPapers = async () => {
    setPapersLoading(true);
    try {
      const res = await axios.get(`${API}/papers`, { timeout: 300000 });
      setPapers(res.data.papers);
    } catch {
      console.error("Failed to fetch papers");
    } finally {
      setPapersLoading(false);
    }
  };

  useEffect(() => {
    fetchPapers();
  }, []);

  const handleUpload = async (file: File) => {
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      await axios.post(`${API}/upload`, formData);
      await fetchPapers();
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `✅ **"${file.name}"** uploaded and indexed successfully! You can now ask questions about it.`,
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `❌ Upload failed: ${err.message}` },
      ]);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (filename: string) => {
    try {
      await axios.delete(`${API}/papers/${filename}`);
      await fetchPapers();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `🗑️ **"${filename}"** deleted successfully.` },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `❌ Failed to delete **"${filename}"**.` },
      ]);
    }
  };

  const handleSend = async (question: string) => {
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setLoading(true);

    let acc = "";
    let sources: Source[] = [];
    try {
      const res = await fetch(`${API}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let started = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split("\n").filter((l) => l.startsWith("data: "));

        for (const line of lines) {
          const data = JSON.parse(line.slice(6));
          if (data.type === "sources") {
            sources = data.sources;
          } else if (data.type === "token" && data.token) {
            acc += data.token;
            if (!started) {
              started = true;
              setLoading(false);
              setMessages((prev) => [...prev, { role: "assistant", content: acc, sources }]);
            } else {
              setMessages((prev) => {
                const next = [...prev];
                next[next.length - 1] = { role: "assistant", content: acc, sources };
                return next;
              });
            }
          }
        }
      }
    } catch {
      setLoading(false);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "❌ Failed to get answer. Make sure the backend is running.", sources: [] },
      ]);
    }
  };

  return (
    <div className="flex h-screen bg-[#0f1117]">
      <Sidebar
        papers={papers}
        onUpload={handleUpload}
        onDelete={handleDelete}
        uploading={uploading}
        loading={papersLoading}
      />
      <ChatWindow
        messages={messages}
        onSend={handleSend}
        loading={loading}
      />
    </div>
  );
}
