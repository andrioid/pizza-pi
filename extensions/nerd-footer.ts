/**
 * Nerd-font footer:
 *   left:  folder · branch (dirty/ahead/behind)
 *   right: model + thinking · context · session cost
 *
 * Requires a Nerd Font to render the glyphs correctly.
 */

import type { AssistantMessage } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import { execFile } from "node:child_process";
import { basename } from "node:path";

// Nerd Font glyphs. Embedded as literal chars so no surrogate math is needed.
const ICON_FOLDER = "\uf07b"; //  nf-fa-folder
const ICON_BRANCH = "\ue725"; //  nf-dev-git_branch
const ICON_MODEL = "\uf1b2"; //  nf-fa-cube
const ICON_BRAIN = "\uf5dc"; //  nf-fa-brain
const ICON_DB = "\ueb4b"; //  nf-cod-database
const ICON_MONEY = "\uf155"; //  nf-fa-dollar

// Short thinking-level labels shown next to the brain glyph.
const THINKING_SHORT: Record<string, string> = {
	off: "off",
	minimal: "min",
	low: "low",
	medium: "med",
	high: "high",
	xhigh: "xhi",
};

// Theme colors keyed by thinking level (see TUI docs: thinkingOff, thinkingLow, ...).
const THINKING_COLOR: Record<string, string> = {
	off: "thinkingOff",
	minimal: "thinkingMinimal",
	low: "thinkingLow",
	medium: "thinkingMedium",
	high: "thinkingHigh",
	xhigh: "thinkingXhigh",
};

const GIT_REFRESH_MS = 3000;

interface GitStatus {
	dirty: boolean;
	ahead: number;
	behind: number;
}

export default function (pi: ExtensionAPI) {
	pi.on("session_start", (_event, ctx) => {
		ctx.ui.setFooter((tui, theme, footerData) => {
			let gitStatus: GitStatus | null = null;
			let refreshing = false;

			const refreshGit = () => {
				if (refreshing) return;
				refreshing = true;
				execFile(
					"git",
					["status", "--porcelain=v1", "--branch"],
					{ cwd: ctx.cwd, timeout: 2000 },
					(err, stdout) => {
						refreshing = false;
						if (err) {
							gitStatus = null;
							tui.requestRender();
							return;
						}
						gitStatus = parseGitStatus(stdout);
						tui.requestRender();
					},
				);
			};

			// Kick off an immediate refresh and poll.
			refreshGit();
			const interval = setInterval(refreshGit, GIT_REFRESH_MS);
			const unsubBranch = footerData.onBranchChange(() => {
				refreshGit();
				tui.requestRender();
			});

			return {
				dispose: () => {
					clearInterval(interval);
					unsubBranch();
				},
				invalidate() {},
				render(width: number): string[] {
					const folder = basename(ctx.cwd) || ctx.cwd;
					const branch = footerData.getGitBranch();
					const modelId = ctx.model?.id ?? "no-model";
					const thinking = pi.getThinkingLevel();
					const thinkingShort = THINKING_SHORT[thinking] ?? thinking;
					const thinkingColor = THINKING_COLOR[thinking] ?? "muted";

					const usage = ctx.getContextUsage();
					let ctxStr = "—";
					let ctxColor: string = "text";
					if (usage) {
						const tokensK =
							usage.tokens == null ? "?" : `${Math.round(usage.tokens / 1000)}k`;
						const windowK = `${Math.round(usage.contextWindow / 1000)}k`;
						ctxStr = `${tokensK}/${windowK}`;
						if (usage.percent != null) {
							if (usage.percent >= 85) ctxColor = "error";
							else if (usage.percent >= 70) ctxColor = "warning";
						}
					}

					// Cumulative session cost across assistant turns.
					let cost = 0;
					for (const e of ctx.sessionManager.getBranch()) {
						if (e.type === "message" && e.message.role === "assistant") {
							cost += (e.message as AssistantMessage).usage.cost.total;
						}
					}
					const costStr = formatCost(cost);

					const sep = theme.fg("dim", "  ");

					// Left: project context (folder, branch + git state).
					const leftParts: string[] = [
						`${theme.fg("accent", ICON_FOLDER)} ${theme.fg("text", folder)}`,
					];
					if (branch) {
						const branchBits: string[] = [
							theme.fg("accent", ICON_BRANCH),
							theme.fg("text", branch),
						];
						if (gitStatus) {
							if (gitStatus.dirty) {
								branchBits.push(theme.fg("warning", "✱"));
							}
							if (gitStatus.ahead > 0) {
								branchBits.push(theme.fg("success", `↑${gitStatus.ahead}`));
							}
							if (gitStatus.behind > 0) {
								branchBits.push(theme.fg("error", `↓${gitStatus.behind}`));
							}
						}
						leftParts.push(branchBits.join(" "));
					}
					const left = leftParts.join(sep);

					// Right: LLM context (model + thinking, context, cost).
					const rightParts: string[] = [
						[
							theme.fg("accent", ICON_MODEL),
							theme.fg("text", modelId),
							theme.fg(thinkingColor as any, ICON_BRAIN),
							theme.fg(thinkingColor as any, thinkingShort),
						].join(" "),
						`${theme.fg("accent", ICON_DB)} ${theme.fg(ctxColor as any, ctxStr)}`,
						`${theme.fg("accent", ICON_MONEY)} ${theme.fg("text", costStr)}`,
					];
					const right = rightParts.join(sep);

					// Side padding so content doesn't hug the terminal edge.
					const PAD = 2;
					const padStr = " ".repeat(PAD);
					const inner = Math.max(0, width - PAD * 2);

					const lw = visibleWidth(left);
					const rw = visibleWidth(right);
					let line: string;
					if (lw + rw + 1 <= inner) {
						const gap = " ".repeat(inner - lw - rw);
						line = padStr + left + gap + right + padStr;
					} else {
						// Not enough room for both: prefer right (LLM status), truncate left.
						const leftBudget = Math.max(0, inner - rw - 1);
						const truncatedLeft = truncateToWidth(left, leftBudget);
						const gap = " ".repeat(
							Math.max(1, inner - visibleWidth(truncatedLeft) - rw),
						);
						line = padStr + truncatedLeft + gap + right + padStr;
					}

					return [truncateToWidth(line, width)];
				},
			};
		});
	});
}

function parseGitStatus(stdout: string): GitStatus {
	const lines = stdout.split("\n");
	let dirty = false;
	let ahead = 0;
	let behind = 0;
	for (const line of lines) {
		if (line.startsWith("## ")) {
			// e.g. "## main...origin/main [ahead 2, behind 1]"
			const aheadMatch = line.match(/ahead (\d+)/);
			const behindMatch = line.match(/behind (\d+)/);
			if (aheadMatch) ahead = Number(aheadMatch[1]);
			if (behindMatch) behind = Number(behindMatch[1]);
		} else if (line.length > 0) {
			dirty = true;
		}
	}
	return { dirty, ahead, behind };
}

function formatCost(cost: number): string {
	if (cost <= 0) return "$0";
	if (cost < 0.01) return "<$0.01";
	if (cost < 10) return `$${cost.toFixed(2)}`;
	return `$${cost.toFixed(1)}`;
}
