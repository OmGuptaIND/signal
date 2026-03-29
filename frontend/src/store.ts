import { atom } from "jotai";

import type {
	ActiveRun,
	AuthStatusResponse,
	Signal,
	SignalDirection,
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

// SSE connection status
export const sseConnectedAtom = atom<boolean>(false);

// Signal filters
export const signalFilterIndexAtom = atom<string | null>(null);
export const signalFilterDirectionAtom = atom<SignalDirection | null>(null);

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

// Derived: active strategy IDs
export const activeStrategyIdsAtom = atom<string[]>((get) => {
	const runs = get(activeRunsAtom);
	return runs
		.filter((r) => r.status === "running" || r.status === "starting")
		.map((r) => r.strategy_id);
});
