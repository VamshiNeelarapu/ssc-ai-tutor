"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clsx } from "clsx";
import { Logo } from "./ui/Logo";
import {
  LayoutDashboard,
  Newspaper,
  CalendarRange,
  BarChart3,
  MessageSquare,
  FileText,
  User,
  Plus,
  ChevronDown,
  ChevronRight,
  X,
} from "lucide-react";
import { useAuthContext } from "@/contexts/AuthContext";
import { SyllabusTree } from "./SyllabusTree";
import type { SyllabusTreeNode } from "./SyllabusTree";

interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
}

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuthContext();
  const [syllabus, setSyllabus] = useState<SyllabusTreeNode[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [topicStatus, setTopicStatus] = useState<Record<string, string> | undefined>(undefined);
  const [chatStarted, setChatStarted] = useState<Record<string, boolean> | undefined>(undefined);
  const [syllabusOpen, setSyllabusOpen] = useState(true);
  const [conversationsOpen, setConversationsOpen] = useState(false);

  const fetchConversations = () => {
    fetch("/api/conversations")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setConversations(data.slice(0, 5)); })
      .catch(() => {});
  };

  const fetchTopicStatus = () => {
    fetch("/api/notes/status-map")
      .then((r) => r.json())
      .then((data) => {
        if (data && data.map) setTopicStatus(data.map);
        if (data && Array.isArray(data.chatTopicIds)) {
          setChatStarted(Object.fromEntries(data.chatTopicIds.map((id: string) => [id, true])));
        }
      })
      .catch(() => {});
  };

  const fetchSyllabus = () => {
    fetch("/api/syllabus")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setSyllabus(data); })
      .catch(() => {});
  };

  useEffect(() => {
    fetchSyllabus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchConversations();
    fetchTopicStatus();
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onConversationsChanged = () => {
      fetchConversations();
      fetchTopicStatus();
    };
    window.addEventListener("conversations:refresh", onConversationsChanged);
    window.addEventListener("notes:changed", fetchTopicStatus);
    return () => {
      window.removeEventListener("conversations:refresh", onConversationsChanged);
      window.removeEventListener("notes:changed", fetchTopicStatus);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/current-affairs", label: "Daily Current Affairs", icon: Newspaper },
    { href: "/current-affairs/monthly", label: "Monthly Current Affairs", icon: CalendarRange },
    { href: "/notes", label: "My Notes", icon: FileText },
  ];

  return (
    <aside
      className={clsx(
        "fixed inset-y-0 left-0 z-50 w-64 bg-[#0f2447] flex flex-col transition-transform duration-200 ease-in-out",
        "lg:relative lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}
      aria-label="Main navigation"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-16 border-b border-[#1f3a6b] flex-shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Logo size={30} />
          <span className="font-bold text-[#e9effa] text-sm">SSC AI</span>
        </Link>
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden text-[#8aa3cf] hover:text-[#e9effa]"
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto py-3 space-y-1">
        {/* Main navigation */}
        <nav aria-label="Main pages">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-3 px-4 py-2 text-sm transition-colors mx-2 rounded-md",
                pathname === href || (href !== "/dashboard" && href !== "/current-affairs" && pathname.startsWith(href))
                  ? "bg-[#1d3c78] text-[#e9effa]"
                  : "text-[#a9bde0] hover:bg-[#173063] hover:text-[#e9effa]"
              )}
              aria-current={pathname === href ? "page" : undefined}
            >
              <Icon size={16} aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-[#1f3a6b] my-2" />

        {/* New Chat button */}
        <div className="px-2">
          <Link
            href="/chat"
            className={clsx(
              "flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm font-medium transition-colors",
              "bg-[#1f4e9c] text-white hover:bg-[#173d7d]",
              pathname === "/chat" && "bg-[#173d7d]"
            )}
          >
            <Plus size={16} aria-hidden="true" />
            New Chat
          </Link>
        </div>

        {/* Recent Conversations */}
        <div className="px-2">
          <button
            onClick={() => setConversationsOpen(!conversationsOpen)}
            className="flex items-center justify-between w-full px-2 py-1.5 text-xs font-semibold text-[#8aa3cf] uppercase tracking-wider rounded hover:text-[#a9bde0]"
          >
            <span>Recent Chats</span>
            {conversationsOpen ? (
              <ChevronDown size={12} />
            ) : (
              <ChevronRight size={12} />
            )}
          </button>

          {conversationsOpen && (
            <div className="mt-1 space-y-0.5">
              {conversations.length === 0 ? (
                <p className="text-xs text-[#7088b3] px-2 py-2">No conversations yet</p>
              ) : (
                conversations.map((conv) => (
                  <Link
                    key={conv.id}
                    href={`/chat/${conv.id}`}
                    className={clsx(
                      "flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-[#a9bde0] hover:bg-[#173063] hover:text-[#e9effa] transition-colors truncate",
                      pathname === `/chat/${conv.id}` && "bg-[#1d3c78] text-[#e9effa]"
                    )}
                    title={conv.title}
                  >
                    <MessageSquare size={12} className="flex-shrink-0" aria-hidden="true" />
                    <span className="truncate">{conv.title}</span>
                  </Link>
                ))
              )}
            </div>
          )}
        </div>

        <div className="border-t border-[#1f3a6b] my-2" />

        {/* Syllabus Tree */}
        <div className="px-2">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSyllabusOpen(!syllabusOpen)}
              className="flex items-center justify-between flex-1 px-2 py-1.5 text-xs font-semibold text-[#8aa3cf] uppercase tracking-wider rounded hover:text-[#a9bde0]"
            >
              <span>Syllabus</span>
              {syllabusOpen ? (
                <ChevronDown size={12} />
              ) : (
                <ChevronRight size={12} />
              )}
            </button>
            <Link
              href="/tracker"
              onClick={() => onClose?.()}
              title="Progress tracker"
              className={clsx(
                "flex items-center gap-1 px-2 py-1.5 rounded text-xs font-semibold uppercase tracking-wider transition-colors",
                pathname === "/tracker"
                  ? "bg-[#1d3c78] text-[#e9effa]"
                  : "text-[#8aa3cf] hover:text-[#e9effa] hover:bg-[#173063]"
              )}
            >
              <BarChart3 size={12} aria-hidden="true" />
              Tracker
            </Link>
          </div>

          {syllabusOpen && (
            <div className="mt-1">
              <SyllabusTree
                nodes={syllabus}
                topicStatus={topicStatus}
                chatStarted={chatStarted}
                editable
                onMutate={fetchSyllabus}
                onNodeSelect={(node) => {
                  if (node.nodeType === "topic") {
                    router.push(`/notes?topicId=${node.id}`);
                  } else if (node.nodeType === "section") {
                    router.push(`/notes?sectionId=${node.id}`);
                  }
                  onClose?.();
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* User menu at bottom */}
      <div className="border-t border-[#1f3a6b] p-3 flex-shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-[#1f4e9c] flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
            {user?.name?.charAt(0)?.toUpperCase() || "U"}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[#e9effa] truncate">
              {user?.name || "User"}
            </p>
            <p className="text-xs text-[#8aa3cf] truncate">{user?.email}</p>
          </div>
        </div>
        <Link
          href="/account"
          onClick={() => onClose?.()}
          aria-current={pathname.startsWith("/account") ? "page" : undefined}
          className={clsx(
            "w-full flex items-center gap-2 px-3 py-1.5 text-sm text-[#8aa3cf] hover:text-[#e9effa] hover:bg-[#173063] rounded-md transition-colors",
            pathname.startsWith("/account") && "bg-white/10 text-white"
          )}
        >
          <User size={14} aria-hidden="true" />
          Account
        </Link>
      </div>
    </aside>
  );
}

export default Sidebar;
