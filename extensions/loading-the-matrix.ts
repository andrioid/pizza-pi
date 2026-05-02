/**
 * Loading the Matrix — horizontal rain indicator.
 *
 * Each column is randomly assigned a brightness level per frame, weighted
 * by state. Glyphs morph every frame via integer hashing — no repeating
 * patterns, just organic Matrix-style rain. Color/rhythm adapt to state:
 *
 *   thinking  → blue, sparse, slow
 *   toolcall  → cyan, medium, purposeful
 *   text      → orange, dense, fast
 *   tools     → dimmed theme, quiet
 *   compact   → purple, gentle pulse
 *   error     → red flash, dense
 *   default   → theme colors, standard
 *
 * Text suppression:
 *   "working" label → embedded left of rain ("Reading the rain...")
 *   "Thinking" label → blue "Learning kung-fu...."
 */

import type {
	ExtensionAPI,
	ExtensionContext,
	WorkingIndicatorOptions,
} from "@mariozechner/pi-coding-agent";

// ── Glyphs ──────────────────────────────────────────────────────────────────

const GLYPHS = [
	"ｱ", "ｲ", "ｳ", "ｴ", "ｵ", "ｶ", "ｷ", "ｸ", "ｹ", "ｺ",
	"ｻ", "ｼ", "ｽ", "ｾ", "ｿ", "ﾀ", "ﾁ", "ﾂ", "ﾃ", "ﾄ",
	"ﾅ", "ﾆ", "ﾇ", "ﾈ", "ﾉ", "ﾊ", "ﾋ", "ﾌ", "ﾍ", "ﾎ",
	"ﾏ", "ﾐ", "ﾑ", "ﾒ", "ﾓ", "ﾔ", "ﾕ", "ﾖ", "ﾗ", "ﾘ",
	"ﾙ", "ﾚ", "ﾛ", "ﾜ", "ｦ", "ﾝ",
	"0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
	":", ".", "=", "*", "+",
];

// ── Colors ──────────────────────────────────────────────────────────────────

const BLUE = "\x1b[38;2;96;165;250m";
const BLUE_DIM = "\x1b[38;2;59;130;200m";
const BLUE_FAINT = "\x1b[38;2;34;76;137m";

const ORANGE = "\x1b[38;2;255;180;50m";
const ORANGE_DIM = "\x1b[38;2;230;140;40m";
const ORANGE_FAINT = "\x1b[38;2;175;110;45m";

const CYAN = "\x1b[38;2;34;211;238m";
const CYAN_DIM = "\x1b[38;2;22;163;180m";
const CYAN_FAINT = "\x1b[38;2;21;114;133m";

const PURPLE = "\x1b[38;2;168;85;247m";
const PURPLE_DIM = "\x1b[38;2;126;68;196m";
const PURPLE_FAINT = "\x1b[38;2;88;48;136m";

const RED = "\x1b[38;2;239;68;68m";
const RED_DIM = "\x1b[38;2;185;50;50m";
const RED_FAINT = "\x1b[38;2;130;40;40m";

const BOLD = "\x1b[1m";
const UNBOLD = "\x1b[22m";
const RESET = "\x1b[39m";

// ── Rain config ─────────────────────────────────────────────────────────────

type Level = "head" | "body" | "tail" | "fade" | "gap";
type IndicatorState = "default" | "thinking" | "toolcall" | "text" | "tools" | "compact" | "error";

const LINE_WIDTH = 24;

const DENSITY: Record<IndicatorState, { head: number; body: number; tail: number; fade: number }> = {
	default:  { head: 0.03, body: 0.06, tail: 0.10, fade: 0.18 },
	thinking: { head: 0.02, body: 0.05, tail: 0.09, fade: 0.16 },
	toolcall: { head: 0.04, body: 0.10, tail: 0.16, fade: 0.26 },
	text:     { head: 0.06, body: 0.15, tail: 0.22, fade: 0.35 },
	tools:    { head: 0.02, body: 0.06, tail: 0.09, fade: 0.15 },
	compact:  { head: 0.02, body: 0.05, tail: 0.09, fade: 0.16 },
	error:    { head: 0.08, body: 0.18, tail: 0.24, fade: 0.34 },
};

const INTERVAL: Record<IndicatorState, number> = {
	default:  160,
	thinking: 200,
	toolcall: 140,
	text:     130,
	tools:    180,
	compact:  200,
	error:    100,
};

// ── Hash ────────────────────────────────────────────────────────────────────

function hash(x: number): number {
	x = ((x >> 16) ^ x) * 0x45d9f3b | 0;
	x = ((x >> 16) ^ x) * 0x45d9f3b | 0;
	x = (x >> 16) ^ x;
	return x >>> 0;
}

function pickGlyph(seed: number): string {
	return GLYPHS[hash(seed) % GLYPHS.length]!;
}

function paintChar(
	level: Level,
	ch: string,
	state: IndicatorState,
	theme: { bold: (s: string) => string; fg: (color: string, s: string) => string },
): string {
	if (level === "gap") return " ";

	switch (state) {
		case "thinking":
			switch (level) {
				case "head": return BLUE + BOLD + ch + UNBOLD + RESET;
				case "body": return BLUE + ch + RESET;
				case "tail": return BLUE_DIM + ch + RESET;
				case "fade": return BLUE_FAINT + ch + RESET;
			}
			break;
		case "toolcall":
			switch (level) {
				case "head": return CYAN + BOLD + ch + UNBOLD + RESET;
				case "body": return CYAN + ch + RESET;
				case "tail": return CYAN_DIM + ch + RESET;
				case "fade": return CYAN_FAINT + ch + RESET;
			}
			break;
		case "text":
			switch (level) {
				case "head": return ORANGE + BOLD + ch + UNBOLD + RESET;
				case "body": return ORANGE + ch + RESET;
				case "tail": return ORANGE_DIM + ch + RESET;
				case "fade": return ORANGE_FAINT + ch + RESET;
			}
			break;
		case "compact":
			switch (level) {
				case "head": return PURPLE + BOLD + ch + UNBOLD + RESET;
				case "body": return PURPLE + ch + RESET;
				case "tail": return PURPLE_DIM + ch + RESET;
				case "fade": return PURPLE_FAINT + ch + RESET;
			}
			break;
		case "error":
			switch (level) {
				case "head": return RED + BOLD + ch + UNBOLD + RESET;
				case "body": return RED + ch + RESET;
				case "tail": return RED_DIM + ch + RESET;
				case "fade": return RED_FAINT + ch + RESET;
			}
			break;
		case "tools":
			switch (level) {
				case "head": return theme.fg("accent", ch);
				case "body": return theme.fg("muted", ch);
				case "tail": return theme.fg("dim", ch);
				case "fade": return theme.fg("dim", ch);
			}
			break;
		default:
			switch (level) {
				case "head": return theme.bold(theme.fg("borderAccent", ch));
				case "body": return theme.fg("accent", ch);
				case "tail": return theme.fg("muted", ch);
				case "fade": return theme.fg("dim", ch);
			}
	}
	return " ";
}

// ── Frame builder ───────────────────────────────────────────────────────────

// Drop lifecycle: a bright character persists for several frames,
// fading out over time. Each column has its own cycle length and offset,
// so drops are staggered across the strip — creating the feeling of rain
// sweeping across rather than flickering randomly.
const DROP_LENGTH = 6; // head → body → body → tail → fade → fade
const WORKING_TEXT = "Moving like they do...";

function paintLabel(text: string, state: IndicatorState, theme: { bold: (s: string) => string; fg: (color: string, s: string) => string }): string {
	switch (state) {
		case "thinking": return BLUE_FAINT + text + RESET;
		case "toolcall": return CYAN_FAINT + text + RESET;
		case "text": return ORANGE_FAINT + text + RESET;
		case "compact": return PURPLE_FAINT + text + RESET;
		case "error": return RED_FAINT + text + RESET;
		case "tools": return theme.fg("dim", text);
		default: return theme.fg("muted", text);
	}
}

function pickLevel(column: number, frame: number, density: { head: number; body: number; tail: number; fade: number }): Level {
	// Per-column drop lifecycle with random period and offset.
	const h = hash(column * 7919) >>> 0;
	const cycleLen = (h % 13) + 8;           // 8–20 frames per drop cycle
	const offset = ((h * 7) >>> 0) % cycleLen; // random start position
	const pos = (frame + offset) % cycleLen;   // advancing position

	if (pos < DROP_LENGTH) {
		// In the drop: head → body → body → tail → fade → fade
		switch (pos) {
			case 0: return "head";
			case 1: case 2: return "body";
			case 3: return "tail";
			default: return "fade";
		}
	}

	// In the gap between drops: density-weighted stray characters
	const r = (hash(column * 271828 + frame * 314159 + pos * 31) >>> 0) / 4294967296;
	if (r < density.head * 0.3) return "head";
	if (r < density.body * 0.3) return "body";
	if (r < density.tail * 0.4) return "tail";
	if (r < density.fade * 0.5) return "fade";
	return "gap";
}

const FRAME_COUNT = 20;

function buildFrames(ctx: ExtensionContext, state: IndicatorState): string[] {
	const { theme } = ctx.ui;
	const density = DENSITY[state];
	const frames: string[] = [];

	// Working text on the left side of the rain strip
	const label = paintLabel(WORKING_TEXT, state, theme) + "  ";

	for (let f = 0; f < FRAME_COUNT; f++) {
		let line = label;
		for (let c = 0; c < LINE_WIDTH; c++) {
			const level = pickLevel(c, f, density);

			if (level === "gap") {
				// 25% chance a gap has a barely-visible ghost
				if (hash(c * 7919 + f * 104729 + 31337) % 4 === 0) {
					line += paintChar("fade", pickGlyph(hash(c * 7919 + f * 104729 + 31337)), state, theme);
				} else {
					line += " ";
				}
			} else {
				// Glyph is stable within a drop: seed depends on column +
				// which drop cycle we're in, not on frame. This makes characters
				// persist through the brightness sweep instead of flickering.
				const h = hash(c * 7919) >>> 0;
				const cycleLen = (h % 13) + 8;
				const offset = ((h * 7) >>> 0) % cycleLen;
				const dropIndex = Math.floor((f + offset) / cycleLen);
				const seed = hash(c * 271828 + dropIndex * 314159) >>> 0;
				line += paintChar(level, pickGlyph(seed), state, theme);
			}
		}
		frames.push(line);
	}

	return frames;
}

function buildIndicator(ctx: ExtensionContext, state: IndicatorState = "default"): WorkingIndicatorOptions {
	return {
		frames: buildFrames(ctx, state),
		intervalMs: INTERVAL[state],
	};
}

// ── Extension ───────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
	let currentState: IndicatorState = "default";

	function applyState(ctx: ExtensionContext, state: IndicatorState) {
		if (state === currentState) return;
		currentState = state;
		ctx.ui.setWorkingIndicator(buildIndicator(ctx, state));
	}

	pi.on("session_start", async (_event, ctx) => {
		currentState = "default";
		ctx.ui.setWorkingIndicator(buildIndicator(ctx));
		ctx.ui.setWorkingMessage("");            // text is embedded in the rain frames
		ctx.ui.setHiddenThinkingLabel(BLUE + "Learning kung-fu...." + RESET);
	});

	// ── Streaming state: thinking / toolcall / text ───────────────────────

	pi.on("message_update", async (event, ctx) => {
		const e = event.assistantMessageEvent;
		switch (e.type) {
			case "thinking_start":
			case "thinking_delta":
				applyState(ctx, "thinking");
				break;
			case "toolcall_start":
			case "toolcall_delta":
				applyState(ctx, "toolcall");
				break;
			case "text_start":
			case "text_delta":
				applyState(ctx, "text");
				break;
		}
	});

	// ── Tool execution ───────────────────────────────────────────────────

	pi.on("tool_execution_start", async (_event, ctx) => {
		applyState(ctx, "tools");
	});

	// ── Compaction ────────────────────────────────────────────────────────

	pi.on("session_before_compact", async (_event, ctx) => {
		applyState(ctx, "compact");
	});

	pi.on("session_compact", async (_event, ctx) => {
		// Stay in compact state a breath longer — message_end will reset to default
	});

	// ── Error ────────────────────────────────────────────────────────────

	pi.on("message_end", async (event, ctx) => {
		const msg = event.message;
		if (msg.role === "assistant" && msg.stopReason === "error") {
			applyState(ctx, "error");
		} else {
			applyState(ctx, "default");
		}
	});

	pi.on("agent_end", async (_event, ctx) => {
		applyState(ctx, "default");
	});
}