interface ImportMetaEnv {
  readonly VITE_API_KEY: string;
  readonly VITE_APP_TITLE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare var process: {
  env: {
    API_KEY?: string;
    [key: string]: any;
  };
};

