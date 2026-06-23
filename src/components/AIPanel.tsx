"use client";

/**
 * AIPanel — Gemini-powered natural-language interpretation panel.
 *
 * Slides in from the right when the user clicks "Interpret with Gemini"
 * or when a new location result arrives.
 *
 * Behaviour:
 *  - On open with a fresh result and no history, auto-fetches an
 *    initial interpretation from /api/ai-interpret.
 *  - Renders the conversation as chat bubbles (user right, AI left).
 *  - Supports free-text follow-up questions in the same context.
 *  - Shows typing dots while waiting and surfaces fallback status
 *    when the LLM is unreachable so the user knows the source.
 */

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  X,
  Send,
  Bot,
  User,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import type { ChatMessage, GeoHealthResult } from "@/types/geohealth";
import { fetchAIInterpretation } from "@/lib/api";
import { cn } from "@/lib/utils";

interface AIPanelProps {
  open: boolean;
  onClose: () => void;
  result: GeoHealthResult | null;
}

const SUGGESTED_QUESTIONS = [
  "What does this accessibility score mean for malaria medicine supply?",
  "Is the nearest facility realistically reachable in an emergency?",
  "How should NMEP prioritise this location?",
  "What data is missing from this result?",
];

export default function AIPanel({ open, onClose, result }: AIPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [fallbackUsed, setFallbackUsed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Track which result has already been auto-interpreted, so we don't
  // re-fire the initial interpretation when the panel re-opens.
  const interpretedKeyRef = useRef<string | null>(null);

  // -----------------------------------------------------------------
  // Auto-fetch initial interpretation whenever a fresh result arrives
  // while the panel is open.
  // -----------------------------------------------------------------
  useEffect(() => {
    if (!open || !result) return;
    const key = `${result.lat.toFixed(4)},${result.lon.toFixed(4)}`;
    if (interpretedKeyRef.current === key) return;
    interpretedKeyRef.current = key;

    // Reset conversation for the new location.
    setMessages([]);
    setFallbackUsed(false);
    setError(null);
    void askAI(undefined);
  }, [open, result]);

  // Auto-scroll to bottom on new messages / thinking state.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, thinking]);

  async function askAI(question: string | undefined) {
    if (!result) return;
    setThinking(true);
    setError(null);

    // Optimistically add the user's question to the chat.
    let history = messages;
    if (question) {
      const userMsg: ChatMessage = {
        role: "user",
        content: question,
        ts: Date.now(),
      };
      history = [...messages, userMsg];
      setMessages(history);
    }

    // Cancel any in-flight request.
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetchAIInterpretation(
        { result, question, history: history },
        ctrl.signal,
      );
      setFallbackUsed(Boolean(res.fallback));
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.reply, ts: Date.now() },
      ]);
    } catch (err) {
      // Aborted requests are not errors.
      if ((err as Error).name === "AbortError") return;
      setError(
        "Could not reach the Gemini interpretation service. Please try again.",
      );
    } finally {
      setThinking(false);
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = input.trim();
    if (!q || thinking) return;
    setInput("");
    void askAI(q);
  };

  const handleReset = () => {
    interpretedKeyRef.current = null;
    setMessages([]);
    setError(null);
    setFallbackUsed(false);
    if (result) {
      void askAI(undefined);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ x: 460, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 460, opacity: 0 }}
          transition={{ type: "spring", stiffness: 90, damping: 18 }}
          className="absolute top-4 right-4 z-20 w-[calc(100%-2rem)] sm:w-[400px] max-h-[calc(100vh-2rem)] flex flex-col glass-panel rounded-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="p-4 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-[#0E1B33] to-transparent">
            <div className="flex items-center gap-2.5">
              <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-[#2DD4BF] via-[#38BDF8] to-[#A78BFA] flex items-center justify-center shadow-lg shadow-[#2DD4BF]/30">
                <Sparkles className="w-4 h-4 text-[#04111A]" strokeWidth={2.5} />
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#34D399] border-2 border-[#0B1426]" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white tracking-tight">
                  Gemini Interpreter
                </h2>
                <p className="text-[10px] text-slate-400 uppercase tracking-[0.15em]">
                  Plain-language geo-health analysis
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleReset}
                className="p-1.5 rounded-lg hover:bg-white/5 transition-colors text-slate-400 hover:text-[#2DD4BF]"
                title="Re-interpret current location"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-white/5 transition-colors text-slate-400 hover:text-[#FB7185]"
                title="Close panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Fallback banner */}
          {fallbackUsed && (
            <div className="px-4 py-2 bg-[#FBBF24]/10 border-b border-[#FBBF24]/20 flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-[#FBBF24] flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-[#FBBF24] leading-snug">
                Gemini is unreachable in this preview, so a deterministic
                fallback is shown. Set <code className="font-mono">API_BASE_URL</code>{" "}
                and SDK credentials on the server for live LLM responses.
              </p>
            </div>
          )}

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto hide-scrollbar p-4 space-y-3 min-h-[300px]"
          >
            {!result ? (
              <div className="text-center text-slate-500 text-sm py-12">
                Pick a location first to get an interpretation.
              </div>
            ) : (
              <>
                {messages.length === 0 && !thinking && (
                  <div className="text-center text-slate-500 text-xs py-8">
                    Preparing interpretation…
                  </div>
                )}

                {messages.map((m, i) => (
                  <Bubble key={i} message={m} />
                ))}

                {thinking && (
                  <div className="flex items-start gap-2.5">
                    <Avatar role="assistant" />
                    <div className="bg-white/5 rounded-2xl rounded-tl-md px-3.5 py-3 border border-white/5">
                      <div className="flex gap-1">
                        <span className="typing-dot" />
                        <span className="typing-dot" />
                        <span className="typing-dot" />
                      </div>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="text-xs text-[#FB7185] bg-[#FB7185]/10 border border-[#FB7185]/20 rounded-lg px-3 py-2">
                    {error}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Suggested questions (only show before user has asked anything) */}
          {result && messages.length <= 1 && !thinking && (
            <div className="px-3 pt-2 pb-1 flex flex-wrap gap-1.5 border-t border-white/5">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => askAI(q)}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-white/5 hover:bg-[#2DD4BF]/15 hover:text-[#2DD4BF] text-slate-300 border border-white/10 hover:border-[#2DD4BF]/30 transition-colors text-left"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Composer */}
          <form
            onSubmit={handleSubmit}
            className="p-3 border-t border-white/5 flex gap-2 bg-black/20"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about this location…"
              disabled={!result || thinking}
              className="flex-1 bg-black/30 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#2DD4BF]/60 transition-colors disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || thinking || !result}
              className="w-10 h-10 rounded-xl bg-[#2DD4BF] hover:bg-[#14B8A6] text-[#04111A] flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Send"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// -------------------------------------------------------------------
// Sub-components
// -------------------------------------------------------------------

function Bubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div
      className={cn(
        "flex items-start gap-2.5",
        isUser && "flex-row-reverse",
      )}
    >
      <Avatar role={message.role} />
      <div
        className={cn(
          "max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed border whitespace-pre-wrap",
          isUser
            ? "bg-[#2DD4BF] text-[#04111A] border-[#2DD4BF]/50 rounded-tr-md font-medium"
            : "bg-white/5 text-slate-100 border-white/5 rounded-tl-md",
        )}
      >
        {renderContent(message.content, isUser)}
      </div>
    </div>
  );
}

/** Minimal markdown-ish renderer: **bold** and \n line breaks. */
function renderContent(text: string, _isUser: boolean) {
  if (_isUser) return text;
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-white">
          {p.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{p}</span>;
  });
}

function Avatar({ role }: { role: "user" | "assistant" }) {
  const isUser = role === "user";
  return (
    <div
      className={cn(
        "flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center border",
        isUser
          ? "bg-white/5 border-white/10 text-slate-300"
          : "bg-gradient-to-br from-[#2DD4BF] to-[#38BDF8] border-[#2DD4BF]/30 text-[#04111A]",
      )}
    >
      {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
    </div>
  );
}
