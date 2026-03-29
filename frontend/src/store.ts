import { atom } from "jotai";

import type {
	ActiveRun,
	AuthStatusResponse,
	Signal,
	Strategy,
} from "@/lib/api-types";

export type { ActiveRun, Signal, Strategy };
export type AuthStatus = AuthStatusResponse;

// Signals grouped by strategy_id
export const signalsByStrategyAtom = atom<Record<string, Signal[]>>({});

// All active runs (multiple strategies can run concurrently)
export const activeRunsAtom = atom<ActiveRun[]>([]);

// Available strategy catalog
export const strategiesAtom = atom<Strategy[]>([]);

export const authStatusAtom = atom<AuthStatus | null>(null);

// Derived: flat list of all signals across strategies
export const allSignalsAtom = atom<Signal[]>((get) => {
	const byStrategy = get(signalsByStrategyAtom);
	const all: Signal[] = [];
	for (const signals of Object.values(byStrategy)) {
		all.push(...signals);
	}
	return all.sort(
		(a, b) =>
			new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
	);
});
