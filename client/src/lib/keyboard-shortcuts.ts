export interface ShortcutDefinition {
  keys: string[];
  description: string;
}

export interface ShortcutCategory {
  name: string;
  shortcuts: ShortcutDefinition[];
}

export const KEYBOARD_SHORTCUTS: ShortcutCategory[] = [
  {
    name: "Navigation",
    shortcuts: [
      { keys: ["Ctrl", "K"], description: "Open command palette" },
      { keys: ["Ctrl", "Space"], description: "Open command palette" },
    ],
  },
  {
    name: "Work Orders",
    shortcuts: [
      { keys: ["Ctrl", "S"], description: "Save work order (on detail page)" },
      { keys: ["Enter"], description: "Submit form / confirm action" },
    ],
  },
  {
    name: "Appointments",
    shortcuts: [
      { keys: ["Enter"], description: "Navigate to linked work order" },
    ],
  },
  {
    name: "General",
    shortcuts: [
      { keys: ["?"], description: "Show keyboard shortcuts" },
      { keys: ["Esc"], description: "Close modal / dialog" },
      { keys: ["Ctrl", "A"], description: "Select all rows on current table page" },
      { keys: ["←"], description: "Previous image (in lightbox)" },
      { keys: ["→"], description: "Next image (in lightbox)" },
    ],
  },
];
