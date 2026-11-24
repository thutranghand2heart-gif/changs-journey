// Minimal typings for React 19, because @types/react is not installable in the
// offline build environment. Hooks are typed; element props are permissive.
declare module 'react' {
  export type ReactNode = any;
  export type FC<P = {}> = (props: P & { children?: ReactNode }) => ReactNode;
  export type SetState<T> = (v: T | ((prev: T) => T)) => void;
  export function useState<T>(init: T | (() => T)): [T, SetState<T>];
  export function useEffect(fn: () => void | (() => void), deps?: readonly unknown[]): void;
  export function useLayoutEffect(fn: () => void | (() => void), deps?: readonly unknown[]): void;
  export function useMemo<T>(fn: () => T, deps: readonly unknown[]): T;
  export function useCallback<T extends (...a: any[]) => any>(fn: T, deps: readonly unknown[]): T;
  export function useRef<T>(init: T): { current: T };
  export function useRef<T>(init: T | null): { current: T | null };
  export interface Context<T> { Provider: any; _v?: T }
  export function createContext<T>(v: T): Context<T>;
  export function useContext<T>(c: Context<T>): T;
  export const Fragment: any;
  export const StrictMode: any;
  const React: any;
  export default React;
}
declare module 'react-dom/client' {
  export function createRoot(el: Element): { render(n: any): void };
}
declare module 'react/jsx-runtime' {
  export const jsx: any;
  export const jsxs: any;
  export const Fragment: any;
}
declare namespace JSX {
  interface IntrinsicElements { [name: string]: any }
  type Element = any;
  interface ElementChildrenAttribute { children: {} }
  interface IntrinsicAttributes { key?: any }
}
declare module 'jszip' {
  const JSZip: any;
  export default JSZip;
}
declare module '*.css';

declare const __APP_VERSION__: string;
