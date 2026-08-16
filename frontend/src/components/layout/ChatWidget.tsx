import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MessageCircle, X, Send, Bot, Zap, ListTodo, Users, Calendar, HelpCircle, Lightbulb } from "lucide-react";
import { api } from "../../lib/api";

interface Command { cmd: string; desc: string; }
interface Field { name: string; label: string; type: string; options?: Record<string, string>; }

type MsgType = "text" | "help" | "tasks" | "members" | "sprint" | "create_issue" | "projects" | "day_off";

interface BotMessage {
  role: "bot";
  type: MsgType;
  content: string;
  commands?: Command[];
  tasks?: any[];
  members?: any[];
  sprint?: any;
  projects?: any[];
  fields?: Field[];
  action?: { label: string; url: string; };
  time: string;
}

interface UserMessage { role: "user"; content: string; time: string; }

type Message = BotMessage | UserMessage;

const quickActions = [
  { label: "My Tasks", query: "my tasks", icon: ListTodo },
  { label: "Team Status", query: "who is working", icon: Users },
  { label: "Active Sprint", query: "current sprint", icon: Calendar },
  { label: "Create Task", query: "create task", icon: Zap },
  { label: "Overdue", query: "overdue", icon: HelpCircle },
  { label: "Help", query: "help", icon: Lightbulb },
];

const suggestedFollowUps: Record<string, string[]> = {
  tasks: ["who is working", "overdue", "current sprint"],
  members: ["my tasks", "create task", "project status"],
  sprint: ["my tasks", "team status update", "overdue"],
  help: ["my tasks", "who is working", "create task"],
  projects: ["my tasks", "overdue", "current sprint"],
  text: [],
  create_issue: [],
  day_off: [],
};

function sanitizeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function renderMarkdown(text: string): string {
  if (!text) return "";
  const safe = sanitizeHtml(text);
  return safe
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`(.*?)`/g, "<code style='background:var(--muted);padding:1px 5px;border-radius:4px;font-size:0.82rem'>$1</code>")
    .replace(/\n/g, "<br>");
}

function SafeMarkdown({ text }: { text: string }) {
  const parts = useMemo(() => {
    if (!text) return [];
    const safe = sanitizeHtml(text);
    const regex = /(<strong>.*?<\/strong>|<em>.*?<\/em>|<code[^>]*>.*?<\/code>|<br\/?>)/g;
    const result: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(safe)) !== null) {
      if (match.index > lastIndex) {
        result.push(safe.slice(lastIndex, match.index));
      }
      const tag = match[0];
      if (tag.startsWith("<strong>")) {
        result.push(<strong key={match.index}>{tag.replace(/<\/?strong>/g, "")}</strong>);
      } else if (tag.startsWith("<em>")) {
        result.push(<em key={match.index}>{tag.replace(/<\/?em>/g, "")}</em>);
      } else if (tag.startsWith("<code")) {
        const content = tag.replace(/<code[^>]*>/, "").replace(/<\/code>/, "");
        result.push(<code key={match.index} style={{ background: "var(--muted)", padding: "1px 5px", borderRadius: "4px", fontSize: "0.82rem" }}>{content}</code>);
      } else {
        result.push(<br key={match.index} />);
      }
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < safe.length) result.push(safe.slice(lastIndex));
    return result;
  }, [text]);

  return <>{parts}</>;
}

function getTime(): string {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function ChatWidget() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    setMessages([{
      role: "bot", type: "text",
      content: `${greeting}! I'm your AI assistant. I can help you manage tasks, check team status, and more.\n\nType **help** to see what I can do!`,
      time: getTime(),
    }]);
  }, []);

  useEffect(() => {
    const openFromHeader = () => setOpen(true);
    window.addEventListener("open-chat-widget", openFromHeader);
    return () => window.removeEventListener("open-chat-widget", openFromHeader);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = useCallback(async (text?: string) => {
    const message = (text ?? input).trim();
    if (!message || loading) return;

    setMessages((prev) => [...prev, { role: "user", content: message, time: getTime() }]);
    setInput("");
    setLoading(true);

    try {
      const res = await api.post<any>("/chatbot/message", { message });
      if (res) {
        setMessages((prev) => [
          ...prev,
          {
            role: "bot",
            ...res,
            type: res.type ?? "text",
            content: typeof res.content === "string" ? res.content : t("chat.error"),
            time: getTime(),
          },
        ]);
        if (res.type === "create_issue") setFormData({});
      }
    } catch (error: any) {
      let errorMsg = t("chat.error");
      if (error?.status === 429) {
        errorMsg = "Too many requests. Please wait a moment and try again.";
      } else if (error?.status === 422 && error?.details?.errors) {
        const validationErrors = Object.values(error.details.errors).flat();
        errorMsg = validationErrors.join(". ");
      } else if (error instanceof Error) {
        errorMsg = error.message || t("chat.error");
      }
      setMessages((prev) => [
        ...prev,
        { role: "bot", type: "text", content: errorMsg, time: getTime() },
      ]);
    }
    setLoading(false);
  }, [input, loading, api, t]);

  const submitIssueForm = async (fields: Field[]) => {
    const payload: Record<string, any> = {};
    fields.forEach((f) => {
      if (formData[f.name]) payload[f.name] = formData[f.name];
    });
    if (!payload.project_id || !payload.title || !payload.issue_type_id) {
      setMessages((prev) => [...prev, { role: "bot", type: "text", content: t("chat.requiredFields"), time: getTime() }]);
      return;
    }

    try {
      const res = await api.post<any>("/chatbot/issues", payload);
      if (res?.success) {
        setMessages((prev) => [...prev, { role: "bot", type: "text", content: res.message || "Issue created!", time: getTime() }]);
        setFormData({});
      } else {
        setMessages((prev) => [...prev, { role: "bot", type: "text", content: `Failed to create issue: ${res?.message || "Unknown error"}`, time: getTime() }]);
      }
    } catch (error: any) {
      let errorMsg = t("chat.issueError");
      if (error?.status === 429) {
        errorMsg = "Too many requests. Please wait a moment and try again.";
      } else if (error?.status === 422 && error?.details?.errors) {
        const validationErrors = Object.values(error.details.errors).flat();
        errorMsg = `Validation error: ${validationErrors.join(". ")}`;
      } else if (error instanceof Error) {
        errorMsg = error.message || t("chat.issueError");
      }
      setMessages((prev) => [
        ...prev,
        { role: "bot", type: "text", content: errorMsg, time: getTime() },
      ]);
    }
  };

  const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
  const followUps = lastMsg?.role === "bot" ? (suggestedFollowUps[lastMsg.type] ?? []) : [];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setOpen((prev) => !prev);
    }
    if (e.key === "Escape" && open) {
      setOpen(false);
    }
  };

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown as any);
    return () => document.removeEventListener("keydown", handleKeyDown as any);
  }, [open]);

  return (
    <>
      {/* Chat button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 end-6 z-[9999] flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary/50"
          aria-label={t("chat.open")}
          title={t("chat.open")}
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-6 end-6 z-[9999] flex h-[580px] w-[400px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
          role="dialog"
          aria-label={t("chat.title")}
          aria-modal="true"
        >
          {/* Header */}
          <div className="flex shrink-0 items-center gap-2 border-b border-border bg-accent/30 px-4 py-3.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
              <Bot className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">{t("chat.title")}</p>
              <p className="text-xs text-muted-foreground">{t("chat.subtitle")}</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary/30"
              aria-label={t("chat.close")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Quick action chips */}
          {messages.length <= 1 && (
            <div className="shrink-0 border-b border-border/50 bg-accent/10 px-3 py-2">
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60">
                Quick actions
              </p>
              <div className="flex flex-wrap gap-1.5">
                {quickActions.map((action) => (
                  <button
                    key={action.query}
                    onClick={() => sendMessage(action.query)}
                    disabled={loading}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
                  >
                    <action.icon className="h-3 w-3" aria-hidden="true" />
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2" role="log" aria-label="Chat messages" aria-live="polite">
            {messages.map((msg, i) => (
              msg.role === "bot" ? (
                <div key={i} className="flex gap-2">
                  <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold">
                    <Bot className="h-3.5 w-3.5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="rounded-2xl rounded-tl-sm bg-muted px-3.5 py-2.5 text-sm leading-relaxed text-foreground">
                      <SafeMarkdown text={msg.content} />

                      {/* Tasks list */}
                      {(msg as BotMessage).type === "tasks" && (msg as BotMessage).tasks && (
                        <div className="mt-2 overflow-hidden rounded-lg border border-border">
                          <table className="w-full text-xs">
                            <thead className="bg-accent/30">
                              <tr>
                                <th className="px-2 py-1.5 text-start font-medium">Task</th>
                                <th className="px-2 py-1.5 text-start font-medium">Status</th>
                                <th className="px-2 py-1.5 text-start font-medium">Due</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(msg as BotMessage).tasks!.map((task: any) => (
                                <tr key={task.key} className="border-t border-border/50">
                                  <td className="px-2 py-1.5">
                                    <div className="font-medium text-foreground">{task.key}</div>
                                    <div className="text-muted-foreground">{task.title}</div>
                                  </td>
                                  <td className="px-2 py-1.5">
                                    <span
                                      className="inline-block rounded px-1.5 py-0.5 text-xs font-medium"
                                      style={{
                                        backgroundColor: task.overdue ? "#ef44441f" : "#64748b1f",
                                        color: task.overdue ? "#ef4444" : "var(--muted-foreground)",
                                      }}
                                    >
                                      {task.status}
                                    </span>
                                  </td>
                                  <td className={`px-2 py-1.5 ${task.overdue ? "font-semibold text-destructive" : "text-muted-foreground"}`}>
                                    {task.due}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Members list */}
                      {(msg as BotMessage).type === "members" && (msg as BotMessage).members && (
                        <div className="mt-2 space-y-1">
                          {(msg as BotMessage).members!.map((m: any) => (
                            <div key={m.name} className="flex items-center gap-2 rounded-md bg-accent/20 px-2 py-1.5">
                              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                {m.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-medium text-foreground">{m.name}</div>
                                <div className="text-xs text-muted-foreground">{m.tasks} tasks</div>
                              </div>
                              <span className={`h-2 w-2 rounded-full ${m.active ? "bg-green-500" : "bg-muted-foreground/30"}`} aria-label={m.active ? "Active" : "Inactive"} />
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Sprint info */}
                      {(msg as BotMessage).type === "sprint" && (msg as BotMessage).sprint && (
                        <div className="mt-2 rounded-lg border border-border bg-accent/20 p-2.5">
                          <div className="mb-1 flex items-center justify-between">
                            <span className="text-xs font-semibold text-foreground">{(msg as BotMessage).sprint!.name}</span>
                            <span className="text-xs text-muted-foreground">{(msg as BotMessage).sprint!.project}</span>
                          </div>
                          <div className="flex gap-3 text-xs">
                            <span><b>{(msg as BotMessage).sprint!.completed}</b> done</span>
                            <span><b>{(msg as BotMessage).sprint!.in_progress}</b> in progress</span>
                          </div>
                          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${(msg as BotMessage).sprint!.progress}%` }} />
                          </div>
                        </div>
                      )}

                      {/* Create issue form */}
                      {(msg as BotMessage).type === "create_issue" && (msg as BotMessage).fields && (
                        <div className="mt-2 rounded-lg border border-border bg-accent/20 p-3">
                          {(msg as BotMessage).fields!.map((field) => (
                            <div key={field.name} className="mb-2">
                              <label className="mb-0.5 block text-xs font-medium text-muted-foreground" htmlFor={`chat-field-${field.name}`}>{field.label}</label>
                              {field.type === "select" ? (
                                <select
                                  id={`chat-field-${field.name}`}
                                  value={formData[field.name] || ""}
                                  onChange={(e) => setFormData((prev) => ({ ...prev, [field.name]: e.target.value }))}
                                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                                >
                                  <option value="">{t("chat.selectLabel")}</option>
                                  {Object.entries(field.options || {}).map(([val, label]) => (
                                    <option key={val} value={val}>{label}</option>
                                  ))}
                                </select>
                              ) : field.type === "textarea" ? (
                                <textarea
                                  id={`chat-field-${field.name}`}
                                  rows={2}
                                  value={formData[field.name] || ""}
                                  onChange={(e) => setFormData((prev) => ({ ...prev, [field.name]: e.target.value }))}
                                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 resize-none"
                                />
                              ) : (
                                <input
                                  id={`chat-field-${field.name}`}
                                  type={field.type || "text"}
                                  value={formData[field.name] || ""}
                                  onChange={(e) => setFormData((prev) => ({ ...prev, [field.name]: e.target.value }))}
                                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                                />
                              )}
                            </div>
                          ))}
                          <button
                            onClick={() => submitIssueForm((msg as BotMessage).fields!)}
                            className="w-full rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/50"
                          >
                            {t("chat.createIssue")}
                          </button>
                        </div>
                      )}

                      {/* Action button */}
                      {(msg as BotMessage).action && (
                        <div className="mt-2">
                          {(msg as BotMessage).action!.url.startsWith("/") ? (
                            <Link
                              to={(msg as BotMessage).action!.url}
                              className="inline-block rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground no-underline hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/50"
                            >
                              {(msg as BotMessage).action!.label}
                            </Link>
                          ) : (
                            <a
                              href={(msg as BotMessage).action!.url}
                              className="inline-block rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground no-underline hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/50"
                            >
                              {(msg as BotMessage).action!.label}
                            </a>
                          )}
                        </div>
                      )}

                      {/* Help commands */}
                      {(msg as BotMessage).type === "help" && (msg as BotMessage).commands && (
                        <div className="mt-1 space-y-0.5">
                          {(msg as BotMessage).commands!.map((cmd) => (
                            <div key={cmd.cmd} className="flex gap-2 border-b border-border/30 py-1 text-xs">
                              <code className="shrink-0 rounded bg-accent/30 px-1.5 text-xs text-primary">{cmd.cmd}</code>
                              <span className="text-muted-foreground">{cmd.desc}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="mt-0.5 px-1 text-[10px] text-muted-foreground">{msg.time}</p>
                  </div>
                </div>
              ) : (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[80%]">
                    <div className="rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm leading-relaxed text-primary-foreground">
                      {(msg as UserMessage).content}
                    </div>
                    <p className="mt-0.5 px-1 text-end text-[10px] text-muted-foreground">{msg.time}</p>
                  </div>
                </div>
              )
            ))}

            {/* Suggested follow-ups */}
            {!loading && followUps.length > 0 && (
              <div className="flex flex-wrap gap-1.5 px-1">
                {followUps.map((q) => {
                  const action = quickActions.find((a) => a.query === q);
                  return (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      {action && <action.icon className="h-3 w-3" aria-hidden="true" />}
                      {action?.label ?? q}
                    </button>
                  );
                })}
              </div>
            )}

            {loading && (
              <div className="flex gap-2" role="status" aria-label={t("chat.thinking")}>
                <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold">
                  <Bot className="h-3.5 w-3.5" aria-hidden="true" />
                </div>
                <div className="rounded-2xl rounded-tl-sm bg-muted px-3.5 py-2.5">
                  <div className="flex gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/40" style={{ animationDelay: "0ms" }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/40" style={{ animationDelay: "150ms" }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/40" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="shrink-0 border-t border-border bg-accent/10 px-3 py-2.5">
            <form
              onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
              className="flex gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t("chat.placeholder")}
                aria-label={t("chat.placeholder")}
                className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary/50"
                aria-label={t("chat.send")}
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
