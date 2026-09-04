import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { ExplorerMenu, type ExplorerMenuItem } from "./ExplorerMenu";
import { ALT, MOD, SHIFT } from "../lib/platform";
import { runUpdateFlow } from "../lib/updater";

type MenuKey = "file" | "view" | "terminal";

type Props = {
  onNew: () => void;
  onNewTerminal?: () => void;
  onNewTerminalTab?: () => void;
  onToggleTerminal?: () => void;
  onGoToFile?: () => void;
  onToggleSidebar: () => void;
  onShowSourceControl?: () => void;
  onCloseCurrentTab?: () => void;
  onCloseOtherTabs?: () => void;
  onSplitRight?: () => void;
  onSplitDown?: () => void;
  onNextTab?: () => void;
  onPrevTab?: () => void;
  onBackTab?: () => void;
  onForwardTab?: () => void;
  onFocusLeft?: () => void;
  onFocusRight?: () => void;
  onFocusUp?: () => void;
  onFocusDown?: () => void;
  onPickProject?: () => void;
  onFindInProject?: () => void;
  onSearch?: () => void;
  onOpenInbox?: () => void;
  onOpenNotes?: () => void;
  onOpenSettings?: () => void;
  onSidebarAppearance?: () => void;
  onQuit?: () => void;
};

export function MenuBar({
  onNew,
  onNewTerminal,
  onNewTerminalTab,
  onToggleTerminal,
  onGoToFile,
  onToggleSidebar,
  onShowSourceControl,
  onCloseCurrentTab,
  onCloseOtherTabs,
  onSplitRight,
  onSplitDown,
  onNextTab,
  onPrevTab,
  onBackTab,
  onForwardTab,
  onFocusLeft,
  onFocusRight,
  onFocusUp,
  onFocusDown,
  onPickProject,
  onFindInProject,
  onSearch,
  onOpenInbox,
  onOpenNotes,
  onOpenSettings,
  onSidebarAppearance,
  onQuit,
}: Props) {
  const [open, setOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<MenuKey | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  // Toggle with standalone Alt key tap
  useEffect(() => {
    let altPressedAlone = false;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Alt") {
        altPressedAlone = true;
      } else if (altPressedAlone) {
        altPressedAlone = false;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Alt" && altPressedAlone) {
        setOpen((prev) => {
          if (prev) {
            setActiveMenu(null);
            setMenuAnchor(null);
            return false;
          }
          return true;
        });
        altPressedAlone = false;
      }
    };

    const onBlur = () => {
      altPressedAlone = false;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  const openDropdown = useCallback((key: MenuKey, target: HTMLElement) => {
    const rect = target.getBoundingClientRect();
    setActiveMenu(key);
    setMenuAnchor({ x: rect.left, y: rect.bottom + 2 });
  }, []);

  const closeMenu = useCallback(() => {
    setActiveMenu(null);
    setMenuAnchor(null);
  }, []);

  const handlePick = useCallback(
    (id: string) => {
      closeMenu();
      setOpen(false);

      switch (id) {
        case "new_tab":
          onNew();
          break;
        case "new_terminal":
          onNewTerminal?.();
          break;
        case "new_terminal_tab":
          onNewTerminalTab?.();
          break;
        case "toggle_terminal":
          onToggleTerminal?.();
          break;
        case "new_window":
          void invoke("open_new_window").catch(() => {});
          break;
        case "open_project":
          onPickProject?.();
          break;
        case "open_search":
          onSearch?.();
          break;
        case "open_inbox":
          onOpenInbox?.();
          break;
        case "open_notes":
          onOpenNotes?.();
          break;
        case "open_settings":
          onOpenSettings?.();
          break;
        case "sidebar_opacity":
          onSidebarAppearance?.();
          break;
        case "quit":
          onQuit?.();
          break;
        case "go_to_file":
          onGoToFile?.();
          break;
        case "find_in_project":
          onFindInProject?.();
          break;
        case "close_tab":
          onCloseCurrentTab?.();
          break;
        case "close_other_tabs":
          onCloseOtherTabs?.();
          break;
        case "split_right":
          onSplitRight?.();
          break;
        case "split_down":
          onSplitDown?.();
          break;
        case "next_tab":
          onNextTab?.();
          break;
        case "prev_tab":
          onPrevTab?.();
          break;
        case "back_tab":
          onBackTab?.();
          break;
        case "forward_tab":
          onForwardTab?.();
          break;
        case "focus_left":
          onFocusLeft?.();
          break;
        case "focus_right":
          onFocusRight?.();
          break;
        case "focus_up":
          onFocusUp?.();
          break;
        case "focus_down":
          onFocusDown?.();
          break;
        case "toggle_sidebar":
          onToggleSidebar();
          break;
        case "open_model_picker":
          window.dispatchEvent(new Event("open_model_picker"));
          break;
        case "toggle_diff":
          onShowSourceControl?.();
          break;
        case "check_for_updates":
          void runUpdateFlow(true);
          break;
      }
    },
    [
      closeMenu,
      onCloseCurrentTab,
      onCloseOtherTabs,
      onSplitRight,
      onSplitDown,
      onNextTab,
      onPrevTab,
      onBackTab,
      onForwardTab,
      onFocusLeft,
      onFocusRight,
      onFocusUp,
      onFocusDown,
      onFindInProject,
      onGoToFile,
      onNew,
      onNewTerminal,
      onNewTerminalTab,
      onToggleTerminal,
      onPickProject,
      onSearch,
      onOpenInbox,
      onOpenNotes,
      onOpenSettings,
      onSidebarAppearance,
      onQuit,
      onShowSourceControl,
      onToggleSidebar,
    ],
  );

  const getMenuItems = (key: MenuKey): ExplorerMenuItem[] => {
    switch (key) {
      case "file":
        return [
          { kind: "item", id: "new_tab", label: "New Tab", shortcut: `${MOD}T` },
          { kind: "item", id: "new_terminal", label: "New Terminal", shortcut: `${MOD}\`` },
          {
            kind: "item",
            id: "new_terminal_tab",
            label: "New Terminal Tab",
            shortcut: `${MOD}${SHIFT}\``,
          },
          { kind: "item", id: "new_window", label: "New Window", shortcut: `${MOD}${SHIFT}N` },
          { kind: "sep" },
          { kind: "item", id: "open_project", label: "Open Project…", shortcut: `${MOD}O` },
          { kind: "item", id: "open_search", label: "Search…", shortcut: `${MOD}K` },
          { kind: "item", id: "go_to_file", label: "Go to File…", shortcut: `${MOD}P` },
          { kind: "item", id: "find_in_project", label: "Find in Files…", shortcut: `${MOD}${SHIFT}F` },
          { kind: "sep" },
          { kind: "item", id: "split_right", label: "Split Pane Right", shortcut: `${MOD}D` },
          { kind: "item", id: "split_down", label: "Split Pane Down", shortcut: `${MOD}${SHIFT}D` },
          { kind: "item", id: "close_tab", label: "Close Pane", shortcut: `${MOD}W` },
          {
            kind: "item",
            id: "close_other_tabs",
            label: "Close Other Tabs",
            shortcut: `${MOD}${ALT}T`,
          },
          { kind: "sep" },
          { kind: "item", id: "prev_tab", label: "Previous Tab", shortcut: `${MOD}${SHIFT}[` },
          { kind: "item", id: "next_tab", label: "Next Tab", shortcut: `${MOD}${SHIFT}]` },
          { kind: "item", id: "back_tab", label: "Go Back", shortcut: `${MOD}[` },
          { kind: "item", id: "forward_tab", label: "Go Forward", shortcut: `${MOD}]` },
          { kind: "sep" },
          { kind: "item", id: "open_settings", label: "Settings…", shortcut: `${MOD},` },
          { kind: "item", id: "check_for_updates", label: "Check for Updates…" },
          { kind: "sep" },
          { kind: "item", id: "quit", label: "Quit MonoCode", shortcut: `${MOD}Q` },
        ];
      case "view":
        return [
          { kind: "item", id: "toggle_sidebar", label: "Toggle Sidebar", shortcut: `${MOD}B` },
          { kind: "item", id: "open_inbox", label: "Inbox" },
          ...(onOpenNotes
            ? [{ kind: "item" as const, id: "open_notes", label: "Notes" }]
            : []),
          { kind: "item", id: "toggle_terminal", label: "Toggle Terminal", shortcut: `${MOD}J` },
          { kind: "item", id: "open_model_picker", label: "Switch Model…", shortcut: `${MOD}.` },
          { kind: "item", id: "toggle_diff", label: "Toggle Changes" },
          { kind: "sep" },
          { kind: "item", id: "focus_left", label: "Focus Pane Left", shortcut: `${MOD}${ALT}←` },
          { kind: "item", id: "focus_right", label: "Focus Pane Right", shortcut: `${MOD}${ALT}→` },
          { kind: "item", id: "focus_up", label: "Focus Pane Up", shortcut: `${MOD}${ALT}↑` },
          { kind: "item", id: "focus_down", label: "Focus Pane Down", shortcut: `${MOD}${ALT}↓` },
          { kind: "sep" },
          {
            kind: "item",
            id: "sidebar_opacity",
            label: "Sidebar Appearance…",
          },
        ];
      case "terminal":
        return [
          { kind: "item", id: "new_terminal", label: "New Terminal", shortcut: `${MOD}\`` },
          { kind: "item", id: "toggle_terminal", label: "Toggle Terminal", shortcut: `${MOD}J` },
        ];
    }
  };

  if (!open && !activeMenu) {
    return null;
  }

  const MENUS: { key: MenuKey; label: string }[] = [
    { key: "file", label: "File" },
    { key: "view", label: "View" },
    { key: "terminal", label: "Terminal" },
  ];

  return (
    <div
      ref={barRef}
      className="flex h-7 shrink-0 items-center gap-0.5 border-b border-content/10 bg-content/5 px-2 text-[12px]"
      data-tauri-drag-region="false"
    >
      {MENUS.map(({ key, label }) => {
        const isActive = activeMenu === key;
        return (
          <button
            key={key}
            type="button"
            data-tauri-drag-region="false"
            onClick={(e) => {
              if (isActive) {
                closeMenu();
              } else {
                openDropdown(key, e.currentTarget);
              }
            }}
            onMouseEnter={(e) => {
              if (activeMenu && activeMenu !== key) {
                openDropdown(key, e.currentTarget);
              }
            }}
            className={`rounded px-2 py-0.5 transition-colors ${
              isActive
                ? "bg-content/15 text-content"
                : "text-content/70 hover:bg-content/10 hover:text-content"
            }`}
          >
            {label}
          </button>
        );
      })}

      {activeMenu && menuAnchor ? (
        <ExplorerMenu
          x={menuAnchor.x}
          y={menuAnchor.y}
          items={getMenuItems(activeMenu)}
          ariaLabel={`${activeMenu} menu`}
          onPick={handlePick}
          onClose={closeMenu}
        />
      ) : null}
    </div>
  );
}
