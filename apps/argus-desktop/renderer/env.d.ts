import 'react';

declare module 'react' {
  interface CSSProperties {
    WebkitAppRegion?: string;
  }
}

interface ImportMeta {
  env: Record<string, string>;
}
