/**
 * Loading the Matrix — working indicator inspired by the falling code from
 * The Matrix. Active whenever the extension is loaded, regardless of theme.
 * Colors are pulled from the active theme so it adapts gracefully.
 *
 * Commands:
 *   /loading-the-matrix            Show current state
 *   /loading-the-matrix on         Enable (default)
 *   /loading-the-matrix off        Restore pi's default spinner
 */

import type {
	ExtensionAPI,
	ExtensionContext,
	WorkingIndicatorOptions,
} from "@mariozechner/pi-coding-agent";

type Mode = "on" | "off";

const WORKING_MESSAGES = [
	"Following the white rabbit...",
	"Dodging bullets...",
	"Bending spoons...",
	"Loading the construct...",
	"Decoding the source...",
	"Reading the rain...",
	"Taking the red pill...",
	"Unplugging from the system...",
	"Calling Tank for an exit...",
	"Jacking into the mainframe...",
	"Waking up in the pod...",
	"Believing in the One...",
	"Asking the Oracle...",
	"Knocking, Neo...",
	"Evading Agent Smith...",
	"Compiling Agent Smith...",
	"Sidestepping sentinels...",
	"Rebooting Zion...",
	"Negotiating with the Architect...",
	"Tracing the trace program...",
	"Parsing the green rain...",
	"Streaming katakana...",
	"Reading between the glyphs...",
	"Folding spacetime in the construct...",
	"Recompiling reality...",
	"Buffering déjà vu...",
	"Rendering the desert of the real...",
	"Resolving glitch in the Matrix...",
	"There is no spoon...",
	"Free your mind...",
	"Whoa...",
	"I know kung fu...",
];

function pickMessage(): string {
	return WORKING_MESSAGES[Math.floor(Math.random() * WORKING_MESSAGES.length)]!;
}

// Iconic half-width katakana + digits. Half-width so each glyph is 1 column wide.
const GLYPHS = [
	"ｱ", "ｲ", "ｳ", "ｴ", "ｵ", "ｶ", "ｷ", "ｸ", "ｹ", "ｺ",
	"ｻ", "ｼ", "ｽ", "ｾ", "ｿ", "ﾀ", "ﾁ", "ﾂ", "ﾃ", "ﾄ",
	"ﾅ", "ﾆ", "ﾇ", "ﾈ", "ﾉ", "ﾊ", "ﾋ", "ﾌ", "ﾍ", "ﾎ",
	"ﾏ", "ﾐ", "ﾑ", "ﾒ", "ﾓ", "ﾔ", "ﾕ", "ﾖ", "ﾗ", "ﾘ",
	"ﾙ", "ﾚ", "ﾛ", "ﾜ", "ｦ", "ﾝ",
	"0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
	":", ".", "=", "*", "+",
];

// One "drop" is six animation steps: head flash → body → body → tail → fade → gap.
// We draw two back-to-back drops with different glyphs so the loop (12 frames)
// reads as a continuous stream rather than a repeating twitch.
// Brightness levels map to existing theme colors so the indicator adapts
// politely to any palette while looking unmistakably Matrix on the `matrix` theme.
const DROP_STEPS: Array<{ level: "head" | "body" | "tail" | "fade" | "gap"; glyph: number }> = [
	{ level: "head", glyph: 0 },
	{ level: "body", glyph: 1 },
	{ level: "body", glyph: 2 },
	{ level: "tail", glyph: 3 },
	{ level: "fade", glyph: 4 },
	{ level: "gap", glyph: -1 },
];

function pickGlyph(seed: number): string {
	// Deterministic pseudo-random so frames are stable across reloads.
	const idx = Math.abs(Math.sin(seed * 12.9898) * 43758.5453);
	return GLYPHS[Math.floor((idx - Math.floor(idx)) * GLYPHS.length)]!;
}

function buildFrames(ctx: ExtensionContext): string[] {
	const { theme } = ctx.ui;
	const paint = (level: (typeof DROP_STEPS)[number]["level"], ch: string): string => {
		switch (level) {
			case "head":
				// Leading edge — brightest. borderAccent = phosphorBright on matrix theme.
				return theme.bold(theme.fg("borderAccent", ch));
			case "body":
				return theme.fg("accent", ch);
			case "tail":
				return theme.fg("muted", ch);
			case "fade":
				return theme.fg("dim", ch);
			case "gap":
				return " ";
		}
	};

	const frames: string[] = [];
	// Two drops with distinct glyph seeds → 12 frames total.
	for (let drop = 0; drop < 2; drop++) {
		for (let i = 0; i < DROP_STEPS.length; i++) {
			const step = DROP_STEPS[i]!;
			if (step.level === "gap") {
				frames.push(paint("gap", ""));
			} else {
				// Change glyph every frame *within* the drop so the character
				// appears to be morphing as it falls — a Matrix signature touch.
				const seed = drop * 100 + i * 7 + step.glyph;
				frames.push(paint(step.level, pickGlyph(seed)));
			}
		}
	}
	return frames;
}

function buildIndicator(ctx: ExtensionContext): WorkingIndicatorOptions {
	return {
		frames: buildFrames(ctx),
		intervalMs: 110,
	};
}

export default function (pi: ExtensionAPI) {
	let mode: Mode = "on";

	const apply = (ctx: ExtensionContext) => {
		if (mode === "on") {
			ctx.ui.setWorkingIndicator(buildIndicator(ctx));
		} else {
			// Restore pi's default spinner.
			ctx.ui.setWorkingIndicator(undefined);
		}
	};

	pi.on("session_start", async (_event, ctx) => {
		apply(ctx);
	});

	pi.on("agent_start", async (_event, ctx) => {
		if (mode === "on") {
			ctx.ui.setWorkingMessage(pickMessage());
		}
	});

	pi.on("agent_end", async (_event, ctx) => {
		// Restore pi's default working message.
		ctx.ui.setWorkingMessage();
	});

	pi.registerCommand("loading-the-matrix", {
		description: "Matrix falling-symbols loading indicator: on | off.",
		handler: async (args, ctx) => {
			const arg = args.trim().toLowerCase();
			if (!arg) {
				ctx.ui.notify(`loading-the-matrix: ${mode}`, "info");
				return;
			}
			if (arg !== "on" && arg !== "off") {
				ctx.ui.notify("Usage: /loading-the-matrix [on|off]", "error");
				return;
			}
			mode = arg;
			apply(ctx);
			ctx.ui.notify(`loading-the-matrix: ${mode}`, "info");
		},
	});
}
