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
  MessageSquare,
  FileText,
  User,
  LogOut,
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
  const { user, logout } = useAuthContext();
  const [syllabus, setSyllabus] = useState<SyllabusTreeNode[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [syllabusOpen, setSyllabusOpen] = useState(true);
  const [conversationsOpen, setConversationsOpen] = useState(true);
  const [logoutConfirm, setLogoutConfirm] = useState(false);

  const fetchConversations = () => {
    fetch("/api/conversations")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setConversations(data.slice(0, 5)); })
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
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    window.addEventListener("conversations:refresh", fetchConversations);
    return () => window.removeEventListener("conversations:refresh", fetchConversations);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/current-affairs", label: "Daily Current Affairs", icon: Newspaper },
    { href: "/current-affairs/monthly", label: "Monthly Current Affairs", icon: CalendarRange },
    { href: "/notes", label: "My Notes", icon: FileText },
    { href: "/account", label: "Account", icon: User },
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
          <button
            onClick={() => setSyllabusOpen(!syllabusOpen)}
            className="flex items-center justify-between w-full px-2 py-1.5 text-xs font-semibold text-[#8aa3cf] uppercase tracking-wider rounded hover:text-[#a9bde0]"
          >
            <span>Syllabus</span>
            {syllabusOpen ? (
              <ChevronDown size={12} />
            ) : (
              <ChevronRight size={12} />
            )}
          </button>

          {syllabusOpen && (
            <div className="mt-1">
              <SyllabusTree
                nodes={syllabus}
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
        {logoutConfirm ? (
          <div className="rounded-md bg-[#0a1b38] border border-[#1f3a6b] px-3 py-2 text-xs">
            <p className="text-[#e9effa] mb-2">Sign out of SSC AI?</p>
            <div className="flex gap-2">
              <button
                onClick={handleLogout}
                className="flex-1 py-1 rounded bg-[#b94040] text-white font-medium hover:bg-[#9e3535] transition-colors"
              >
                Yes, sign out
              </button>
              <button
                onClick={() => setLogoutConfirm(false)}
                className="flex-1 py-1 rounded bg-[#173063] text-[#a9bde0] hover:bg-[#1f3a6b] hover:text-[#e9effa] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setLogoutConfirm(true)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-[#8aa3cf] hover:text-[#e9effa] hover:bg-[#173063] rounded-md transition-colors"
          >
            <LogOut size={14} aria-hidden="true" />
            Sign out
          </button>
        )}
      </div>
    </aside>
  );
}

export default Sidebar;
