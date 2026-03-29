import { atom } from "jotai";

import type { ActiveRun, AuthStatusResponse, Signal } from "@/lib/api-types";

export type { ActiveRun, Signal };
export type AuthStatus = AuthStatusResponse;

export const signalsAtom = atom<Signal[]>([]);
export const authStatusAtom = atom<AuthStatus | null>(null);
export const activeRunAtom = atom<ActiveRun | null>(null);
