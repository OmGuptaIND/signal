/** Types matching the backend API responses exactly. */

// --- Kite Auth ---

export interface AuthStatusResponse {
	is_connected: boolean;
	message: string;
	last_updated_at: string | null;
}

export interface KiteLoginUrlResponse {
	login_url: string;
}

export interface KiteConnectivityResponse {
	status: string;
	symbol: string;
	ltp_symbol: string;
	last_price: number;
	latency_ms: number;
	auth_mode: string;
	runtime_request_token_used: boolean;
	access_token_only_mode: boolean;
}

export interface KiteCredentialsStatusResponse {
	api_key_present: boolean;
	api_secret_present: boolean;
	access_token_present: boolean;
	access_token_only_mode: boolean;
	request_token_present: boolean;
	runtime_request_token_present: boolean;
	runtime_request_received_at: string;
	redirected_url_present: boolean;
	redirected_url_has_query: boolean;
	redirected_url_query_keys: string[];
	redirected_url_has_request_token: boolean;
}

// --- Strategies ---

export interface Strategy {
	id: string;
	name: string;
	description: string;
	how_it_works: string;
	params: Record<string, unknown>;
}

export interface StrategiesResponse {
	strategies: Strategy[];
}

// --- Signals ---

export type SignalDirection = "LONG_BIAS" | "SHORT_BIAS" | "NEUTRAL";

export interface Signal {
	id: number;
	strategy_id: string;
	timestamp: string;
	index_name: string;
	signal: SignalDirection;
	confidence: number;
	total_delta: number;
	weighted_total_delta: number;
	timeframe_votes: string;
	spot_price: number;
	atm_strike: number;
	reason: string;
}

export interface SignalHistoryResponse {
	signals: Signal[];
}

// --- SSE Events ---

export interface SSENewSignalEvent {
	type: "new_signal";
	data: Signal;
}

export interface SSEConnectedEvent {
	type: "connected";
	data: { message: string };
}

export type SSEEvent = SSENewSignalEvent | SSEConnectedEvent;

// --- Runs ---

export type RunStatus =
	| "starting"
	| "running"
	| "stopped"
	| "expired"
	| "error";

export interface ActiveRun {
	id: number;
	strategy_id: string;
	status: RunStatus;
	started_at: string | null;
	stopped_at: string | null;
	token_expires_at: string | null;
	error_message: string | null;
	signals_count: number;
}

export interface ActiveRunsResponse {
	runs: ActiveRun[];
}

export interface ActiveRunResponse {
	run: ActiveRun | null;
}

export interface RunListResponse {
	runs: ActiveRun[];
}
