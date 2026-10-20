declare module '@xyflow/react/dist/style.css' {}
declare module '*.css' {}
declare module '*.css?inline' {
  const css: string
  export default css
}

interface ImportMetaEnv {
  readonly VITE_VISTA_AGENTATION_ENDPOINT?: string
}

interface ImportMeta {
  readonly env?: ImportMetaEnv
}
