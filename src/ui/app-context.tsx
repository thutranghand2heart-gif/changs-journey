import { createContext, useContext } from 'react';
import type { GlobalSettings } from '../db/schema';
import { DEFAULT_SETTINGS } from '../db/repo';

export interface AppState { settings: GlobalSettings; reduced: boolean }
export const AppCtx = createContext<AppState>({ settings: DEFAULT_SETTINGS, reduced: false });
export const useApp = () => useContext(AppCtx);
