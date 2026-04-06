"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Plus, Shield, Users, Ticket, Zap } from "lucide-react";
import Link from "next/link";

interface User {
	id: number;
	email: string;
	name: string | null;
	image: string | null;
	isAdmin: boolean;
	createdAt: string;
	invitedById: number | null;
	inviterName: string | null;
	inviterEmail: string | null;
}

interface InviteCode {
	id: number;
	code: string;
	createdAt: string;
	usedAt: string | null;
	creatorName: string | null;
	creatorEmail: string | null;
	redeemerName: string | null;
	redeemerEmail: string | null;
}

export default function AdminPage() {
	const { data: session } = useSession();
	const [usersList, setUsersList] = useState<User[]>([]);
	const [codes, setCodes] = useState<InviteCode[]>([]);
	const [generating, setGenerating] = useState(false);
	const [newCode, setNewCode] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);

	const fetchData = useCallback(async () => {
		const [usersRes, codesRes] = await Promise.all([
			fetch("/api/admin/users"),
			fetch("/api/admin/invite-codes"),
		]);
		if (usersRes.ok) setUsersList(await usersRes.json());
		if (codesRes.ok) setCodes(await codesRes.json());
	}, []);

	useEffect(() => {
		fetchData();
	}, [fetchData]);

	const handleGenerate = async () => {
		setGenerating(true);
		const res = await fetch("/api/invite/generate", { method: "POST" });
		if (res.ok) {
			const data = await res.json();
			setNewCode(data.code);
			fetchData();
		}
		setGenerating(false);
	};

	const handleCopyCode = async (code: string) => {
		await navigator.clipboard.writeText(code);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	if (!session?.user?.isAdmin) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] text-[#ededed]">
				<div className="text-center space-y-2">
					<Shield className="size-8 mx-auto text-[#555]" />
					<p className="text-[#888]">Admin access required</p>
					<Link href="/" className="text-sm text-[#555] hover:text-[#888] underline underline-offset-4">
						Back to home
					</Link>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-[#0a0a0a] p-6 text-[#ededed]">
			<div className="mx-auto max-w-4xl space-y-8">
				{/* Header */}
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="flex size-10 items-center justify-center rounded-xl bg-[#ededed] text-[#0a0a0a]">
							<Zap className="size-5" />
						</div>
						<div>
							<h1 className="text-xl font-bold">Admin</h1>
							<p className="text-sm text-[#888]">Manage users and invites</p>
						</div>
					</div>
					<Link
						href="/"
						className="text-sm text-[#555] hover:text-[#888] transition-colors"
					>
						Back to app
					</Link>
				</div>

				{/* Generate Invite */}
				<div className="rounded-lg border border-white/10 bg-[#111] p-5 space-y-3">
					<div className="flex items-center justify-between">
						<h2 className="flex items-center gap-2 font-semibold">
							<Ticket className="size-4" />
							Generate Invite Code
						</h2>
						<button
							type="button"
							onClick={handleGenerate}
							disabled={generating}
							className="flex items-center gap-1.5 rounded-lg bg-[#ededed] px-3 py-1.5 text-sm font-medium text-[#0a0a0a] transition-colors hover:bg-white disabled:opacity-50"
						>
							<Plus className="size-3.5" />
							{generating ? "Generating..." : "New Code"}
						</button>
					</div>
					{newCode && (
						<div className="flex items-center gap-2 rounded-lg bg-[#1a1a1a] px-4 py-3">
							<code className="flex-1 font-mono text-sm">{newCode}</code>
							<button
								type="button"
								onClick={() => handleCopyCode(newCode)}
								className="flex items-center gap-1 rounded px-2 py-1 text-xs text-[#888] hover:text-[#ededed] transition-colors"
							>
								{copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
								{copied ? "Copied" : "Copy"}
							</button>
						</div>
					)}
				</div>

				{/* Users Table */}
				<div className="rounded-lg border border-white/10 bg-[#111] overflow-hidden">
					<div className="flex items-center gap-2 px-5 py-4 border-b border-white/10">
						<Users className="size-4" />
						<h2 className="font-semibold">Users ({usersList.length})</h2>
					</div>
					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b border-white/5 text-left text-xs text-[#888] uppercase tracking-wider">
									<th className="px-5 py-3">User</th>
									<th className="px-5 py-3">Role</th>
									<th className="px-5 py-3">Invited by</th>
									<th className="px-5 py-3">Joined</th>
								</tr>
							</thead>
							<tbody>
								{usersList.map((u) => (
									<tr key={u.id} className="border-b border-white/5 last:border-0">
										<td className="px-5 py-3">
											<div>
												<span className="font-medium">{u.name ?? "—"}</span>
												<span className="ml-2 text-[#888]">{u.email}</span>
											</div>
										</td>
										<td className="px-5 py-3">
											{u.isAdmin ? (
												<span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-400">
													Admin
												</span>
											) : (
												<span className="text-[#555]">Member</span>
											)}
										</td>
										<td className="px-5 py-3 text-[#888]">
											{u.inviterName ?? u.inviterEmail ?? "—"}
										</td>
										<td className="px-5 py-3 text-[#888]">
											{new Date(u.createdAt).toLocaleDateString()}
										</td>
									</tr>
								))}
								{usersList.length === 0 && (
									<tr>
										<td colSpan={4} className="px-5 py-8 text-center text-[#555]">
											No users yet
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>
				</div>

				{/* Invite Codes Table */}
				<div className="rounded-lg border border-white/10 bg-[#111] overflow-hidden">
					<div className="flex items-center gap-2 px-5 py-4 border-b border-white/10">
						<Ticket className="size-4" />
						<h2 className="font-semibold">Invite Codes ({codes.length})</h2>
					</div>
					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b border-white/5 text-left text-xs text-[#888] uppercase tracking-wider">
									<th className="px-5 py-3">Code</th>
									<th className="px-5 py-3">Created by</th>
									<th className="px-5 py-3">Status</th>
									<th className="px-5 py-3">Created</th>
								</tr>
							</thead>
							<tbody>
								{codes.map((c) => (
									<tr key={c.id} className="border-b border-white/5 last:border-0">
										<td className="px-5 py-3">
											<code className="font-mono text-xs bg-[#1a1a1a] rounded px-1.5 py-0.5">
												{c.code}
											</code>
										</td>
										<td className="px-5 py-3 text-[#888]">
											{c.creatorName ?? c.creatorEmail ?? "—"}
										</td>
										<td className="px-5 py-3">
											{c.usedAt ? (
												<span className="text-[#888]">
													Used by {c.redeemerName ?? c.redeemerEmail ?? "someone"}
												</span>
											) : (
												<span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs text-green-400">
													Available
												</span>
											)}
										</td>
										<td className="px-5 py-3 text-[#888]">
											{new Date(c.createdAt).toLocaleDateString()}
										</td>
									</tr>
								))}
								{codes.length === 0 && (
									<tr>
										<td colSpan={4} className="px-5 py-8 text-center text-[#555]">
											No invite codes yet
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		</div>
	);
}
