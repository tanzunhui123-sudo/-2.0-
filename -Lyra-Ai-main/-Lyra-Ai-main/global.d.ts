/**
 * Global type declarations for aistudio API
 */

interface AIStudio {
  hasSelectedApiKey(): Promise<boolean>;
  openSelectKey(): Promise<void>;
}

declare global {
  interface Window {
    aistudio?: AIStudio;
  }
}

export {};
