import { $ as VERTICAL_ALIGN_MIDDLE, F as DEFAULT_FONT_COLOR, G as PLACEHOLDER_FONT_COLOR, K as SYNTHETIC_BOLD_CSS_TEXT_SHADOW, N as DEFAULT_ALIGNMENT, a as createListItemSplitRange, b as createBoxDimension, c as getListItemRange, h as getFontKitFont, i as TEXT_LINE_SPLIT_UNIT, j as CODE_BACKGROUND_COLOR, l as getTableBodyRange, n as LIST_ITEM_SPLIT_UNIT, o as createTableBodySplitRange, r as TABLE_BODY_SPLIT_UNIT, s as createTextLineSplitRange, t as BUILT_IN_DYNAMIC_LAYOUT_SPLIT_UNITS, u as getTextLineRange, x as getBoxContentArea } from "./splitRange-BOUo4Tvl.js";
import { a as measureTextLines, d as isInlineMarkdownTextSchema, g as parseInlineMarkdown, p as resolveFontVariant } from "./measure-B_6K--bf.js";
import { a as mapVerticalAlignToFlex, c as Formatter, i as makeElementPlainTextContentEditable, l as getExtraFormatterSchema, n as textSchema, o as uiRender$4, r as buildStyledTextContainer, s as propPanel$3, t as builtInPlugins, u as pdfRender$4 } from "./builtins-D6FCodhC.js";
import { a as getCellPropPanelSchema, c as HEX_COLOR_PATTERN, i as getBodyWithSchemaRange, l as createSingleTable, n as getDynamicLayoutForTable, o as getColumnStylesPropPanelSchema, r as getBody, s as getDefaultCellStyles, t as getDynamicHeightsForTable } from "./dynamicTemplate-Cco1tXiK.js";
import { c as isEditable, d as countUniqueVariableNames, f as getVariableNames, i as createSvgStr, l as readFile, n as convertForPdfLayoutProps, o as hex2PrintingColor, p as visitVariables, r as createErrorElm, t as addAlphaToHex, u as rotatePoint } from "./utils-Fs3Zwymf.js";
import { a as normalizeListItems, c as LIST_STYLE_BULLET, i as normalizeListItemEntries, l as LIST_STYLE_ORDERED, n as calculateListLayout, o as serializeListItems, s as DEFAULT_LIST_STYLE, t as getDynamicLayoutForList } from "./dynamicTemplate-C4UKzQbP.js";
import { n as substituteVariablesAsInlineMarkdownLiterals, r as validateVariables, t as substituteVariables } from "./helper-BChY9FCm.js";
import "./tables.js";
import "./lists.js";
import { DEFAULT_FONT_NAME, ZOOM, b64toUint8Array, getDefaultFont, getFallbackFontName, getInternalLinkTarget, mm2pt, normalizeLinkHref, px2mm } from "@pdfme/common";
import { Buffer as Buffer$1 } from "buffer";
import { toRadians } from "@pdfme/pdf-lib";
import { Barcode, Calendar, CalendarClock, ChevronDown, Circle, CircleDot, Clock, Image, List, Minus, QrCode, Route, Square, SquareCheck, Table, Type } from "lucide";
import DOMPurify from "dompurify";
import bwipjs from "bwip-js";
import AirDatepicker from "air-datepicker";
import * as dateFns from "date-fns/locale";
import { format } from "date-fns";
//#region \0rolldown/runtime.js
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJSMin = (cb, mod) => () => (mod || (cb((mod = { exports: {} }).exports, mod), cb = null), mod.exports);
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
//#endregion
//#region src/multiVariableText/pdfRender.ts
var pdfRender$3 = async (arg) => {
	const { value, schema, ...rest } = arg;
	if (schema.readOnly) {
		await pdfRender$4({
			value,
			schema,
			...rest
		});
		return;
	}
	if (!validateVariables(value, schema)) return;
	await pdfRender$4({
		value: isInlineMarkdownTextSchema(schema) ? substituteVariablesAsInlineMarkdownLiterals(schema.text || "", value) : substituteVariables(schema.text || "", value),
		schema,
		...rest
	});
};
//#endregion
//#region src/multiVariableText/propPanel.ts
var mapDynamicVariables = (props) => {
	const { rootElement, changeSchemas, activeSchema, i18n, options } = props;
	const mvtSchema = activeSchema;
	const text = mvtSchema.text || "";
	let variables = {};
	try {
		const parsed = JSON.parse(mvtSchema.content || "{}");
		if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) variables = parsed;
	} catch {}
	const variablesChanged = updateVariablesFromText(text, variables);
	const varNames = Object.keys(variables);
	if (variablesChanged) changeSchemas([
		{
			key: "content",
			value: JSON.stringify(variables),
			schemaId: activeSchema.id
		},
		{
			key: "variables",
			value: varNames,
			schemaId: activeSchema.id
		},
		{
			key: "readOnly",
			value: varNames.length === 0,
			schemaId: activeSchema.id
		}
	]);
	const placeholderRowEl = document.getElementById("placeholder-dynamic-var")?.closest(".ant-form-item");
	if (!placeholderRowEl) throw new Error("Failed to find Ant form placeholder row to create dynamic variables inputs.");
	placeholderRowEl.style.display = "none";
	rootElement.parentElement.style.display = "block";
	if (varNames.length > 0) for (let variableName of varNames) {
		const varRow = placeholderRowEl.cloneNode(true);
		const textarea = varRow.querySelector("textarea");
		textarea.id = "dynamic-var-" + variableName;
		textarea.value = variables[variableName];
		textarea.addEventListener("change", (e) => {
			if (variableName in variables) {
				variables[variableName] = e.target.value;
				changeSchemas([{
					key: "content",
					value: JSON.stringify(variables),
					schemaId: activeSchema.id
				}]);
			}
		});
		const label = varRow.querySelector("label");
		label.innerText = variableName;
		varRow.style.display = "block";
		rootElement.appendChild(varRow);
	}
	else {
		const para = document.createElement("p");
		const colorValue = options?.theme?.token?.colorPrimary || "#168fe3";
		const safeColorValue = /^#[0-9A-F]{6}$/i.test(colorValue) || /^(rgb|hsl)a?\(\s*([+-]?\d+%?\s*,\s*){2,3}[+-]?\d+%?\s*\)$/i.test(colorValue) ? colorValue : "#168fe3";
		const typingInstructions = i18n("schemas.mvt.typingInstructions");
		const sampleField = i18n("schemas.mvt.sampleField");
		para.appendChild(document.createTextNode(typingInstructions + " "));
		const codeEl = document.createElement("code");
		codeEl.style.color = safeColorValue;
		codeEl.style.fontWeight = "bold";
		codeEl.textContent = `{${sampleField}}`;
		para.appendChild(codeEl);
		rootElement.appendChild(para);
	}
};
var propPanel$2 = {
	schema: (propPanelProps) => {
		if (typeof propPanel$3.schema !== "function") throw new Error("Oops, is text schema no longer a function?");
		const parentSchema = typeof propPanel$3.schema === "function" ? propPanel$3.schema(propPanelProps) : {};
		const i18n = propPanelProps.i18n;
		return {
			...parentSchema,
			"-------": {
				type: "void",
				widget: "Divider"
			},
			dynamicVarContainer: {
				title: i18n("schemas.mvt.variablesSampleData"),
				type: "string",
				widget: "Card",
				span: 24,
				properties: {
					dynamicVariables: {
						type: "object",
						widget: "mapDynamicVariables",
						bind: false,
						span: 24
					},
					placeholderDynamicVar: {
						title: i18n("schemas.mvt.placeholderDynamicVariable"),
						type: "string",
						format: "textarea",
						props: {
							id: "placeholder-dynamic-var",
							autoSize: {
								minRows: 2,
								maxRows: 5
							}
						},
						span: 24
					}
				}
			}
		};
	},
	widgets: {
		...propPanel$3.widgets,
		mapDynamicVariables
	},
	defaultSchema: {
		...propPanel$3.defaultSchema,
		readOnly: false,
		type: "multiVariableText",
		text: "Add text here using {} for variables ",
		width: 50,
		height: 15,
		content: "{}",
		variables: []
	}
};
var updateVariablesFromText = (text, variables) => {
	const matches = getVariableNames(text);
	let changed = false;
	if (matches.length > 0) {
		const uniqueMatches = new Set(matches);
		for (const variableName of uniqueMatches) if (!(variableName in variables)) {
			variables[variableName] = variableName.toUpperCase();
			changed = true;
		}
		Object.keys(variables).forEach((variableName) => {
			if (!uniqueMatches.has(variableName)) {
				delete variables[variableName];
				changed = true;
			}
		});
	} else Object.keys(variables).forEach((variableName) => {
		delete variables[variableName];
		changed = true;
	});
	return changed;
};
//#endregion
//#region src/multiVariableText/uiRender.ts
var uiRender$3 = async (arg) => {
	const { value, schema, rootElement, mode, onChange, ...rest } = arg;
	let text = schema.text;
	let numVariables = schema.variables.length;
	const renderResolvedValue = schema.readOnly === true && mode !== "designer";
	const renderValue = renderResolvedValue ? value : isInlineMarkdownTextSchema(schema) ? substituteVariablesAsInlineMarkdownLiterals(text, value) : substituteVariables(text, value);
	if (mode === "form" && numVariables > 0 && !renderResolvedValue) {
		await formUiRender(arg);
		return;
	}
	await uiRender$4({
		value: isEditable(mode, schema) ? text : renderValue,
		schema,
		mode: mode === "form" ? "viewer" : mode,
		rootElement,
		onChange: (arg) => {
			if (!Array.isArray(arg)) {
				if (onChange) onChange({
					key: "text",
					value: arg.value
				});
			} else throw new Error("onChange is not an array, the parent text plugin has changed...");
		},
		...rest
	});
	const textBlock = rootElement.querySelector("#text-" + String(schema.id));
	if (!textBlock) throw new Error("Text block not found. Ensure the text block has an id of \"text-\" + schema.id");
	if (mode === "designer") textBlock.addEventListener("keyup", (event) => {
		text = textBlock.textContent || "";
		if (keyPressShouldBeChecked(event)) {
			const newNumVariables = countUniqueVariableNames(text);
			if (numVariables !== newNumVariables) {
				if (onChange) onChange({
					key: "text",
					value: text
				});
				numVariables = newNumVariables;
			}
		}
	});
};
var formUiRender = async (arg) => {
	const { value, schema, rootElement, onChange, stopEditing, theme, _cache, options } = arg;
	const rawText = schema.text;
	if (rootElement.parentElement) rootElement.parentElement.style.outline = "";
	let variables = {};
	if (value) try {
		const parsed = JSON.parse(value);
		if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) variables = parsed;
	} catch {}
	const substitutedText = substituteVariables(rawText, variables);
	const inlineMarkdownRuns = isInlineMarkdownTextSchema(schema) ? parseInlineMarkdown(rawText) : void 0;
	const font = options?.font || getDefaultFont();
	const textBlock = buildStyledTextContainer(arg, await getFontKitFont(schema.fontName, font, _cache), inlineMarkdownRuns ? getInlineMarkdownFormDisplayText(inlineMarkdownRuns, variables) : substitutedText);
	if (getTextLineRange(schema)) {
		const { lines } = await measureTextLines({
			value: inlineMarkdownRuns ? substituteVariablesAsInlineMarkdownLiterals(rawText, variables) : substitutedText,
			schema,
			font,
			_cache,
			ignoreDynamicFontSize: true
		});
		renderSplitVariableSpans({
			textBlock,
			lines,
			runs: inlineMarkdownRuns,
			rawText,
			variables,
			schema,
			font,
			theme,
			onChange,
			stopEditing
		});
		return;
	}
	if (inlineMarkdownRuns) {
		renderInlineMarkdownVariableSpans({
			runs: inlineMarkdownRuns,
			variables,
			textBlock,
			schema,
			font,
			theme,
			onChange,
			stopEditing
		});
		return;
	}
	const variableIndices = /* @__PURE__ */ new Map();
	visitVariables(rawText, ({ name, startIndex }) => {
		variableIndices.set(startIndex, name);
	});
	let inVarString = false;
	for (let i = 0; i < rawText.length; i++) {
		const variableName = variableIndices.get(i);
		if (variableName) {
			inVarString = true;
			let span = document.createElement("span");
			span.style.outline = `${theme.colorPrimary} dashed 1px`;
			makeElementPlainTextContentEditable(span);
			span.textContent = variables[variableName];
			span.addEventListener("blur", (e) => {
				const newValue = e.target.textContent || "";
				if (newValue !== variables[variableName]) {
					variables[variableName] = newValue;
					if (onChange) onChange({
						key: "content",
						value: JSON.stringify(variables)
					});
					if (stopEditing) stopEditing();
				}
			});
			textBlock.appendChild(span);
		} else if (inVarString) {
			if (rawText[i] === "}") inVarString = false;
		} else {
			let span = document.createElement("span");
			span.style.letterSpacing = rawText.length === i + 1 ? "0" : "inherit";
			span.textContent = rawText[i];
			textBlock.appendChild(span);
		}
	}
};
var renderSplitVariableSpans = (arg) => {
	const { textBlock, lines, runs, rawText, variables, schema, font, theme, onChange, stopEditing } = arg;
	const lineRange = getTextLineRange(schema);
	const lineSegments = getSplitLineSegments({
		lines,
		runs,
		rawText,
		variables,
		start: lineRange?.start ?? 0,
		end: lineRange?.end ?? lines.length
	});
	textBlock.innerHTML = "";
	lineSegments.forEach((segments, lineIndex) => {
		segments.forEach((segment) => {
			if (segment.variableName) {
				appendRangedVariableSpan({
					textBlock,
					segment,
					variables,
					schema,
					font,
					theme,
					onChange,
					stopEditing
				});
				return;
			}
			const span = segment.run ? createStaticInlineMarkdownElement(segment.run) : document.createElement("span");
			span.style.letterSpacing = lineIndex === lineSegments.length - 1 ? "0" : "inherit";
			span.textContent = segment.text;
			if (segment.run) applyInlineMarkdownStyle({
				element: span,
				run: segment.run,
				schema,
				font
			});
			textBlock.appendChild(span);
		});
		if (lineIndex < lineSegments.length - 1) textBlock.appendChild(document.createElement("br"));
	});
};
var getSplitLineSegments = (arg) => {
	const { lines, runs, rawText, variables, start, end } = arg;
	return consumeMeasuredLineSegments(lines, runs ? buildResolvedInlineMarkdownChars(runs, variables) : buildResolvedPlainChars(rawText, variables), { dropUnmappedTargets: Boolean(runs) }).slice(start, end);
};
var buildResolvedPlainChars = (rawText, variables) => {
	const chars = [];
	let lastIndex = 0;
	visitVariables(rawText, ({ name, startIndex, endIndex }) => {
		appendTextChars(chars, rawText.slice(lastIndex, startIndex));
		const value = variables[name] ?? "";
		for (let i = 0; i < value.length; i += 1) chars.push({
			char: value[i],
			variableName: name,
			variableOffset: i
		});
		lastIndex = endIndex + 1;
	});
	appendTextChars(chars, rawText.slice(lastIndex));
	return chars;
};
var buildResolvedInlineMarkdownChars = (runs, variables) => {
	const chars = [];
	runs.forEach((run) => {
		let lastIndex = 0;
		visitVariables(run.text, ({ name, startIndex, endIndex }) => {
			appendTextChars(chars, run.text.slice(lastIndex, startIndex), run);
			const value = variables[name] ?? "";
			for (let i = 0; i < value.length; i += 1) chars.push({
				char: value[i],
				variableName: name,
				variableOffset: i,
				run
			});
			lastIndex = endIndex + 1;
		});
		appendTextChars(chars, run.text.slice(lastIndex), run);
	});
	return chars;
};
var appendTextChars = (chars, text, run) => {
	for (let i = 0; i < text.length; i += 1) chars.push({
		char: text[i],
		run
	});
};
var consumeMeasuredLineSegments = (lines, resolvedChars, options = {}) => {
	const lineSegments = [];
	let cursor = 0;
	lines.forEach((line) => {
		const segments = [];
		const lineText = stripTrailingLineBreaks(line);
		for (let i = 0; i < lineText.length; i += 1) {
			const target = lineText[i];
			while (cursor < resolvedChars.length && resolvedChars[cursor].char !== target && isWhitespaceChar(resolvedChars[cursor].char) && !isWhitespaceChar(target)) cursor += 1;
			if (cursor >= resolvedChars.length) {
				if (options.dropUnmappedTargets) continue;
				appendSegment(segments, { char: target });
				continue;
			}
			const sourceChar = resolvedChars[cursor];
			if (sourceChar.char === target) {
				appendSegment(segments, sourceChar);
				cursor += 1;
			} else {
				if (options.dropUnmappedTargets) continue;
				appendSegment(segments, { char: target });
			}
		}
		cursor = absorbHiddenTrailingWhitespace(segments, resolvedChars, cursor);
		if (line.endsWith("\r\n") || line.endsWith("\n") || line.endsWith("\r")) {
			if (resolvedChars[cursor]?.char === "\r" && resolvedChars[cursor + 1]?.char === "\n") cursor += 2;
			else if (resolvedChars[cursor]?.char === "\n" || resolvedChars[cursor]?.char === "\r") cursor += 1;
		}
		lineSegments.push(segments);
	});
	return lineSegments;
};
var absorbHiddenTrailingWhitespace = (segments, resolvedChars, cursor) => {
	let nextCursor = cursor;
	while (nextCursor < resolvedChars.length && isHorizontalWhitespaceChar(resolvedChars[nextCursor].char)) {
		const sourceChar = resolvedChars[nextCursor];
		const lastSegment = segments.at(-1);
		if (lastSegment && lastSegment.variableName === sourceChar.variableName && lastSegment.variableEnd === sourceChar.variableOffset && lastSegment.run === sourceChar.run && sourceChar.variableOffset !== void 0) lastSegment.variableEnd = sourceChar.variableOffset + 1;
		nextCursor += 1;
	}
	return nextCursor;
};
var stripTrailingLineBreaks = (value) => {
	let end = value.length;
	while (end > 0) {
		const char = value[end - 1];
		if (char !== "\n" && char !== "\r") break;
		end -= 1;
	}
	return value.slice(0, end);
};
var isWhitespaceChar = (value) => value === " " || value === "	" || value === "\n" || value === "\r" || value === "\f" || value === "\v";
var isHorizontalWhitespaceChar = (value) => value === " " || value === "	" || value === "\f" || value === "\v";
var appendSegment = (segments, sourceChar) => {
	const lastSegment = segments.at(-1);
	if (lastSegment && lastSegment.variableName === sourceChar.variableName && lastSegment.variableEnd === sourceChar.variableOffset && lastSegment.run === sourceChar.run) {
		lastSegment.text += sourceChar.char;
		if (sourceChar.variableOffset !== void 0) lastSegment.variableEnd = sourceChar.variableOffset + 1;
		return;
	}
	segments.push({
		text: sourceChar.char,
		variableName: sourceChar.variableName,
		variableStart: sourceChar.variableOffset,
		variableEnd: sourceChar.variableOffset === void 0 ? void 0 : sourceChar.variableOffset + 1,
		run: sourceChar.run
	});
};
var appendRangedVariableSpan = (arg) => {
	const { textBlock, segment, variables, schema, font, theme, onChange, stopEditing } = arg;
	if (!segment.variableName) return;
	const span = document.createElement("span");
	span.style.outline = `${theme.colorPrimary} dashed 1px`;
	if (segment.run) applyInlineMarkdownStyle({
		element: span,
		run: segment.run,
		schema,
		font
	});
	makeElementPlainTextContentEditable(span);
	span.textContent = segment.text;
	span.addEventListener("blur", (e) => {
		const variableName = segment.variableName;
		if (!variableName) return;
		const newValue = e.target.textContent || "";
		if (newValue === segment.text) return;
		const currentValue = variables[variableName] ?? "";
		const start = Math.min(segment.variableStart ?? 0, currentValue.length);
		const end = Math.min(segment.variableEnd ?? currentValue.length, currentValue.length);
		variables[variableName] = currentValue.slice(0, start) + newValue + currentValue.slice(end);
		if (onChange) onChange({
			key: "content",
			value: JSON.stringify(variables)
		});
		if (stopEditing) stopEditing();
	});
	textBlock.appendChild(span);
};
var getInlineMarkdownFormDisplayText = (runs, variables) => runs.map((run) => substituteVariables(run.text, variables)).join("");
var applyInlineMarkdownStyle = (arg) => {
	const { element, run, schema, font } = arg;
	const resolvedFont = resolveFontVariant(run, schema, font);
	if (resolvedFont.fontName) element.style.fontFamily = `'${resolvedFont.fontName}'`;
	if (resolvedFont.syntheticBold) {
		element.style.fontWeight = "800";
		element.style.textShadow = SYNTHETIC_BOLD_CSS_TEXT_SHADOW;
	}
	if (resolvedFont.syntheticItalic) element.style.fontStyle = "italic";
	const textDecorations = [];
	if (run.href) textDecorations.push("underline");
	if (run.strikethrough) textDecorations.push("line-through");
	if (textDecorations.length > 0) element.style.textDecoration = textDecorations.join(" ");
	if (run.code) {
		element.style.backgroundColor = CODE_BACKGROUND_COLOR;
		element.style.borderRadius = "2px";
		element.style.padding = "0 0.15em";
		if (!schema.fontVariants?.code || !font[schema.fontVariants.code]) element.style.fontFamily = resolvedFont.fontName ? `'${resolvedFont.fontName}', monospace` : "monospace";
	}
};
var createStaticInlineMarkdownElement = (run) => {
	const href = run.href ? normalizeLinkHref(run.href) : void 0;
	if (!href) return document.createElement("span");
	const anchor = document.createElement("a");
	anchor.href = href;
	if (!getInternalLinkTarget(href)) {
		anchor.target = "_blank";
		anchor.rel = "noopener noreferrer";
	}
	return anchor;
};
var appendTextSpan = (arg) => {
	const { textBlock, text, run, schema, font } = arg;
	if (!text) return;
	const span = createStaticInlineMarkdownElement(run);
	span.textContent = text;
	applyInlineMarkdownStyle({
		element: span,
		run,
		schema,
		font
	});
	textBlock.appendChild(span);
};
var appendVariableSpan = (arg) => {
	const { textBlock, variableName, variables, run, schema, font, theme, onChange, stopEditing } = arg;
	const span = document.createElement("span");
	span.style.outline = `${theme.colorPrimary} dashed 1px`;
	applyInlineMarkdownStyle({
		element: span,
		run,
		schema,
		font
	});
	makeElementPlainTextContentEditable(span);
	span.textContent = variables[variableName] ?? "";
	span.addEventListener("blur", (e) => {
		const newValue = e.target.textContent || "";
		if (newValue !== variables[variableName]) {
			variables[variableName] = newValue;
			if (onChange) onChange({
				key: "content",
				value: JSON.stringify(variables)
			});
			if (stopEditing) stopEditing();
		}
	});
	textBlock.appendChild(span);
};
var renderInlineMarkdownVariableSpans = (arg) => {
	const { runs, variables, textBlock, schema, font, theme, onChange, stopEditing } = arg;
	textBlock.innerHTML = "";
	runs.forEach((run) => {
		let lastIndex = 0;
		visitVariables(run.text, ({ name, startIndex, endIndex }) => {
			appendTextSpan({
				textBlock,
				text: run.text.slice(lastIndex, startIndex),
				run,
				schema,
				font
			});
			appendVariableSpan({
				textBlock,
				variableName: name,
				variables,
				run,
				schema,
				font,
				theme,
				onChange,
				stopEditing
			});
			lastIndex = endIndex + 1;
		});
		appendTextSpan({
			textBlock,
			text: run.text.slice(lastIndex),
			run,
			schema,
			font
		});
	});
};
/**
* An optimisation to try to minimise jank while typing.
* Only check whether variables were modified based on certain key presses.
* Regex would otherwise be performed on every key press (which isn't terrible, but this code helps).
*/
var keyPressShouldBeChecked = (event) => {
	if (event.key === "ArrowUp" || event.key === "ArrowDown" || event.key === "ArrowLeft" || event.key === "ArrowRight") return false;
	const selection = window.getSelection();
	const contenteditable = event.target;
	if (selection?.focusOffset === contenteditable?.textContent?.length) return event.key === "}" || event.key === "Backspace" || event.key === "Delete";
	if (selection?.anchorOffset === 0) return event.key === "{" || event.key === "Backspace" || event.key === "Delete";
	return true;
};
//#endregion
//#region src/multiVariableText/index.ts
var schema$1 = {
	pdf: pdfRender$3,
	ui: uiRender$3,
	propPanel: propPanel$2,
	icon: createSvgStr(Type),
	uninterruptedEditMode: true
};
//#endregion
//#region src/shapes/rectAndEllipse.ts
var shape = {
	ui: (arg) => {
		const { schema, rootElement } = arg;
		const div = document.createElement("div");
		div.style.width = "100%";
		div.style.height = "100%";
		div.style.boxSizing = "border-box";
		if (schema.type === "ellipse") div.style.borderRadius = "50%";
		else if (schema.radius && schema.radius > 0) div.style.borderRadius = `${schema.radius}mm`;
		div.style.borderWidth = `${schema.borderWidth ?? 0}mm`;
		div.style.borderStyle = schema.borderWidth && schema.borderColor ? "solid" : "none";
		div.style.borderColor = schema.borderColor ?? "transparent";
		div.style.backgroundColor = schema.color ?? "transparent";
		rootElement.appendChild(div);
	},
	pdf: (arg) => {
		const { schema, page, options } = arg;
		if (!schema.color && !schema.borderColor) return;
		const { colorType } = options;
		const cArg = {
			schema,
			pageHeight: page.getHeight()
		};
		const { position, width, height, rotate, opacity } = convertForPdfLayoutProps(cArg);
		const { position: { x: x4Ellipse, y: y4Ellipse } } = convertForPdfLayoutProps({
			...cArg,
			applyRotateTranslate: false
		});
		const borderWidth = schema.borderWidth ? mm2pt(schema.borderWidth) : 0;
		const drawOptions = {
			rotate,
			borderWidth,
			borderColor: hex2PrintingColor(schema.borderColor, colorType),
			color: hex2PrintingColor(schema.color, colorType),
			opacity,
			borderOpacity: opacity
		};
		if (schema.type === "ellipse") page.drawEllipse({
			x: x4Ellipse + width / 2,
			y: y4Ellipse + height / 2,
			xScale: width / 2 - borderWidth / 2,
			yScale: height / 2 - borderWidth / 2,
			...drawOptions
		});
		else if (schema.type === "rectangle") {
			const radius = schema.radius ?? 0;
			page.drawRectangle({
				x: position.x + borderWidth * ((1 - Math.sin(toRadians(rotate))) / 2) + Math.tan(toRadians(rotate)) * Math.PI ** 2,
				y: position.y + borderWidth * ((1 + Math.sin(toRadians(rotate))) / 2) + Math.tan(toRadians(rotate)) * Math.PI ** 2,
				width: width - borderWidth,
				height: height - borderWidth,
				...radius ? { radius: mm2pt(radius) } : {},
				...drawOptions
			});
		}
	},
	propPanel: {
		schema: ({ i18n }) => ({
			borderWidth: {
				title: i18n("schemas.borderWidth"),
				type: "number",
				widget: "inputNumber",
				props: {
					min: 0,
					step: 1
				},
				span: 12
			},
			borderColor: {
				title: i18n("schemas.borderColor"),
				type: "string",
				widget: "color",
				props: { disabledAlpha: true },
				rules: [{
					pattern: HEX_COLOR_PATTERN,
					message: i18n("validation.hexColor")
				}],
				span: 12
			},
			color: {
				title: i18n("schemas.color"),
				type: "string",
				widget: "color",
				props: { disabledAlpha: true },
				rules: [{
					pattern: HEX_COLOR_PATTERN,
					message: i18n("validation.hexColor")
				}]
			},
			radius: {
				title: i18n("schemas.radius"),
				type: "number",
				widget: "inputNumber",
				props: {
					min: 0,
					step: 1
				},
				span: 12
			}
		}),
		defaultSchema: {
			name: "",
			type: "rectangle",
			position: {
				x: 0,
				y: 0
			},
			width: 62.5,
			height: 37.5,
			rotate: 0,
			opacity: 1,
			borderWidth: 1,
			borderColor: "#000000",
			color: "",
			readOnly: true,
			radius: 0
		}
	}
};
var getPropPanelSchema = (type) => ({
	...shape.propPanel,
	defaultSchema: {
		...shape.propPanel.defaultSchema,
		type
	}
});
var rectangle = {
	...shape,
	propPanel: getPropPanelSchema("rectangle"),
	icon: createSvgStr(Square)
};
var ellipse = {
	...shape,
	propPanel: getPropPanelSchema("ellipse"),
	icon: createSvgStr(Circle)
};
//#endregion
//#region src/list/pdfRender.ts
var rectanglePdfRender$2 = rectangle.pdf;
var pdfRender$2 = async (arg) => {
	const { schema, value } = arg;
	const items = normalizeListItems(value);
	const range = getListItemRange(schema) ?? {
		start: 0,
		end: items.length
	};
	const visibleItems = items.slice(range.start, range.end);
	if (visibleItems.length === 0) return;
	const layout = await calculateListLayout({
		schema,
		items: visibleItems,
		markerItems: items,
		startIndex: range.start,
		options: arg.options,
		_cache: arg._cache
	});
	if (schema.backgroundColor) await rectanglePdfRender$2({
		...arg,
		schema: {
			...schema,
			type: "rectangle",
			borderWidth: 0,
			borderColor: "",
			color: schema.backgroundColor
		}
	});
	let y = schema.position.y;
	for (const item of layout.items) {
		await pdfRender$4({
			...arg,
			value: item.marker,
			schema: {
				...schema,
				type: "text",
				position: {
					x: schema.position.x + item.markerX,
					y
				},
				width: layout.markerWidth,
				height: item.height,
				backgroundColor: "",
				alignment: "right",
				verticalAlignment: "top",
				dynamicFontSize: void 0
			}
		});
		await pdfRender$4({
			...arg,
			value: item.item,
			schema: {
				...schema,
				type: "text",
				position: {
					x: schema.position.x + item.bodyX,
					y
				},
				width: item.bodyWidth,
				height: item.height,
				backgroundColor: "",
				verticalAlignment: "top",
				dynamicFontSize: void 0
			}
		});
		y += item.height;
	}
};
//#endregion
//#region src/list/propPanel.ts
var propPanel$1 = {
	schema: (propPanelProps) => {
		if (typeof propPanel$3.schema !== "function") throw new Error("Oops, is text schema no longer a function?");
		const parentSchema = propPanel$3.schema(propPanelProps);
		const i18n = propPanelProps.i18n;
		const listSchema = { ...parentSchema };
		delete listSchema.useDynamicFontSize;
		delete listSchema.dynamicFontSize;
		return {
			...listSchema,
			"-------": {
				type: "void",
				widget: "Divider"
			},
			listStyle: {
				title: i18n("schemas.list.listStyle"),
				type: "string",
				widget: "select",
				props: { options: [{
					label: i18n("schemas.list.bullet"),
					value: LIST_STYLE_BULLET
				}, {
					label: i18n("schemas.list.ordered"),
					value: LIST_STYLE_ORDERED
				}] },
				span: 24
			},
			markerWidth: {
				title: i18n("schemas.list.markerWidth"),
				type: "number",
				widget: "inputNumber",
				props: { min: 0 },
				span: 6
			},
			markerGap: {
				title: i18n("schemas.list.markerGap"),
				type: "number",
				widget: "inputNumber",
				props: { min: 0 },
				span: 6
			},
			indentSize: {
				title: i18n("schemas.list.indentSize"),
				type: "number",
				widget: "inputNumber",
				props: { min: 0 },
				span: 6
			},
			itemSpacing: {
				title: i18n("schemas.list.itemSpacing"),
				type: "number",
				widget: "inputNumber",
				props: { min: 0 },
				span: 6
			}
		};
	},
	widgets: propPanel$3.widgets,
	defaultSchema: {
		...propPanel$3.defaultSchema,
		type: "list",
		content: JSON.stringify(["First item", "Second item"]),
		width: 80,
		height: 20,
		listStyle: DEFAULT_LIST_STYLE,
		markerWidth: 6,
		markerGap: 2,
		indentSize: 6,
		itemSpacing: 1,
		dynamicFontSize: void 0,
		verticalAlignment: "top"
	}
};
//#endregion
//#region src/list/uiRender.ts
var focusDataKey = "pdfmeListFocusIndex";
var actionDataKey = "pdfmeListAction";
var internalFocusDataKey = "pdfmeListInternalFocus";
var caretMarker = "​";
var pendingFocusIndexes = /* @__PURE__ */ new Map();
var getListFocusKey = (schema) => schema.id || schema.name;
var isComposingKeyboardEvent = (event) => event.isComposing || event.keyCode === 229;
var getText = (element) => {
	const rawText = element.innerText;
	const hasCaretMarker = rawText.includes(caretMarker);
	let text = rawText.replace(/\u200B/g, "");
	if (!hasCaretMarker && text.endsWith("\n")) text = text.slice(0, -1);
	return text;
};
var setStyles = (element, styles) => {
	Object.assign(element.style, styles);
};
var focusBody = (body) => {
	body.focus();
	const selection = window.getSelection();
	const range = document.createRange();
	if (selection && range) {
		range.selectNodeContents(body);
		range.collapse(false);
		selection.removeAllRanges();
		selection.addRange(range);
	}
};
var getCaretRangeFromPoint = (x, y) => {
	const documentWithCaret = document;
	if (documentWithCaret.caretRangeFromPoint) return documentWithCaret.caretRangeFromPoint(x, y);
	const caretPosition = documentWithCaret.caretPositionFromPoint?.(x, y);
	if (!caretPosition) return null;
	const range = document.createRange();
	range.setStart(caretPosition.offsetNode, caretPosition.offset);
	range.collapse(true);
	return range;
};
var focusBodyFromMouseEvent = (body, event) => {
	body.focus();
	const range = getCaretRangeFromPoint(event.clientX, event.clientY);
	if (!range || !body.contains(range.startContainer)) return;
	const selection = window.getSelection();
	if (!selection) return;
	selection.removeAllRanges();
	selection.addRange(range);
};
var getBodyEditor = (body) => body.querySelector("[contenteditable], [tabindex]");
var insertLineBreakAtSelection = (element) => {
	const fallbackText = getText(element);
	const selection = window.getSelection();
	if (!selection?.rangeCount) {
		element.innerText = `${fallbackText}\n${caretMarker}`;
		focusBody(element);
		return true;
	}
	const range = selection.getRangeAt(0);
	if (!element.contains(range.commonAncestorContainer)) {
		element.innerText = `${fallbackText}\n${caretMarker}`;
		focusBody(element);
		return true;
	}
	selection.deleteFromDocument();
	const fragment = document.createDocumentFragment();
	const lineBreak = document.createElement("br");
	const marker = document.createTextNode(caretMarker);
	fragment.append(lineBreak, marker);
	range.insertNode(fragment);
	range.setStart(marker, marker.length);
	range.collapse(true);
	selection.removeAllRanges();
	selection.addRange(range);
	if (!element.innerText.includes(caretMarker)) {
		element.innerText = `${fallbackText}\n${caretMarker}`;
		focusBody(element);
	}
	return true;
};
var createActionButton = (arg) => {
	const button = document.createElement("button");
	button.type = "button";
	button.innerText = arg.label;
	button.setAttribute("aria-label", arg.ariaLabel);
	button.disabled = Boolean(arg.disabled);
	setStyles(button, {
		width: "18px",
		height: "18px",
		display: "inline-flex",
		alignItems: "center",
		justifyContent: "center",
		padding: "0",
		border: "1px solid #d9d9d9",
		borderRadius: "3px",
		background: "#ffffff",
		color: "#333333",
		fontSize: "11px",
		lineHeight: "1",
		cursor: arg.disabled ? "not-allowed" : "pointer",
		opacity: arg.disabled ? .45 : 1
	});
	button.addEventListener("pointerdown", (event) => {
		arg.onPressStart?.();
		event.stopPropagation();
	});
	button.addEventListener("mousedown", (event) => {
		arg.onPressStart?.();
		event.preventDefault();
		event.stopPropagation();
	});
	button.addEventListener("click", (event) => {
		event.preventDefault();
		event.stopPropagation();
		if (!arg.disabled) arg.onClick();
	});
	return button;
};
var uiRender$2 = async (arg) => {
	const { rootElement, schema, value, mode, onChange, stopEditing, tabIndex, placeholder } = arg;
	const focusKey = getListFocusKey(schema);
	const editable = isEditable(mode, schema);
	const showControls = editable && (mode === "form" || mode === "designer");
	const usePlaceholder = editable && !value && Boolean(placeholder);
	const items = normalizeListItems(usePlaceholder ? placeholder || "" : value);
	const originalItems = normalizeListItemEntries(value);
	const range = getListItemRange(schema) ?? {
		start: 0,
		end: items.length
	};
	const visibleItems = items.slice(range.start, range.end);
	const renderItems = visibleItems;
	rootElement.innerHTML = "";
	setStyles(rootElement, {
		position: "relative",
		width: "100%",
		height: "100%",
		backgroundColor: schema.backgroundColor || "transparent",
		overflow: "visible"
	});
	const layout = await calculateListLayout({
		schema,
		items: renderItems,
		markerItems: items,
		startIndex: range.start,
		options: arg.options,
		_cache: arg._cache
	});
	const bodyElements = [];
	const getEditedItems = () => layout.items.map((item, index) => ({
		level: item.level,
		text: getText(bodyElements[index])
	}));
	const getNextItems = () => {
		const editedItems = getEditedItems();
		if (usePlaceholder) return editedItems;
		const nextItems = [...originalItems];
		nextItems.splice(range.start, visibleItems.length, ...editedItems);
		return nextItems;
	};
	const commitItems = (nextItems, focusIndex) => {
		if (!onChange) return;
		if (focusIndex !== void 0) {
			rootElement.dataset[focusDataKey] = String(focusIndex);
			pendingFocusIndexes.set(focusKey, focusIndex);
		}
		onChange({
			key: "content",
			value: serializeListItems(nextItems)
		});
	};
	const commitHeight = async (focusIndex) => {
		if (!onChange) return;
		if (focusIndex !== void 0) {
			rootElement.dataset[focusDataKey] = String(focusIndex);
			pendingFocusIndexes.set(focusKey, focusIndex);
		}
		const rawItems = normalizeListItems(serializeListItems(getNextItems()));
		const nextLayout = await calculateListLayout({
			schema,
			items: rawItems.slice(range.start, range.end),
			markerItems: rawItems,
			startIndex: range.start,
			options: arg.options,
			_cache: arg._cache
		});
		if (schema.height !== nextLayout.totalHeight) onChange({
			key: "height",
			value: nextLayout.totalHeight
		});
	};
	const preserveEditingForAction = () => {
		rootElement.dataset[actionDataKey] = "true";
	};
	const updateItems = (rowIndex, mutate) => {
		const nextItems = getNextItems();
		if (nextItems.length === 0) nextItems.push({
			level: 0,
			text: ""
		});
		const focusIndex = mutate(nextItems, Math.min(Math.max(range.start + rowIndex, 0), nextItems.length - 1));
		preserveEditingForAction();
		commitItems(nextItems, focusIndex);
	};
	const preserveEditingForInternalFocus = () => {
		rootElement.dataset[internalFocusDataKey] = "true";
	};
	const preserveEditingForKeyboardCommit = () => {
		preserveEditingForInternalFocus();
		setTimeout(() => {
			if (rootElement.dataset[internalFocusDataKey] === "true") delete rootElement.dataset[internalFocusDataKey];
		});
	};
	const handleInternalFocusPointer = (event) => {
		preserveEditingForInternalFocus();
		event.stopPropagation();
	};
	const handleBodyMouseDown = (body, event) => {
		handleInternalFocusPointer(event);
		focusBodyFromMouseEvent(body, event);
	};
	const appendEmptyListControls = () => {
		const controls = document.createElement("div");
		controls.addEventListener("pointerdown", preserveEditingForAction);
		controls.addEventListener("mousedown", preserveEditingForAction);
		setStyles(controls, {
			position: "absolute",
			top: "0mm",
			right: "-20px",
			display: "flex",
			gap: "2px"
		});
		controls.appendChild(createActionButton({
			label: "+",
			ariaLabel: arg.i18n("schemas.list.addItem"),
			onPressStart: preserveEditingForAction,
			onClick: () => {
				const nextItems = [...originalItems];
				nextItems.splice(range.start, 0, {
					level: 0,
					text: ""
				});
				commitItems(nextItems, range.start);
			}
		}));
		rootElement.appendChild(controls);
	};
	let offsetY = 0;
	for (let index = 0; index < layout.items.length; index += 1) {
		const item = layout.items[index];
		const row = document.createElement("div");
		setStyles(row, {
			position: "absolute",
			top: `${offsetY}mm`,
			left: "0mm",
			width: `${schema.width}mm`,
			height: `${item.height}mm`
		});
		const marker = document.createElement("div");
		setStyles(marker, {
			position: "absolute",
			top: "0mm",
			left: `${item.markerX}mm`,
			width: `${layout.markerWidth}mm`,
			height: "100%",
			backgroundColor: "transparent",
			cursor: "default"
		});
		const body = document.createElement("div");
		setStyles(body, {
			position: "absolute",
			top: "0mm",
			left: `${item.bodyX}mm`,
			width: `${item.bodyWidth}mm`,
			height: `${item.height}mm`,
			backgroundColor: "transparent",
			cursor: editable ? "text" : "default"
		});
		const schemaForUI = schema;
		const textSchema = {
			...schema,
			id: `${schemaForUI.id || schema.name}-list-item-${item.itemIndex}`,
			name: `${schema.name}-list-item-${item.itemIndex}`,
			type: "text",
			content: item.item,
			position: {
				x: 0,
				y: 0
			},
			width: item.bodyWidth,
			height: item.height,
			alignment: schema.alignment ?? "left",
			fontSize: schema.fontSize ?? 13,
			lineHeight: schema.lineHeight ?? 1,
			characterSpacing: schema.characterSpacing ?? 0,
			fontColor: usePlaceholder ? PLACEHOLDER_FONT_COLOR : schema.fontColor || "#000000",
			backgroundColor: ""
		};
		const markerTextSchema = {
			...textSchema,
			id: `${schemaForUI.id || schema.name}-list-marker-${item.itemIndex}`,
			name: `${schema.name}-list-marker-${item.itemIndex}`,
			content: item.marker,
			width: layout.markerWidth,
			height: item.height,
			alignment: "right",
			fontColor: schema.fontColor || "#000000"
		};
		await uiRender$4({
			...arg,
			rootElement: marker,
			schema: markerTextSchema,
			value: item.marker,
			mode: "viewer",
			placeholder: "",
			onChange: void 0,
			stopEditing: void 0
		});
		await uiRender$4({
			...arg,
			rootElement: body,
			schema: textSchema,
			value: item.item,
			placeholder: "",
			onChange: void 0,
			stopEditing: void 0
		});
		if (editable) {
			const editor = getBodyEditor(body);
			if (!editor) throw new Error("Unable to find list item text editor");
			editor.tabIndex = tabIndex || 0;
			body.addEventListener("pointerdown", handleInternalFocusPointer);
			body.addEventListener("mousedown", (event) => {
				handleBodyMouseDown(editor, event);
			});
			body.addEventListener("click", (event) => {
				event.stopPropagation();
				focusBodyFromMouseEvent(editor, event);
			});
			editor.addEventListener("focus", () => {
				if (usePlaceholder) {
					editor.innerText = "";
					editor.style.color = schema.fontColor || "#000000";
				}
			});
			body.addEventListener("blur", (event) => {
				const isListAction = rootElement.dataset[actionDataKey] === "true";
				const relatedTarget = event.relatedTarget;
				const isInternalFocus = rootElement.dataset[internalFocusDataKey] === "true" || relatedTarget instanceof Node && rootElement.contains(relatedTarget);
				delete rootElement.dataset[internalFocusDataKey];
				if (isListAction || isInternalFocus) return;
				if (!onChange) return;
				commitItems(getNextItems());
				if (stopEditing) stopEditing();
			}, true);
			editor.addEventListener("keydown", (event) => {
				if (event.key === "Enter") {
					if (isComposingKeyboardEvent(event)) return;
					event.preventDefault();
					if (insertLineBreakAtSelection(editor)) {
						preserveEditingForKeyboardCommit();
						if (mode === "form") commitHeight(range.start + index);
						else commitItems(getNextItems(), range.start + index);
					}
				} else if (event.key === "Tab") {
					event.preventDefault();
					updateItems(index, (nextItems, itemIndex) => {
						const itemToUpdate = nextItems[itemIndex];
						itemToUpdate.level = event.shiftKey ? Math.max(itemToUpdate.level - 1, 0) : Math.min(itemToUpdate.level + 1, 8);
						return itemIndex;
					});
				} else if (event.key === "Backspace" && getText(editor) === "") {
					event.preventDefault();
					updateItems(index, (nextItems, itemIndex) => {
						if (nextItems.length <= 1) {
							nextItems.splice(0);
							return;
						}
						nextItems.splice(itemIndex, 1);
						return Math.min(itemIndex, nextItems.length - 1);
					});
				}
			});
			bodyElements.push(editor);
		}
		row.appendChild(marker);
		row.appendChild(body);
		if (showControls) {
			const controls = document.createElement("div");
			controls.addEventListener("pointerdown", preserveEditingForAction);
			controls.addEventListener("mousedown", preserveEditingForAction);
			setStyles(controls, {
				position: "absolute",
				top: "0mm",
				right: "-82px",
				display: "flex",
				gap: "2px"
			});
			controls.appendChild(createActionButton({
				label: "+",
				ariaLabel: arg.i18n("schemas.list.addItem"),
				onPressStart: preserveEditingForAction,
				onClick: () => {
					updateItems(index, (nextItems, itemIndex) => {
						nextItems.splice(itemIndex + 1, 0, {
							level: nextItems[itemIndex]?.level ?? 0,
							text: ""
						});
						return itemIndex + 1;
					});
				}
			}));
			controls.appendChild(createActionButton({
				label: "-",
				ariaLabel: arg.i18n("schemas.list.removeItem"),
				onPressStart: preserveEditingForAction,
				onClick: () => {
					updateItems(index, (nextItems, itemIndex) => {
						if (nextItems.length <= 1) {
							nextItems.splice(0);
							return;
						}
						nextItems.splice(itemIndex, 1);
						return Math.min(itemIndex, nextItems.length - 1);
					});
				}
			}));
			controls.appendChild(createActionButton({
				label: "<",
				ariaLabel: arg.i18n("schemas.list.outdentItem"),
				disabled: item.level === 0,
				onPressStart: preserveEditingForAction,
				onClick: () => {
					updateItems(index, (nextItems, itemIndex) => {
						nextItems[itemIndex].level = Math.max(nextItems[itemIndex].level - 1, 0);
						return itemIndex;
					});
				}
			}));
			controls.appendChild(createActionButton({
				label: ">",
				ariaLabel: arg.i18n("schemas.list.indentItem"),
				disabled: item.level >= 8,
				onPressStart: preserveEditingForAction,
				onClick: () => {
					updateItems(index, (nextItems, itemIndex) => {
						nextItems[itemIndex].level = Math.min(nextItems[itemIndex].level + 1, 8);
						return itemIndex;
					});
				}
			}));
			row.appendChild(controls);
		}
		rootElement.appendChild(row);
		offsetY += item.height;
	}
	if (showControls && visibleItems.length === 0) appendEmptyListControls();
	const pendingFocusIndex = pendingFocusIndexes.get(focusKey);
	if (pendingFocusIndex !== void 0) pendingFocusIndexes.delete(focusKey);
	const requestedFocusIndex = Number(rootElement.dataset[focusDataKey] ?? pendingFocusIndex);
	delete rootElement.dataset[focusDataKey];
	delete rootElement.dataset[actionDataKey];
	delete rootElement.dataset[internalFocusDataKey];
	const relativeFocusIndex = requestedFocusIndex - range.start;
	if (editable && Number.isFinite(requestedFocusIndex) && bodyElements[relativeFocusIndex]) setTimeout(() => focusBody(bodyElements[relativeFocusIndex]));
	else if (editable && mode === "designer" && bodyElements[0]) setTimeout(() => {
		if (!rootElement.contains(document.activeElement)) focusBody(bodyElements[0]);
	});
	if (schema.height !== layout.totalHeight && onChange) onChange({
		key: "height",
		value: layout.totalHeight
	});
};
//#endregion
//#region src/list/index.ts
var listSchema = {
	pdf: pdfRender$2,
	ui: uiRender$2,
	propPanel: propPanel$1,
	icon: createSvgStr(List)
};
//#endregion
//#region src/graphics/imagehelper.ts
var decoder = new TextDecoder();
var toUTF8String = (input, start = 0, end = input.length) => decoder.decode(input.slice(start, end));
var toHexString = (input, start = 0, end = input.length) => input.slice(start, end).reduce((memo, i) => memo + ("0" + i.toString(16)).slice(-2), "");
var readUInt16BE = (input, offset = 0) => input[offset] * 2 ** 8 + input[offset + 1];
var readUInt32BE = (input, offset = 0) => input[offset] * 2 ** 24 + input[offset + 1] * 2 ** 16 + input[offset + 2] * 2 ** 8 + input[offset + 3];
var extractSize = (input, index) => {
	return {
		height: readUInt16BE(input, index),
		width: readUInt16BE(input, index + 2)
	};
};
var validateInput = (input, index) => {
	if (index > input.length) throw new TypeError("Corrupt JPG, exceeded buffer limits");
	if (input[index] !== 255) throw new TypeError("Invalid JPG, marker table corrupted");
};
var JPG = {
	validate: (input) => toHexString(input, 0, 2) === "ffd8",
	calculate(input) {
		input = input.slice(4);
		let next;
		while (input.length) {
			const i = readUInt16BE(input, 0);
			validateInput(input, i);
			next = input[i + 1];
			if (next === 192 || next === 193 || next === 194) return extractSize(input, i + 5);
			input = input.slice(i + 2);
		}
		throw new TypeError("Invalid JPG, no size found");
	}
};
var pngSignature = "PNG\r\n\n";
var pngImageHeaderChunkName = "IHDR";
var pngFriedChunkName = "CgBI";
var typeHandlers = {
	jpg: JPG,
	png: {
		validate(input) {
			if (pngSignature === toUTF8String(input, 1, 8)) {
				let chunkName = toUTF8String(input, 12, 16);
				if (chunkName === pngFriedChunkName) chunkName = toUTF8String(input, 28, 32);
				if (chunkName !== pngImageHeaderChunkName) throw new TypeError("Invalid PNG");
				return true;
			}
			return false;
		},
		calculate(input) {
			if (toUTF8String(input, 12, 16) === pngFriedChunkName) return {
				height: readUInt32BE(input, 36),
				width: readUInt32BE(input, 32)
			};
			return {
				height: readUInt32BE(input, 20),
				width: readUInt32BE(input, 16)
			};
		}
	}
};
function detector(input) {
	const firstBytes = {
		137: "png",
		255: "jpg"
	};
	const byte = input[0];
	if (byte in firstBytes) {
		const type = firstBytes[byte];
		if (type && typeHandlers[type].validate(input)) return type;
	}
	return Object.keys(typeHandlers).find((key) => typeHandlers[key].validate(input));
}
var getImageDimension = (value) => {
	const idx = value.indexOf(";base64,");
	const imgBase64 = value.substring(idx + 8, value.length);
	return imageSize(Buffer$1.from(imgBase64, "base64"));
};
var imageSize = (imgBuffer) => {
	const type = detector(imgBuffer);
	if (typeof type !== "undefined" && type in typeHandlers) {
		const size = typeHandlers[type].calculate(imgBuffer);
		if (size !== void 0) return size;
	}
	throw new TypeError("[@pdfme/schemas/images] Unsupported file type: " + (type === void 0 ? "undefined" : type));
};
//#endregion
//#region src/graphics/image.ts
/**
* Build a short fingerprint for a potentially-large base64 image string.
* Previously `${schema.type}${input}` was used, pinning multi-MB base64
* strings in the cache Map forever — every unique image input created a
* permanent Map key whose byte length matched the image itself.
*
* The fingerprint is an FNV-1a 32-bit hash over the full input, combined
* with the schema type and input byte length. An earlier revision sampled
* three 16-char regions (first + middle + last) instead of hashing, but
* the first-16 slice is a constant data-URI prefix for any image of the
* same MIME type (`data:image/png;b…` / `data:image/jpeg…`), contributing
* no entropy. Hashing every byte removes that weakness at the same O(n)
* cost, without retaining any slice of the input as a Map key. Keys stay
* well under ~40 chars regardless of input size.
*/
var getCacheKey = (schema, input) => {
	let hash = 2166136261;
	for (let i = 0; i < input.length; i++) {
		hash ^= input.charCodeAt(i);
		hash = Math.imul(hash, 16777619);
	}
	const hex = (hash >>> 0).toString(16).padStart(8, "0");
	return `${schema.type}:${input.length}:${hex}`;
};
var fullSize$1 = {
	width: "100%",
	height: "100%"
};
var defaultValue = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAUgAAAGQBAMAAAA+V+RCAAAAAXNSR0IArs4c6QAAABtQTFRFAAAAR3BMAAAAAAAAAAAAAAAAAAAAAAAAAAAAqmQqwQAAAAh0Uk5TDQAvVYGtxusE1uR9AAAKg0lEQVR42tTbwU7bQBDG8TWoPeOBPoBbdbhiVMGV0Kr0GChSe0RtRfccEOROnP0eu8ckTMHrjD27/h4Afvo7u4kUxZXbjuboZ+Hx9vrz+6J8eW5rJKPHhYfr46J/JHn0u/DnuHcko/eF71Ub0j6k3P1Rr0jGIHs4bkPah5RbnveHZMBQ6VKHlMqjnpCMAdfUApk8pNx91QeSMex+C2R2IYFwrkcyht6yEsjkIeXutEjG8AtnApldSGBRqJAMk10JZHYhgaZSIBlG+yWQipAGKZ0ipNmr0uUaEmiKLZEMw52tkLqQD7f6PT7iv1uskLqQV06/nQ9ffswhF+oVUhMS07KX7Xz6+8ot5BQhBVLF/Pry0XGKkAKpGp3IRz7pjmQMiSz3TvB8s85I8h2ReuWy6IpkDIws6UI8745I8oMjy10vnnc3JGN4ZPlRnO9OSPIWyL0LcZ93QTIskOXuXPz9eCR5G2R5io09dUEyjJD7c3kJudiQJkiZMtTxSIYZ8mAu/oGLDGmHLL9hfXfRSIYh8g3W18QiyVsh5VdtoYpEMsyQ8uhM4pDk7ZDyeU/jkAw7pHzesygkeUOkPN+LKCTDGsnP3nNcREhz5MHm8Y5AMkyRskvdjiRvi5Qvyst2JCMB8hBru2lFkjdGypty1opkpEDuY21PbUjy1kh5nS/akIwkyL2fWK0pXEtIc6Q83ssWJCMR8nTjNncxIe2Rh/FIRirkW6ytdjEh7ZHvopGMFEj5EWPiYkLaI/djkYyEyDlWu3SakOmRjIRIWkdOnSJkeiQjfyT5ESAZ+SPJjwDJyB9JfgRIRv5I8iNAMvJHkh8BkpE/kvwIkIz8keRHgGTkjyQ/AiQjfyT5ESAZ+SPJjwDJyB9JfgRIRv5I8iNAMjJF6kLi0gSpC4mJMZJ8tkhdSNQmSF3IUNkiGfkiVSHRFCZIVUgsShOkKiRmNkhVSNzYIFUhMbFBqkKGygapCtkUhkhW/JrUAqkJiakRUhMy1EZITcimsEOy4keaNkhFyFBbIRUhF4UZkv61dzfdaRtRGIBHtqFbXQn2RhizDdg1XprYsVk2TlxryYlTo2WP4yLtwaCf3dNGyu3wWkqaczQzizurAGb05M6HPtBcJT+/jtQU8ucDuekZQwaJc8MGkV33AonIloFAWkO+9NxHbi/IfeQDuY987rmP/AuN9pEYR/eQmP7MbeQ25Xx3lpBX3yuXJxETzSN//AxVkIIUpCAFKUhBClKQghSkIAUpSEEKUpCCFKQgBSlIQQpSkIIUpCAFKUhBClKQghSkIAUpSEEKUpCCFKQgmyy+AeRedKi/jKr+LvII3z25uru7uhx7jSL379PlW/3lB+/1v0vhg+B08XXD6edxM0h+ntJm9K2eGJ7FW3xw/88Ht7vw/65L8BpDtvQF/MdVC5wGxQdg5O08eE0hz4v1a3pe9AsI+AwX0QeasYhzE0g/0XKIhBks8dY/eNI6CqzeagYZZtqa7k7VysBjzD4xeG3ZUQNIVs11y3YKvYLXVfMQg3LbHJKbccjrF7FX8BP+MJD8fzCIXEGv4Mp4JGG5MIbEkLSgsk5FUgVjSFyKPoTKhlVrcU0hMYXDjCvTJlQsU5PIJ712rgzzp6dpxi/mJpFr7a+gMt7A5sM4Ornm/5whJH6rDW9PvhnHROQHZzwtmEFi5zqHymY707d/YwU5h8excGW8ubVHsNc3iFxh5VxZiJPAxGifxOm8C5V1sO4Do1MQTudDqKyNc0AQm5zMMSvhDCob5ti4Az4wMYZkQJBAZRMcXeSfpennnlkkN2WIlc1e2wn60dgjM0j8XqsaOSIohpFlmCZYWcyvrCK5w8VQme8OclVWjcjEMhKm805eidx4VpAIomN8L8gsI2E6P3cUuS3f5Kbdas2dcYewhnzOeDoPM36LI+kA8ikuTv34EOgyq4tkdFqm1Dg0hzwvdyjlW9uoLpL7i7wsy5ExZJun89lXzn4d8gYuD5hAdsoNlhWvwhpkmMHlARPIICsRnSKmdcgupOEzgqRZ+dWi4adBDbIN1zDMIIflBidFHXWRHFpCtop/+HExYwYOIovArYOM36icJ1t2kOXOcHNU1FgbyY4dZHlYsb0vRmxtJP3YChIfCR5kNUdBg8wKUm/CNUEkNaR/+vvjY2IayRXy69ojc6VUOcZH5pAU6y0Y7iCx6l8sICd6DUFWf7bIB8wmkS39jCwEJESS3zOGDLWjL45k5RWMoQVkkGhXCUJAwjVrHkxmkAWkpEAkJ+WW8LeeF6PIIVcAkYTrk9xP12QS2eWpnDcAV3pBsDKJ5CqfCCJ5gHV3IbgmkH5cVgeRrPn1IZ8bRPJw3Y4gkry5Z2/3F/GpWWS7nFMwkhTv3Bvi3/DWjCJDHgkcSfht8c2/xl9572QWGSRlt8NI8gni8jKK+tcZ753MImnIX+dI4i8SaZrmvG3TyE7GoeFI4hkDbMwkks6yfDkiiCR3SihrMo70+yeHBJHkL2L5ZB5Jvk8EkYT2hm2ZQnLBSOL1fh7bTSL//N/IIEHjdtT4XX+MnFduYOPV3fX3QI0gA/3+yVblA/j8BI7NbjBDfzNImmmXZ8PqVptBpwsTuMezIWRL23YQV+5/j3GHcpBoxrfUAJJZHLpB5a2aQYIN2r/nzWzeNnmf+SJNWRVcp+lnj14rR4t0uduge+/SvJH7zPGe+4i4+P3KexSik0McT9Hpu7s/7q7GnttrH3ylPFlFIkhBClKQghSkIAUpSEEKUpCCFKQgBSlIQQpSkIIUpCAFKUhBClKQghSkIAUpSEEKUpCCFKQgbSO7cPO35YKpKN5ryNxN5FR13ETm1cipK0hdpTTze1eQeifUkXNXkG0dubsY337B1HI68osryImO9BNct2W/zLSsFcqPIT+a/bKDUhp623Nwr7gmRecwmzs2l69I6dlxfrPuw2Q4T6SonTs2B2FKRkXd3L3hPdN3g4rC3LmREyT6OFE7SSOn9omYIlKRr7E/2SdiBiJFNHOsU6JIQbpLZ6ZynnAUHxY5M1N2NdCcSHE3deZAaLKbMkxxdF1pb/QoIordau+WxnkhIgXhXXt2jf4Mup8Cuu35vJNBwyo+MGK7Q8MmHxVIP4GV9tavXfD+pkDSOYTSmUCuqES2cgilxUDiXKPgE6sD3L+BeBVITKdxaws5gOcRlUh8hM3GSoNjAoX8iRgJ6VOeezaMmIpiykiehHiEe+aN/tmuYuMxktuby4NnxYitzchOjkrDLR6cZWCYMrIiXc7zoUnj3nX1s8ZUTbqc5eWhMeLpoibvkdJmemBejSPVeIn6V4ssr0nXo7QzNCxp+th4KVKEQXkmRvLQcaxcANKPXTO+eICkgWvIW0JkEDsWyB4hkgbuBRKRQexcIBFJA/cCichg5o5x7VUg6SCzTMN0YYikiSvIL1SNDGLnRg0i6ch2g2PeNUTSmQvIBwIknAtZLXgWiEgKY+sdckTfQ9J+Yte4eUOIhHJkQ4mJABGJSvvGeiT1F7aMyzH9KJL2biyN6zdUjUTlr6l54vZDj+qQWPrXmWEi5KUEJBa//26RGRMuP449+jEkprV8TLPGgenjx8uomkj0N73+g6V/XjknAAAAAElFTkSuQmCC";
var imageSchema = {
	pdf: async (arg) => {
		const { value, schema, pdfDoc, page, _cache } = arg;
		if (!value) return;
		const inputImageCacheKey = getCacheKey(schema, value);
		let image = _cache.get(inputImageCacheKey);
		if (!image) {
			image = await (value.startsWith("data:image/png;") ? pdfDoc.embedPng(value) : pdfDoc.embedJpg(value));
			_cache.set(inputImageCacheKey, image);
		}
		const _schema = {
			...schema,
			position: { ...schema.position }
		};
		const dimension = getImageDimension(value);
		const imageWidth = px2mm(dimension.width);
		const imageHeight = px2mm(dimension.height);
		const boxWidth = _schema.width;
		const boxHeight = _schema.height;
		const imageRatio = imageWidth / imageHeight;
		if (imageRatio > boxWidth / boxHeight) {
			_schema.width = boxWidth;
			_schema.height = boxWidth / imageRatio;
			_schema.position.y += (boxHeight - _schema.height) / 2;
		} else {
			_schema.width = boxHeight * imageRatio;
			_schema.height = boxHeight;
			_schema.position.x += (boxWidth - _schema.width) / 2;
		}
		const { width, height, rotate, position, opacity } = convertForPdfLayoutProps({
			schema: _schema,
			pageHeight: page.getHeight()
		});
		const { x, y } = position;
		const drawOptions = {
			x,
			y,
			rotate,
			width,
			height,
			opacity
		};
		page.drawImage(image, drawOptions);
	},
	ui: (arg) => {
		const { value, rootElement, mode, onChange, stopEditing, tabIndex, placeholder, theme, schema } = arg;
		const editable = isEditable(mode, schema);
		const isDefault = value === defaultValue;
		const container = document.createElement("div");
		const backgroundStyle = placeholder ? `url(${placeholder})` : "none";
		const containerStyle = {
			...fullSize$1,
			backgroundImage: value ? "none" : backgroundStyle,
			backgroundSize: `contain`,
			backgroundRepeat: "no-repeat",
			backgroundPosition: "center"
		};
		Object.assign(container.style, containerStyle);
		container.addEventListener("click", (e) => {
			if (editable) e.stopPropagation();
		});
		rootElement.appendChild(container);
		if (value) {
			const img = document.createElement("img");
			Object.assign(img.style, {
				height: "100%",
				width: "100%",
				borderRadius: 0,
				objectFit: "contain"
			});
			img.src = value;
			container.appendChild(img);
		}
		if (value && !isDefault && editable) {
			const button = document.createElement("button");
			button.textContent = "x";
			Object.assign(button.style, {
				position: "absolute",
				top: 0,
				left: 0,
				zIndex: 1,
				display: "flex",
				justifyContent: "center",
				alignItems: "center",
				color: "#333",
				background: "#f2f2f2",
				borderRadius: "2px",
				border: "1px solid #767676",
				cursor: "pointer",
				height: "24px",
				width: "24px"
			});
			button.addEventListener("click", () => {
				if (onChange) onChange({
					key: "content",
					value: ""
				});
			});
			container.appendChild(button);
		}
		if ((!value || isDefault) && editable) {
			const label = document.createElement("label");
			const labelStyle = {
				...fullSize$1,
				display: editable ? "flex" : "none",
				position: "absolute",
				top: 0,
				backgroundColor: editable || value ? addAlphaToHex(theme.colorPrimaryBg, 30) : "none",
				cursor: "pointer"
			};
			Object.assign(label.style, labelStyle);
			container.appendChild(label);
			const input = document.createElement("input");
			const inputStyle = {
				...fullSize$1,
				position: "absolute",
				top: "50%",
				left: "50%",
				width: "180px",
				height: "30px",
				marginLeft: "-90px",
				marginTop: "-15px"
			};
			Object.assign(input.style, inputStyle);
			input.tabIndex = tabIndex || 0;
			input.type = "file";
			input.accept = "image/jpeg, image/png";
			input.addEventListener("change", (event) => {
				const target = event.target;
				readFile(target instanceof HTMLInputElement ? target.files : null).then((result) => {
					if (onChange) onChange({
						key: "content",
						value: result
					});
				}).catch((error) => {
					console.error("Error reading file:", error);
				});
			});
			input.addEventListener("blur", () => {
				if (stopEditing) stopEditing();
			});
			label.appendChild(input);
		}
	},
	propPanel: {
		schema: {},
		defaultSchema: {
			name: "",
			type: "image",
			content: defaultValue,
			position: {
				x: 0,
				y: 0
			},
			width: 40,
			height: 40,
			rotate: 0,
			opacity: 1
		}
	},
	icon: createSvgStr(Image)
};
//#endregion
//#region src/graphics/signature.ts
var createLoadErrorBadge = (message) => {
	const badge = document.createElement("div");
	badge.setAttribute("role", "alert");
	badge.textContent = message;
	badge.style.position = "absolute";
	badge.style.left = "4px";
	badge.style.right = "4px";
	badge.style.bottom = "4px";
	badge.style.zIndex = "2";
	badge.style.padding = "4px 6px";
	badge.style.borderRadius = "4px";
	badge.style.background = "rgba(176, 0, 32, 0.92)";
	badge.style.color = "#ffffff";
	badge.style.fontSize = "11px";
	badge.style.lineHeight = "1.25";
	badge.style.pointerEvents = "none";
	return badge;
};
var getEffectiveScale = (element) => {
	let scale = 1;
	while (element && element !== document.body) {
		const transform = window.getComputedStyle(element).transform;
		if (transform && transform !== "none") {
			const localScale = parseFloat(transform.match(/matrix\((.+)\)/)?.[1].split(", ")[3] || "1");
			scale *= localScale;
		}
		element = element.parentElement;
	}
	return scale;
};
var signature = {
	ui: async (arg) => {
		const { schema, value, onChange, rootElement, mode, i18n } = arg;
		const { default: SignaturePad } = await import("signature_pad");
		const canvas = document.createElement("canvas");
		canvas.width = schema.width * ZOOM;
		canvas.height = schema.height * ZOOM;
		const context = canvas.getContext("2d");
		if (context) {
			const resetScale = 1 / getEffectiveScale(rootElement);
			context.scale(resetScale, resetScale);
			const signaturePad = new SignaturePad(canvas);
			const loadErrorMessage = i18n("signature.invalidData") || "Saved signature could not be loaded.";
			let loadErrorBadge = null;
			const clearLoadError = () => {
				loadErrorBadge?.remove();
				loadErrorBadge = null;
			};
			const showLoadError = () => {
				if (loadErrorBadge) return;
				loadErrorBadge = createLoadErrorBadge(loadErrorMessage);
				rootElement.appendChild(loadErrorBadge);
			};
			const handleEndStroke = () => {
				clearLoadError();
				const data = signaturePad.toDataURL("image/png");
				if (onChange && data) onChange({
					key: "content",
					value: data
				});
			};
			try {
				if (value) signaturePad.fromDataURL(value, { ratio: resetScale });
				else signaturePad.clear();
			} catch (error) {
				signaturePad.clear();
				showLoadError();
				console.error("[@pdfme/schemas] Failed to restore saved signature data.", error);
			}
			if (mode === "viewer" || mode === "form" && schema.readOnly) signaturePad.off();
			else {
				signaturePad.on();
				const clearButton = document.createElement("button");
				const handleClear = () => {
					clearLoadError();
					if (onChange) onChange({
						key: "content",
						value: ""
					});
				};
				const cleanup = () => {
					clearLoadError();
					signaturePad.off();
					signaturePad.removeEventListener("endStroke", handleEndStroke);
					clearButton.removeEventListener("click", handleClear);
					clearButton.remove();
					rootElement.removeEventListener("beforeRemove", cleanup);
				};
				rootElement.addEventListener("beforeRemove", cleanup);
				clearButton.type = "button";
				clearButton.style.position = "absolute";
				clearButton.style.zIndex = "1";
				clearButton.textContent = i18n("signature.clear") || "x";
				clearButton.addEventListener("click", handleClear);
				rootElement.appendChild(clearButton);
				signaturePad.addEventListener("endStroke", handleEndStroke);
			}
		}
		rootElement.appendChild(canvas);
	},
	pdf: imageSchema.pdf,
	propPanel: {
		schema: {},
		defaultSchema: {
			name: "",
			type: "signature",
			content: "",
			position: {
				x: 0,
				y: 0
			},
			width: 62.5,
			height: 37.5
		}
	}
};
//#endregion
//#region src/sanitize.ts
var sanitizeSVG = (svgString) => {
	return DOMPurify.sanitize(svgString, {
		USE_PROFILES: {
			svg: true,
			svgFilters: true
		},
		FORBID_TAGS: [
			"script",
			"foreignObject",
			"use",
			"embed",
			"iframe",
			"object",
			"link",
			"style",
			"animate",
			"animateMotion",
			"animateTransform",
			"set"
		],
		FORBID_ATTR: [
			"onload",
			"onerror",
			"onclick",
			"onmouseover",
			"onmouseout",
			"onmousedown",
			"onmouseup",
			"onfocus",
			"onblur",
			"onchange",
			"onsubmit",
			"onreset",
			"onselect",
			"onabort",
			"oninput",
			"onkeydown",
			"onkeypress",
			"onkeyup",
			"onbegin",
			"onend",
			"onrepeat",
			"href",
			"xlink:href",
			"src",
			"action",
			"formaction"
		],
		KEEP_CONTENT: false
	});
};
//#endregion
//#region src/graphics/svg.ts
var isValidSVG = (svgString) => {
	try {
		if (!svgString || typeof svgString !== "string") return false;
		if (!svgString.includes("<svg") || !svgString.includes("</svg>")) return false;
		if (typeof DOMParser !== "undefined") {
			if (new DOMParser().parseFromString(svgString, "image/svg+xml").querySelector("parsererror") !== null) return false;
		}
		return true;
	} catch {
		return false;
	}
};
var svgSchema = {
	ui: (arg) => {
		const { rootElement, value, mode, onChange, theme, schema } = arg;
		const container = document.createElement(isEditable(mode, schema) ? "textarea" : "div");
		container.style.width = "100%";
		container.style.height = "100%";
		container.style.boxSizing = "border-box";
		if (isEditable(mode, schema)) {
			const textarea = container;
			textarea.value = value;
			textarea.style.position = "absolute";
			textarea.style.backgroundColor = addAlphaToHex(theme.colorPrimaryBg, 30);
			if (isValidSVG(value)) {
				const sanitizedValue = sanitizeSVG(value);
				const svgElement = new DOMParser().parseFromString(sanitizedValue, "image/svg+xml").childNodes[0];
				if (svgElement instanceof SVGElement) {
					svgElement.setAttribute("width", "100%");
					svgElement.setAttribute("height", "100%");
					svgElement.style.position = "absolute";
					rootElement.appendChild(svgElement);
				}
			} else if (value) {
				const errorElm = createErrorElm();
				errorElm.style.position = "absolute";
				rootElement.appendChild(errorElm);
			}
			textarea.addEventListener("change", (e) => {
				const newValue = e.target.value;
				if (onChange) onChange({
					key: "content",
					value: newValue
				});
			});
			rootElement.appendChild(container);
			textarea.setSelectionRange(value.length, value.length);
			textarea.focus();
		} else {
			if (!value) return;
			if (!isValidSVG(value)) {
				rootElement.appendChild(createErrorElm());
				return;
			}
			container.innerHTML = sanitizeSVG(value);
			const svgElement = container.childNodes[0];
			if (svgElement instanceof SVGElement) {
				svgElement.setAttribute("width", "100%");
				svgElement.setAttribute("height", "100%");
				rootElement.appendChild(container);
			}
		}
	},
	pdf: async (arg) => {
		const { page, schema, value } = arg;
		if (!value || !isValidSVG(value)) return;
		const { width, height, position } = convertForPdfLayoutProps({
			schema,
			pageHeight: page.getHeight()
		});
		const { x, y } = position;
		await page.drawSvg(value, {
			x,
			y: y + height,
			width,
			height
		});
	},
	propPanel: {
		schema: {},
		defaultSchema: {
			name: "",
			type: "svg",
			content: `<svg viewBox="0 0 488 600" version="1.1" xmlns="http://www.w3.org/2000/svg">
    <g transform="matrix(1,0,0,1,-56,0)" fill="#000000" stroke="none">
        <path d="M228.667,0L56,172.667L56.267,345.334L56.667,518L59.733,527.334C65.867,545.467 72.933,557.067 86,570.134C96.133,580.4 100,583.2 110.667,588.4C134.533,600.134 120,599.334 300,599.334C480,599.334 465.467,600.134 489.334,588.4C500,583.2 503.867,580.4 514,570.134C527.334,556.8 534.534,544.8 540.267,526.667L543.334,516.667L543.334,83.333L540.267,73.333C534.534,55.2 527.334,43.2 514,29.867C503.867,19.6 500,16.8 489.334,11.6C465.734,0 475.467,0.8 344.667,0.267L228.667,0ZM466.4,41.6C483.334,48.933 496.267,61.867 502.934,78.4L506,86L506,514L502.934,521.734C496,538.934 480.267,553.867 463.334,559.334C455.6,561.867 450.8,562 300,562C149.2,562 144.4,561.867 136.667,559.334C119.733,553.867 104,538.934 97.067,521.734L94,514L93.6,351.067L93.333,188.133L149.067,187.733L204.667,187.333L213.6,182.933C224.8,177.467 235.867,165.867 240.267,155.067C243.333,147.467 243.333,146.4 243.733,92.267L244.133,37.2L458,38L466.4,41.6ZM195.067,304C175.6,306.8 164,320.667 165.6,339.467C166,343.6 167.6,348.667 169.733,352.4C174.4,360.267 185.2,365.734 201.867,368.534C208.4,369.734 215.067,371.467 216.8,372.667C224,377.334 221.467,389.067 212.533,392C205.6,394.4 193.733,392.934 185.6,388.8C173.333,382.534 164,385.334 164,395.2C164,400.934 170.133,406.667 180.267,410.134C190.933,413.867 217.067,413.734 225.467,409.867C238.933,403.6 246.667,390 244.8,375.6C242.667,359.734 232.8,351.334 212.267,347.867C193.6,344.8 189.333,342.4 189.333,334.533C189.333,324.267 201.867,320.933 218.267,326.667C228.667,330.267 232.533,330.133 235.867,325.867C242.133,318 237.6,310.667 224.267,306.8C213.333,303.6 204.267,302.8 195.067,304ZM386,304.133C377.6,305.333 374,306.8 367.334,311.6C355.734,320.133 351.2,336.4 352.4,365.334C353.2,385.334 356,394.4 364.134,402.534C372.267,410.667 381.734,413.734 396.667,413.067C406.8,412.667 409.734,412 415.734,408.667C429.2,401.334 434.534,390.934 435.6,370.667C436.4,353.734 436,353.067 420.934,352.267C401.867,351.334 396,353.467 396,361.867C396,367.867 399.467,370.667 407.067,370.667C413.2,370.667 413.334,370.667 413.334,374.934C413.334,394 386.267,400.534 378.534,383.467C374.934,375.334 374.934,341.867 378.534,333.733C382,326.4 387.467,323.467 396.8,324.267C403.067,324.8 404.667,325.6 410.534,331.067C414.267,334.533 418.4,337.333 419.867,337.333C427.334,337.333 433.334,330.267 431.334,323.733C427.2,310.133 406.4,301.2 386,304.133ZM258.4,308C255.067,311.467 254.533,312.8 255.2,316.4C257.067,326.667 285.333,405.867 288.133,408.8C289.733,410.534 293.067,412.267 295.333,412.8C303.867,414.4 310.667,407.867 314.4,394.667C315.067,392.134 321.2,374.134 327.867,354.8C334.8,334.533 340,317.467 340,314.533C340,303.733 325.067,299.867 319.867,309.467C318.533,312.133 309.467,340.933 302.667,364C301.067,369.467 299.333,374.4 298.8,375.067C298.267,375.6 292.933,360.8 286.933,342C275.333,306 274.133,304 266.267,304C263.867,304 261.067,305.467 258.4,308Z" style="fill-rule:nonzero;"/>
    </g>
</svg>`,
			position: {
				x: 0,
				y: 0
			},
			width: 40,
			height: 50
		}
	},
	icon: createSvgStr(Route)
};
//#endregion
//#region src/barcodes/constants.ts
var BARCODE_TYPES = [
	"qrcode",
	"japanpost",
	"ean13",
	"ean8",
	"code39",
	"code128",
	"nw7",
	"itf14",
	"upca",
	"upce",
	"gs1datamatrix",
	"pdf417"
];
var DEFAULT_BARCODE_BG_COLOR = "#ffffff";
var DEFAULT_BARCODE_COLOR = "#000000";
//#endregion
//#region src/barcodes/helper.ts
var validateCheckDigit = (input, checkDigitPos) => {
	let passCheckDigit = true;
	if (input.length === checkDigitPos) {
		const ds = input.slice(0, -1).replace(/[^0-9]/g, "");
		let sum = 0;
		let odd = 1;
		for (let i = ds.length - 1; i > -1; i -= 1) {
			sum += Number(ds[i]) * (odd ? 3 : 1);
			odd ^= 1;
			if (sum > 0xffffffffffff) sum %= 10;
		}
		passCheckDigit = String(10 - sum % 10).slice(-1) === input.slice(-1);
	}
	return passCheckDigit;
};
var validateBarcodeInput = (type, input) => {
	if (!input) return false;
	if (!BARCODE_TYPES.includes(type)) return false;
	if (type === "qrcode") return input.length < 500;
	if (type === "japanpost") return /^(\d{7})(\d|[A-Z]|-)+$/.test(input);
	if (type === "ean13") return /^\d{12}$|^\d{13}$/.test(input) && validateCheckDigit(input, 13);
	if (type === "ean8") return /^\d{7}$|^\d{8}$/.test(input) && validateCheckDigit(input, 8);
	if (type === "code39") return /^(\d|[A-Z]|[-.$/+%]|\s)+$/.test(input);
	if (type === "code128") return !input.match(/([\u30a0-\u30ff\u3040-\u309f\u3005-\u3006\u30e0-\u9fcf]|[Ａ-Ｚａ-ｚ０-９！＂＃＄％＆＇（）＊＋，－．／：；＜＝＞？＠［＼］＾＿｀｛｜｝〜　])+/);
	if (type === "nw7") return /^[A-Da-d]([0-9.$:/+-])+[A-Da-d]$/.test(input);
	if (type === "itf14") return /^\d{13}$|^\d{14}$/.test(input) && validateCheckDigit(input, 14);
	if (type === "upca") return /^\d{11}$|^\d{12}$/.test(input) && validateCheckDigit(input, 12);
	if (type === "upce") return /^0(\d{6}$|\d{7}$)/.test(input) && validateCheckDigit(input, 8);
	if (type === "gs1datamatrix") {
		let ret = false;
		let res = input.match(/\((01)\)(\d*)(\(|$)/);
		if (res != null && input.length <= 52 && res[1] === "01" && (res[2].length === 14 || res[2].length === 8 || res[2].length === 12 || res[2].length === 13)) {
			let gtin = res[2];
			ret = validateCheckDigit(gtin, gtin.length);
		}
		return ret;
	}
	if (type === "pdf417") return input.length > 0 && input.length <= 1e3;
	return false;
};
/**
* The bwip.js lib has a different name for nw7 type barcodes
*/
var barCodeType2Bcid = (type) => type === "nw7" ? "rationalizedCodabar" : type;
/**
*  Strip hash from the beginning of HTML hex color codes for the bwip.js lib
*/
var mapHexColorForBwipJsLib = (color, fallback) => color ? color.replace("#", "") : fallback ? fallback.replace("#", "") : "000000";
var createBarCode = async (arg) => {
	const { type, input, width, height, backgroundColor, barColor, textColor, includetext = true } = arg;
	const bwipjsArg = {
		bcid: barCodeType2Bcid(type),
		text: input,
		width,
		height,
		scale: 5,
		includetext,
		textxalign: "center"
	};
	if (backgroundColor) bwipjsArg.backgroundcolor = mapHexColorForBwipJsLib(backgroundColor);
	if (barColor) bwipjsArg.barcolor = mapHexColorForBwipJsLib(barColor);
	if (textColor) bwipjsArg.textcolor = mapHexColorForBwipJsLib(textColor);
	let res;
	if (typeof window !== "undefined") {
		const canvas = document.createElement("canvas");
		bwipjs.toCanvas(canvas, bwipjsArg);
		const dataUrl = canvas.toDataURL("image/png");
		res = Buffer$1.from(b64toUint8Array(dataUrl).buffer);
	} else res = await bwipjs.toBuffer(bwipjsArg);
	return res;
};
//#endregion
//#region src/barcodes/pdfRender.ts
var getBarcodeCacheKey = (schema, value) => {
	return `${schema.type}${schema.backgroundColor}${schema.barColor}${schema.textColor}${value}${schema.includetext}`;
};
var pdfRender$1 = async (arg) => {
	const { value, schema, pdfDoc, page, _cache } = arg;
	if (!validateBarcodeInput(schema.type, value)) return;
	const inputBarcodeCacheKey = getBarcodeCacheKey(schema, value);
	let image = _cache.get(inputBarcodeCacheKey);
	if (!image) {
		const imageBuf = await createBarCode({
			...schema,
			type: schema.type,
			input: value
		});
		image = await pdfDoc.embedPng(imageBuf);
		_cache.set(inputBarcodeCacheKey, image);
	}
	const { width, height, rotate, position: { x, y }, opacity } = convertForPdfLayoutProps({
		schema,
		pageHeight: page.getHeight()
	});
	page.drawImage(image, {
		x,
		y,
		rotate,
		width,
		height,
		opacity
	});
};
//#endregion
//#region src/barcodes/propPanel.ts
var defaultColors = {
	backgroundColor: DEFAULT_BARCODE_BG_COLOR,
	barColor: DEFAULT_BARCODE_COLOR
};
var defaultTextColors = { textColor: DEFAULT_BARCODE_COLOR };
var defaultIncludetext = { includetext: true };
var position = {
	x: 0,
	y: 0
};
var default40x20 = {
	width: 40,
	height: 20
};
var barcodeDefaults = [
	{ defaultSchema: {
		name: "",
		type: "qrcode",
		content: "https://pdfme.com/",
		position,
		...defaultColors,
		width: 30,
		height: 30,
		rotate: 0,
		opacity: 1
	} },
	{ defaultSchema: {
		name: "",
		type: "japanpost",
		content: "6540123789-A-K-Z",
		position,
		...defaultColors,
		...defaultTextColors,
		...defaultIncludetext,
		width: 80,
		height: 7.2,
		rotate: 0,
		opacity: 1
	} },
	{ defaultSchema: {
		name: "",
		type: "ean13",
		content: "2112345678900",
		position,
		...defaultColors,
		...defaultTextColors,
		...defaultIncludetext,
		...default40x20,
		height: 16,
		rotate: 0,
		opacity: 1
	} },
	{ defaultSchema: {
		name: "",
		type: "ean8",
		content: "02345673",
		position,
		...defaultColors,
		...defaultTextColors,
		...defaultIncludetext,
		...default40x20,
		rotate: 0,
		opacity: 1
	} },
	{ defaultSchema: {
		name: "",
		type: "code39",
		content: "THIS IS CODE 39",
		position,
		...defaultColors,
		...defaultTextColors,
		...defaultIncludetext,
		...default40x20,
		opacity: 1
	} },
	{ defaultSchema: {
		name: "",
		type: "code128",
		content: "This is Code 128!",
		position,
		...defaultColors,
		...defaultTextColors,
		...defaultIncludetext,
		...default40x20,
		rotate: 0,
		opacity: 1
	} },
	{ defaultSchema: {
		name: "",
		type: "nw7",
		content: "A0123456789B",
		position,
		...defaultColors,
		...defaultTextColors,
		...defaultIncludetext,
		...default40x20,
		rotate: 0,
		opacity: 1
	} },
	{ defaultSchema: {
		name: "",
		type: "itf14",
		content: "04601234567893",
		position,
		...defaultColors,
		...defaultTextColors,
		...defaultIncludetext,
		...default40x20,
		height: 12,
		rotate: 0,
		opacity: 1
	} },
	{ defaultSchema: {
		name: "",
		type: "upca",
		content: "416000336108",
		position,
		...defaultColors,
		...defaultTextColors,
		...defaultIncludetext,
		...default40x20,
		height: 16,
		rotate: 0,
		opacity: 1
	} },
	{ defaultSchema: {
		name: "",
		type: "upce",
		content: "00123457",
		position,
		...defaultColors,
		...defaultTextColors,
		...defaultIncludetext,
		...default40x20,
		rotate: 0,
		opacity: 1
	} },
	{ defaultSchema: {
		name: "",
		type: "gs1datamatrix",
		content: "(01)03453120000011(17)191125(10)ABCD1234",
		position,
		...defaultColors,
		width: 30,
		height: 30,
		rotate: 0,
		opacity: 1
	} },
	{ defaultSchema: {
		name: "",
		type: "pdf417",
		content: "This is PDF417!",
		position,
		...defaultColors,
		width: 40,
		height: 16,
		rotate: 0,
		opacity: 1
	} }
];
var getPropPanelByBarcodeType = (barcodeType) => {
	const barcodeHasText = barcodeType !== "qrcode" && barcodeType !== "gs1datamatrix" && barcodeType !== "pdf417";
	const defaults = barcodeDefaults.find(({ defaultSchema }) => defaultSchema.type === barcodeType);
	if (!defaults) throw new Error(`[@pdfme/schemas/barcodes] No default for barcode type ${barcodeType}`);
	return {
		schema: ({ i18n }) => ({
			barColor: {
				title: i18n("schemas.barcodes.barColor"),
				type: "string",
				widget: "color",
				props: { disabledAlpha: true },
				rules: [{
					pattern: HEX_COLOR_PATTERN,
					message: i18n("validation.hexColor")
				}]
			},
			backgroundColor: {
				title: i18n("schemas.bgColor"),
				type: "string",
				widget: "color",
				props: { disabledAlpha: true },
				rules: [{
					pattern: HEX_COLOR_PATTERN,
					message: i18n("validation.hexColor")
				}]
			},
			...barcodeHasText ? {
				textColor: {
					title: i18n("schemas.textColor"),
					type: "string",
					widget: "color",
					props: { disabledAlpha: true }
				},
				includetext: {
					title: i18n("schemas.barcodes.includetext"),
					type: "boolean",
					widget: "switch"
				}
			} : {}
		}),
		...defaults
	};
};
//#endregion
//#region src/barcodes/uiRender.ts
var fullSize = {
	width: "100%",
	height: "100%"
};
var blobToDataURL = (blob) => new Promise((resolve, reject) => {
	const reader = new FileReader();
	reader.onloadend = () => resolve(reader.result);
	reader.onerror = reject;
	reader.readAsDataURL(blob);
});
var createBarcodeImage = async (schema, value) => {
	const imageBuf = await createBarCode({
		...schema,
		input: value
	});
	return await blobToDataURL(new Blob([new Uint8Array(imageBuf)], { type: "image/png" }));
};
var createBarcodeImageElm = async (schema, value) => {
	const barcodeDataURL = await createBarcodeImage(schema, value);
	const img = document.createElement("img");
	img.src = barcodeDataURL;
	const imgStyle = {
		...fullSize,
		borderRadius: 0
	};
	Object.assign(img.style, imgStyle);
	return img;
};
var uiRender$1 = async (arg) => {
	const { value, rootElement, mode, onChange, stopEditing, tabIndex, placeholder, schema, theme } = arg;
	const container = document.createElement("div");
	const containerStyle = {
		...fullSize,
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		fontFamily: "'Open Sans', sans-serif"
	};
	Object.assign(container.style, containerStyle);
	rootElement.appendChild(container);
	const editable = isEditable(mode, schema);
	if (editable) {
		const input = document.createElement("input");
		const inputStyle = {
			width: "100%",
			position: "absolute",
			textAlign: "center",
			fontSize: "12pt",
			fontWeight: "bold",
			color: theme.colorWhite,
			backgroundColor: editable || value ? addAlphaToHex("#000000", 80) : "none",
			border: "none",
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			overflow: "auto"
		};
		Object.assign(input.style, inputStyle);
		input.value = value;
		input.placeholder = placeholder || "";
		input.tabIndex = tabIndex || 0;
		input.addEventListener("change", (e) => {
			if (onChange) onChange({
				key: "content",
				value: e.target.value
			});
		});
		input.addEventListener("blur", () => {
			if (stopEditing) stopEditing();
		});
		container.appendChild(input);
		input.setSelectionRange(value.length, value.length);
		if (mode === "designer") input.focus();
	}
	if (!value) return;
	try {
		if (!validateBarcodeInput(schema.type, value)) throw new Error("[@pdfme/schemas/barcodes] Invalid barcode input");
		const imgElm = await createBarcodeImageElm(schema, value);
		container.appendChild(imgElm);
	} catch (err) {
		console.error(`[@pdfme/ui] ${String(err)}`);
		container.appendChild(createErrorElm());
	}
};
//#endregion
//#region src/barcodes/index.ts
var barcodes = BARCODE_TYPES.reduce((acc, type) => Object.assign(acc, { [type]: {
	pdf: pdfRender$1,
	ui: uiRender$1,
	propPanel: getPropPanelByBarcodeType(type),
	icon: createSvgStr(type == "qrcode" ? QrCode : Barcode)
} }), {});
//#endregion
//#region src/shapes/line.ts
var DEFAULT_LINE_COLOR = "#000000";
var HIT_POINT_HEIGHT = 16;
var lineSchema = {
	pdf: (arg) => {
		const { page, schema, options } = arg;
		if (schema.width === 0 || schema.height === 0 || !schema.color) return;
		const { colorType } = options;
		const { width, height, rotate, position: { x, y }, opacity } = convertForPdfLayoutProps({
			schema,
			pageHeight: page.getHeight(),
			applyRotateTranslate: false
		});
		const pivot = {
			x: x + width / 2,
			y: y + height / 2
		};
		page.drawLine({
			start: rotatePoint({
				x,
				y: y + height / 2
			}, pivot, rotate.angle),
			end: rotatePoint({
				x: x + width,
				y: y + height / 2
			}, pivot, rotate.angle),
			thickness: height,
			color: hex2PrintingColor(schema.color ?? DEFAULT_LINE_COLOR, colorType),
			opacity
		});
	},
	ui: (arg) => {
		const { schema, rootElement } = arg;
		Object.assign(rootElement.style, {
			position: "relative",
			overflow: "visible"
		});
		const baseStyles = {
			position: "absolute",
			top: "50%",
			left: "0",
			transform: "translateY(-50%)",
			width: "100%"
		};
		const hitArea = document.createElement("div");
		Object.assign(hitArea.style, baseStyles, {
			height: `${HIT_POINT_HEIGHT}px`,
			backgroundColor: "transparent"
		});
		const div = document.createElement("div");
		Object.assign(div.style, baseStyles, {
			height: "100%",
			backgroundColor: schema.color ?? "transparent",
			pointerEvents: "none"
		});
		rootElement.append(hitArea, div);
	},
	propPanel: {
		schema: ({ i18n }) => ({ color: {
			title: i18n("schemas.color"),
			type: "string",
			widget: "color",
			props: { disabledAlpha: true },
			required: true,
			rules: [{
				pattern: HEX_COLOR_PATTERN,
				message: i18n("validation.hexColor")
			}]
		} }),
		defaultSchema: {
			name: "",
			type: "line",
			position: {
				x: 0,
				y: 0
			},
			width: 50,
			height: .5,
			rotate: 0,
			opacity: 1,
			readOnly: true,
			color: DEFAULT_LINE_COLOR
		}
	},
	icon: createSvgStr(Minus)
};
//#endregion
//#region src/tables/cell.ts
var linePdfRender = lineSchema.pdf;
var rectanglePdfRender$1 = rectangle.pdf;
var renderLine = async (arg, schema, position, width, height) => linePdfRender({
	...arg,
	schema: {
		...schema,
		type: "line",
		position,
		width,
		height,
		color: schema.borderColor
	}
});
var createTextDiv = (schema) => {
	const contentArea = getBoxContentArea(schema);
	const textDiv = document.createElement("div");
	textDiv.style.position = "absolute";
	textDiv.style.zIndex = "1";
	textDiv.style.width = `${contentArea.width}mm`;
	textDiv.style.height = `${contentArea.height}mm`;
	textDiv.style.top = `${contentArea.topInset}mm`;
	textDiv.style.left = `${contentArea.leftInset}mm`;
	return textDiv;
};
var createLineDiv = (width, height, top, right, bottom, left, borderColor) => {
	const div = document.createElement("div");
	div.style.width = width;
	div.style.height = height;
	div.style.position = "absolute";
	if (top !== null) div.style.top = top;
	if (right !== null) div.style.right = right;
	if (bottom !== null) div.style.bottom = bottom;
	if (left !== null) div.style.left = left;
	div.style.backgroundColor = borderColor;
	return div;
};
var cellSchema = {
	pdf: async (arg) => {
		const { schema } = arg;
		const { position, width, height, borderWidth } = schema;
		const contentArea = getBoxContentArea(schema);
		await Promise.all([
			rectanglePdfRender$1({
				...arg,
				schema: {
					...schema,
					type: "rectangle",
					width: schema.width,
					height: schema.height,
					borderWidth: 0,
					borderColor: "",
					color: schema.backgroundColor
				}
			}),
			renderLine(arg, schema, {
				x: position.x,
				y: position.y
			}, width, borderWidth.top),
			renderLine(arg, schema, {
				x: position.x + width - borderWidth.right,
				y: position.y
			}, borderWidth.right, height),
			renderLine(arg, schema, {
				x: position.x,
				y: position.y + height - borderWidth.bottom
			}, width, borderWidth.bottom),
			renderLine(arg, schema, {
				x: position.x,
				y: position.y
			}, borderWidth.left, height)
		]);
		await pdfRender$4({
			...arg,
			schema: {
				...schema,
				type: "text",
				backgroundColor: "",
				borderColor: "",
				borderWidth: createBoxDimension(0),
				padding: createBoxDimension(0),
				position: contentArea.position,
				width: contentArea.width,
				height: contentArea.height
			}
		});
	},
	ui: async (arg) => {
		const { schema, rootElement } = arg;
		const { borderWidth, width, height, borderColor, backgroundColor } = schema;
		rootElement.style.backgroundColor = backgroundColor;
		const textDiv = createTextDiv(schema);
		await uiRender$4({
			...arg,
			schema: {
				...schema,
				backgroundColor: "",
				borderColor: "",
				borderWidth: createBoxDimension(0),
				padding: createBoxDimension(0)
			},
			rootElement: textDiv
		});
		rootElement.appendChild(textDiv);
		[
			createLineDiv(`${width}mm`, `${borderWidth.top}mm`, "0mm", null, null, "0mm", borderColor),
			createLineDiv(`${width}mm`, `${borderWidth.bottom}mm`, null, null, "0mm", "0mm", borderColor),
			createLineDiv(`${borderWidth.left}mm`, `${height}mm`, "0mm", null, null, "0mm", borderColor),
			createLineDiv(`${borderWidth.right}mm`, `${height}mm`, "0mm", "0mm", null, null, borderColor)
		].forEach((line) => rootElement.appendChild(line));
	},
	propPanel: {
		schema: ({ options, i18n }) => {
			const font = options.font || { [DEFAULT_FONT_NAME]: {
				data: "",
				fallback: true
			} };
			return getCellPropPanelSchema({
				i18n,
				fontNames: Object.keys(font),
				fallbackFontName: getFallbackFontName(font)
			});
		},
		defaultSchema: {
			name: "",
			type: "cell",
			content: "Type Something...",
			position: {
				x: 0,
				y: 0
			},
			width: 50,
			height: 15,
			...getDefaultCellStyles()
		}
	}
};
//#endregion
//#region src/tables/pdfRender.ts
var rectanglePdfRender = rectangle.pdf;
var cellPdfRender = cellSchema.pdf;
async function drawCell(arg, cell) {
	await cellPdfRender({
		...arg,
		value: cell.raw,
		schema: {
			name: "",
			type: "cell",
			position: {
				x: cell.x,
				y: cell.y
			},
			width: cell.width,
			height: cell.height,
			fontName: cell.styles.fontName,
			alignment: cell.styles.alignment,
			verticalAlignment: cell.styles.verticalAlignment,
			fontSize: cell.styles.fontSize,
			lineHeight: cell.styles.lineHeight,
			characterSpacing: cell.styles.characterSpacing,
			backgroundColor: cell.styles.backgroundColor,
			fontColor: cell.styles.textColor,
			borderColor: cell.styles.lineColor,
			borderWidth: cell.styles.lineWidth,
			padding: cell.styles.cellPadding
		}
	});
}
async function drawRow(arg, table, row, cursor, columns) {
	cursor.x = table.settings.margin.left;
	for (const column of columns) {
		const cell = row.cells[column.index];
		if (!cell) {
			cursor.x += column.width;
			continue;
		}
		cell.x = cursor.x;
		cell.y = cursor.y;
		await drawCell(arg, cell);
		cursor.x += column.width;
	}
	cursor.y += row.height;
}
async function drawTableBorder(arg, table, startPos, cursor) {
	const lineWidth = table.settings.tableLineWidth;
	const lineColor = table.settings.tableLineColor;
	if (!lineWidth || !lineColor) return;
	await rectanglePdfRender({
		...arg,
		schema: {
			name: "",
			type: "rectangle",
			borderWidth: lineWidth,
			borderColor: lineColor,
			color: "",
			position: {
				x: startPos.x,
				y: startPos.y
			},
			width: table.getWidth(),
			height: cursor.y - startPos.y,
			readOnly: true
		}
	});
}
async function drawTable(arg, table) {
	const settings = table.settings;
	const startY = settings.startY;
	const cursor = {
		x: settings.margin.left,
		y: startY
	};
	const startPos = Object.assign({}, cursor);
	if (settings.showHead) for (const row of table.head) await drawRow(arg, table, row, cursor, table.columns);
	for (const row of table.body) await drawRow(arg, table, row, cursor, table.columns);
	await drawTableBorder(arg, table, startPos, cursor);
}
var pdfRender = async (arg) => {
	const { value, schema, basePdf, options, _cache } = arg;
	const body = getBodyWithSchemaRange(typeof value !== "string" ? JSON.stringify(value || "[]") : value, schema);
	const createTableArgs = {
		schema,
		basePdf,
		options,
		_cache
	};
	await drawTable(arg, await createSingleTable(Array.isArray(body) ? body.map((row) => Array.isArray(row) ? row.map((cell) => String(cell)) : []) : [], createTableArgs));
};
//#endregion
//#region src/tables/uiRender.ts
var buttonSize = 18;
function createButton(options) {
	const button = document.createElement("button");
	button.type = "button";
	button.innerText = options.text;
	if (options.ariaLabel) button.setAttribute("aria-label", options.ariaLabel);
	button.style.width = `${options.width}px`;
	button.style.height = `${options.height}px`;
	button.style.position = "absolute";
	button.style.top = options.top;
	button.style.display = "inline-flex";
	button.style.alignItems = "center";
	button.style.justifyContent = "center";
	button.style.padding = "0";
	button.style.border = "1px solid #d9d9d9";
	button.style.borderRadius = "3px";
	button.style.background = "#ffffff";
	button.style.color = "#333333";
	button.style.fontSize = "11px";
	button.style.lineHeight = "1";
	button.style.cursor = "pointer";
	button.style.zIndex = "20";
	if (options.left !== void 0) button.style.left = options.left;
	if (options.right !== void 0) button.style.right = options.right;
	button.addEventListener("mousedown", (event) => {
		event.preventDefault();
	});
	button.addEventListener("click", (event) => {
		event.preventDefault();
		event.stopPropagation();
		options.onClick(event);
	});
	return button;
}
var cellUiRender = cellSchema.ui;
var convertToCellStyle = (styles) => ({
	fontName: styles.fontName,
	alignment: styles.alignment,
	verticalAlignment: styles.verticalAlignment,
	fontSize: styles.fontSize,
	lineHeight: styles.lineHeight,
	characterSpacing: styles.characterSpacing,
	backgroundColor: styles.backgroundColor,
	fontColor: styles.textColor,
	borderColor: styles.lineColor,
	borderWidth: styles.lineWidth,
	padding: styles.cellPadding
});
var calcResizedHeadWidthPercentages = (arg) => {
	const { currentHeadWidthPercentages, currentHeadWidths, changedHeadWidth, changedHeadIndex } = arg;
	const headWidthPercentages = [...currentHeadWidthPercentages];
	const changedWidthPercentage = changedHeadWidth / currentHeadWidths.reduce((a, b) => a + b, 0) * 100;
	const originalNextWidthPercentage = headWidthPercentages[changedHeadIndex + 1] ?? 0;
	const adjustment = headWidthPercentages[changedHeadIndex] - changedWidthPercentage;
	headWidthPercentages[changedHeadIndex] = changedWidthPercentage;
	if (changedHeadIndex + 1 < headWidthPercentages.length) headWidthPercentages[changedHeadIndex + 1] = originalNextWidthPercentage + adjustment;
	return headWidthPercentages;
};
var setBorder = (div, borderPosition, arg) => {
	div.style[`border${borderPosition}`] = `${String(arg.schema.tableStyles.borderWidth)}mm solid ${arg.schema.tableStyles.borderColor}`;
};
var drawBorder = (div, row, colIndex, rowIndex, rowsLength, arg) => {
	const isFirstColumn = colIndex === 0;
	const isLastColumn = colIndex === Object.values(row.cells).length - 1;
	const isLastRow = rowIndex === rowsLength - 1;
	if (row.section === "head") {
		setBorder(div, "Top", arg);
		if (isFirstColumn) setBorder(div, "Left", arg);
		if (isLastColumn) setBorder(div, "Right", arg);
		if (JSON.parse(arg.value || "[]").length === 0) setBorder(div, "Bottom", arg);
	} else if (row.section === "body") {
		if (!arg.schema.showHead && rowIndex === 0) setBorder(div, "Top", arg);
		if (isFirstColumn) setBorder(div, "Left", arg);
		if (isLastColumn) setBorder(div, "Right", arg);
		if (isLastRow) setBorder(div, "Bottom", arg);
	}
};
var renderRowUi = (args) => {
	const { rows, arg, onChangeEditingPosition, offsetY = 0, editingPosition } = args;
	const value = JSON.parse(arg.value || "[]");
	let rowOffsetY = offsetY;
	rows.forEach((row, rowIndex) => {
		const { cells, height, section } = row;
		let colOffsetX = 0;
		Object.values(cells).forEach((cell, colIndex) => {
			const div = document.createElement("div");
			div.style.position = "absolute";
			div.style.top = `${rowOffsetY}mm`;
			div.style.left = `${colOffsetX}mm`;
			div.style.width = `${cell.width}mm`;
			div.style.height = `${cell.height}mm`;
			div.style.boxSizing = "border-box";
			drawBorder(div, row, colIndex, rowIndex, rows.length, arg);
			div.style.cursor = arg.mode === "designer" || arg.mode === "form" && section === "body" ? "text" : "default";
			div.addEventListener("click", () => {
				if (arg.mode === "viewer") return;
				onChangeEditingPosition({
					rowIndex,
					colIndex
				});
			});
			arg.rootElement.appendChild(div);
			const isEditing = editingPosition.rowIndex === rowIndex && editingPosition.colIndex === colIndex;
			let mode = "viewer";
			if (arg.mode === "form") mode = section === "body" && isEditing && !arg.schema.readOnly ? "designer" : "viewer";
			else if (arg.mode === "designer") mode = isEditing ? "designer" : "form";
			cellUiRender({
				...arg,
				stopEditing: () => {
					if (arg.mode === "form") resetEditingPosition();
				},
				mode,
				onChange: (v) => {
					if (!arg.onChange) return;
					const newValue = Array.isArray(v) ? v[0].value : v.value;
					if (section === "body") {
						const startRange = getTableBodyRange(arg.schema)?.start ?? 0;
						value[rowIndex + startRange][colIndex] = newValue;
						arg.onChange({
							key: "content",
							value: JSON.stringify(value)
						});
					} else {
						const newHead = [...arg.schema.head];
						newHead[colIndex] = newValue;
						arg.onChange({
							key: "head",
							value: newHead
						});
					}
				},
				value: cell.raw,
				placeholder: "",
				rootElement: div,
				schema: {
					name: "",
					type: "cell",
					content: cell.raw,
					position: {
						x: colOffsetX,
						y: rowOffsetY
					},
					width: cell.width,
					height: cell.height,
					...convertToCellStyle(cell.styles)
				}
			});
			colOffsetX += cell.width;
		});
		rowOffsetY += height;
	});
};
var headEditingPosition = {
	rowIndex: -1,
	colIndex: -1
};
var bodyEditingPosition = {
	rowIndex: -1,
	colIndex: -1
};
var resetEditingPosition = () => {
	headEditingPosition.rowIndex = -1;
	headEditingPosition.colIndex = -1;
	bodyEditingPosition.rowIndex = -1;
	bodyEditingPosition.colIndex = -1;
};
var uiRender = async (arg) => {
	const { rootElement, onChange, schema, value, mode, scale } = arg;
	const body = getBody(value);
	const bodyRange = getTableBodyRange(schema);
	const bodyWidthRange = getBodyWithSchemaRange(value, schema, bodyRange);
	const table = await createSingleTable(bodyWidthRange, arg);
	const showHead = table.settings.showHead;
	rootElement.innerHTML = "";
	const handleChangeEditingPosition = (newPosition, editingPosition) => {
		resetEditingPosition();
		editingPosition.rowIndex = newPosition.rowIndex;
		editingPosition.colIndex = newPosition.colIndex;
		uiRender(arg);
	};
	if (showHead) renderRowUi({
		rows: table.head,
		arg,
		editingPosition: headEditingPosition,
		onChangeEditingPosition: (p) => handleChangeEditingPosition(p, headEditingPosition)
	});
	const offsetY = showHead ? table.getHeadHeight() : 0;
	renderRowUi({
		rows: table.body,
		arg,
		editingPosition: bodyEditingPosition,
		onChangeEditingPosition: (p) => {
			handleChangeEditingPosition(p, bodyEditingPosition);
		},
		offsetY
	});
	const createAddRowButton = () => createButton({
		width: buttonSize,
		height: buttonSize,
		top: `${table.getHeight()}mm`,
		left: `calc(50% - ${buttonSize / 2}px)`,
		text: "+",
		ariaLabel: "Add row",
		onClick: () => {
			const newRow = Array(schema.head.length).fill("");
			if (onChange) onChange({
				key: "content",
				value: JSON.stringify(body.concat([newRow]))
			});
		}
	});
	const createRemoveRowButtons = () => {
		let offsetY = showHead ? table.getHeadHeight() : 0;
		return table.body.map((row, i) => {
			offsetY = offsetY + row.height;
			return createButton({
				width: buttonSize,
				height: buttonSize,
				top: `${offsetY - px2mm(buttonSize)}mm`,
				right: `-${buttonSize}px`,
				text: "-",
				ariaLabel: "Remove row",
				onClick: () => {
					const newTableBody = body.filter((_, j) => j !== i + (bodyRange?.start ?? 0));
					if (onChange) onChange({
						key: "content",
						value: JSON.stringify(newTableBody)
					});
				}
			});
		});
	};
	if (mode === "form" && onChange && !schema.readOnly) {
		if (bodyRange?.end === void 0 || bodyRange.end >= JSON.parse(value || "[]").length) rootElement.appendChild(createAddRowButton());
		createRemoveRowButtons().forEach((button) => rootElement.appendChild(button));
	}
	if (mode === "designer" && onChange) {
		const addColumnButton = createButton({
			width: buttonSize,
			height: buttonSize,
			top: `${(showHead ? table.getHeadHeight() : 0) - px2mm(buttonSize)}mm`,
			right: `-${buttonSize}px`,
			text: "+",
			ariaLabel: "Add column",
			onClick: (e) => {
				e.preventDefault();
				const newColumnWidthPercentage = 25;
				const totalCurrentWidth = schema.headWidthPercentages.reduce((acc, width) => acc + width, 0);
				const scalingRatio = (100 - newColumnWidthPercentage) / totalCurrentWidth;
				const scaledWidths = schema.headWidthPercentages.map((width) => width * scalingRatio);
				onChange([
					{
						key: "head",
						value: schema.head.concat(`Head ${schema.head.length + 1}`)
					},
					{
						key: "headWidthPercentages",
						value: scaledWidths.concat(newColumnWidthPercentage)
					},
					{
						key: "content",
						value: JSON.stringify(bodyWidthRange.map((row, i) => row.concat(`Row ${i + 1}`)))
					}
				]);
			}
		});
		rootElement.appendChild(addColumnButton);
		rootElement.appendChild(createAddRowButton());
		createRemoveRowButtons().forEach((button) => rootElement.appendChild(button));
		let offsetX = 0;
		table.columns.forEach((column, i, columns) => {
			if (columns.length === 1) return;
			offsetX = offsetX + column.width;
			const removeColumnButton = createButton({
				width: buttonSize,
				height: buttonSize,
				top: `-18px`,
				left: `${offsetX - px2mm(buttonSize)}mm`,
				text: "-",
				ariaLabel: "Remove column",
				onClick: () => {
					const totalWidthMinusRemoved = schema.headWidthPercentages.reduce((sum, width, j) => j !== i ? sum + width : sum, 0);
					onChange([
						{
							key: "head",
							value: schema.head.filter((_, j) => j !== i)
						},
						{
							key: "headWidthPercentages",
							value: schema.headWidthPercentages.filter((_, j) => j !== i).map((width) => width / totalWidthMinusRemoved * 100)
						},
						{
							key: "content",
							value: JSON.stringify(bodyWidthRange.map((row) => row.filter((_, j) => j !== i)))
						}
					]);
				}
			});
			rootElement.appendChild(removeColumnButton);
			if (i === table.columns.length - 1) return;
			const dragHandle = document.createElement("div");
			const lineWidth = 5;
			dragHandle.style.width = `${lineWidth}px`;
			dragHandle.style.height = "100%";
			dragHandle.style.backgroundColor = "#eee";
			dragHandle.style.opacity = "0.5";
			dragHandle.style.cursor = "col-resize";
			dragHandle.style.position = "absolute";
			dragHandle.style.zIndex = "10";
			dragHandle.style.left = `${offsetX - px2mm(lineWidth) / 2}mm`;
			dragHandle.style.top = "0";
			const setColor = (e) => {
				const handle = e.target;
				handle.style.backgroundColor = "#2196f3";
			};
			const resetColor = (e) => {
				const handle = e.target;
				handle.style.backgroundColor = "#eee";
			};
			dragHandle.addEventListener("mouseover", setColor);
			dragHandle.addEventListener("mouseout", resetColor);
			const prevColumnLeft = offsetX - column.width;
			const nextColumnRight = offsetX - px2mm(lineWidth) + table.columns[i + 1].width;
			dragHandle.addEventListener("mousedown", (e) => {
				resetEditingPosition();
				const handle = e.target;
				dragHandle.removeEventListener("mouseover", setColor);
				dragHandle.removeEventListener("mouseout", resetColor);
				const startClientX = e.clientX;
				const startLeft = Number(handle.style.left.replace("mm", ""));
				let move = 0;
				const mouseMove = (e) => {
					let newLeft = startLeft + (e.clientX - startClientX) / ZOOM / scale;
					if (newLeft < prevColumnLeft) newLeft = prevColumnLeft;
					if (newLeft >= nextColumnRight) newLeft = nextColumnRight;
					handle.style.left = `${newLeft}mm`;
					move = newLeft - startLeft;
				};
				rootElement.addEventListener("mousemove", mouseMove);
				const commitResize = () => {
					if (move !== 0) onChange({
						key: "headWidthPercentages",
						value: calcResizedHeadWidthPercentages({
							currentHeadWidthPercentages: schema.headWidthPercentages,
							currentHeadWidths: table.columns.map((column) => column.width),
							changedHeadWidth: table.columns[i].width + move,
							changedHeadIndex: i
						})
					});
					move = 0;
					dragHandle.addEventListener("mouseover", setColor);
					dragHandle.addEventListener("mouseout", resetColor);
					rootElement.removeEventListener("mousemove", mouseMove);
					rootElement.removeEventListener("mouseup", commitResize);
				};
				rootElement.addEventListener("mouseup", commitResize);
			});
			rootElement.appendChild(dragHandle);
		});
	}
	if (mode === "viewer") resetEditingPosition();
	const tableHeight = showHead ? table.getHeight() : table.getBodyHeight();
	if (schema.height !== tableHeight && onChange) onChange({
		key: "height",
		value: tableHeight
	});
};
//#endregion
//#region src/tables/index.ts
var tableSchema = {
	pdf: pdfRender,
	ui: uiRender,
	propPanel: {
		schema: ({ activeSchema, options, i18n }) => {
			const tableSchema = activeSchema;
			const head = tableSchema.head || [];
			const showHead = tableSchema.showHead || false;
			const font = options.font || { [DEFAULT_FONT_NAME]: {
				data: "",
				fallback: true
			} };
			const fontNames = Object.keys(font);
			const fallbackFontName = getFallbackFontName(font);
			return {
				showHead: {
					title: i18n("schemas.table.showHead"),
					type: "boolean",
					widget: "checkbox",
					span: 12
				},
				repeatHead: {
					title: i18n("schemas.table.repeatHead"),
					type: "boolean",
					widget: "checkbox",
					span: 12
				},
				"-------": {
					type: "void",
					widget: "Divider"
				},
				tableStyles: {
					title: i18n("schemas.table.tableStyle"),
					type: "object",
					widget: "Card",
					span: 24,
					properties: {
						borderWidth: {
							title: i18n("schemas.borderWidth"),
							type: "number",
							widget: "inputNumber",
							props: {
								min: 0,
								step: .1
							},
							step: 1
						},
						borderColor: {
							title: i18n("schemas.borderColor"),
							type: "string",
							widget: "color",
							props: { disabledAlpha: true },
							rules: [{
								pattern: HEX_COLOR_PATTERN,
								message: i18n("validation.hexColor")
							}]
						}
					}
				},
				headStyles: {
					hidden: !showHead,
					title: i18n("schemas.table.headStyle"),
					type: "object",
					widget: "Card",
					span: 24,
					properties: getCellPropPanelSchema({
						i18n,
						fallbackFontName,
						fontNames
					})
				},
				bodyStyles: {
					title: i18n("schemas.table.bodyStyle"),
					type: "object",
					widget: "Card",
					span: 24,
					properties: getCellPropPanelSchema({
						i18n,
						fallbackFontName,
						fontNames,
						isBody: true
					})
				},
				columnStyles: {
					title: i18n("schemas.table.columnStyle"),
					type: "object",
					widget: "Card",
					span: 24,
					properties: getColumnStylesPropPanelSchema({
						head,
						i18n
					})
				}
			};
		},
		defaultSchema: {
			name: "",
			type: "table",
			position: {
				x: 0,
				y: 0
			},
			width: 150,
			height: 20,
			content: JSON.stringify([[
				"Alice",
				"New York",
				"Alice is a freelance web designer and developer"
			], [
				"Bob",
				"Paris",
				"Bob is a freelance illustrator and graphic designer"
			]]),
			showHead: true,
			repeatHead: false,
			head: [
				"Name",
				"City",
				"Description"
			],
			headWidthPercentages: [
				30,
				30,
				40
			],
			tableStyles: {
				borderColor: "#000000",
				borderWidth: .3
			},
			headStyles: Object.assign(getDefaultCellStyles(), {
				fontColor: "#ffffff",
				backgroundColor: "#2980ba",
				borderColor: "",
				borderWidth: {
					top: 0,
					right: 0,
					bottom: 0,
					left: 0
				}
			}),
			bodyStyles: Object.assign(getDefaultCellStyles(), { alternateBackgroundColor: "#f5f5f5" }),
			columnStyles: {}
		}
	},
	icon: createSvgStr(Table)
};
//#endregion
//#region ../../node_modules/air-datepicker/locale/ar.js
var require_ar = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.default = void 0;
	exports.default = {
		days: [
			"الأحد",
			"الأثنين",
			"الثلاثاء",
			"الأربعاء",
			"الخميس",
			"الجمعه",
			"السبت"
		],
		daysShort: [
			"الأحد",
			"الأثنين",
			"الثلاثاء",
			"الأربعاء",
			"الخميس",
			"الجمعه",
			"السبت"
		],
		daysMin: [
			"الأحد",
			"الأثنين",
			"الثلاثاء",
			"الأربعاء",
			"الخميس",
			"الجمعه",
			"السبت"
		],
		months: [
			"يناير",
			"فبراير",
			"مارس",
			"أبريل",
			"مايو",
			"يونيو",
			"يوليو",
			"أغسطس",
			"سبتمبر",
			"اكتوبر",
			"نوفمبر",
			"ديسمبر"
		],
		monthsShort: [
			"يناير",
			"فبراير",
			"مارس",
			"أبريل",
			"مايو",
			"يونيو",
			"يوليو",
			"أغسطس",
			"سبتمبر",
			"اكتوبر",
			"نوفمبر",
			"ديسمبر"
		],
		today: "اليوم",
		clear: "حذف",
		dateFormat: "dd/MM/yyyy",
		timeFormat: "hh:mm aa",
		firstDay: 0
	};
}));
//#endregion
//#region ../../node_modules/air-datepicker/locale/bg.js
var require_bg = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.default = void 0;
	exports.default = {
		days: [
			"Неделя",
			"Понеделник",
			"Вторник",
			"Сряда",
			"Четвъртък",
			"Петък",
			"Събота"
		],
		daysShort: [
			"Нед",
			"Пон",
			"Вто",
			"Сря",
			"Чет",
			"Пет",
			"Съб"
		],
		daysMin: [
			"Нд",
			"Пн",
			"Вт",
			"Ср",
			"Чт",
			"Пт",
			"Сб"
		],
		months: [
			"Януари",
			"Февруари",
			"Март",
			"Април",
			"Май",
			"Юни",
			"Юли",
			"Август",
			"Септември",
			"Октомври",
			"Ноември",
			"Декември"
		],
		monthsShort: [
			"Яну",
			"Фев",
			"Мар",
			"Апр",
			"Май",
			"Юни",
			"Юли",
			"Авг",
			"Сеп",
			"Окт",
			"Ное",
			"Дек"
		],
		today: "Днес",
		clear: "Изчисти",
		dateFormat: "dd.MM.yyyy",
		timeFormat: "HH:mm",
		firstDay: 1
	};
}));
//#endregion
//#region ../../node_modules/air-datepicker/locale/ca.js
var require_ca = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.default = void 0;
	exports.default = {
		days: [
			"Diumenge",
			"Dilluns",
			"Dimarts",
			"Dimecres",
			"Dijous",
			"Divendres",
			"Dissabte"
		],
		daysShort: [
			"Diu",
			"Dil",
			"Dmt",
			"Dmc",
			"Dij",
			"Div",
			"Dis"
		],
		daysMin: [
			"dg",
			"dl",
			"dt",
			"dc",
			"dj",
			"dv",
			"ds"
		],
		months: [
			"Gener",
			"Febrer",
			"Març",
			"Abril",
			"Maig",
			"Juny",
			"Juliol",
			"Agost",
			"Setembre",
			"Octubre",
			"Novembre",
			"Desembre"
		],
		monthsShort: [
			"Gen",
			"Feb",
			"Mar",
			"Abr",
			"Mai",
			"Jun",
			"Jul",
			"Ago",
			"Set",
			"Oct",
			"Nov",
			"Des"
		],
		today: "Avui",
		clear: "Neteja",
		dateFormat: "dd/MM/yyyy",
		timeFormat: "hh:mm aa",
		firstDay: 1
	};
}));
//#endregion
//#region ../../node_modules/air-datepicker/locale/cs.js
var require_cs = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.default = void 0;
	exports.default = {
		days: [
			"Neděle",
			"Pondělí",
			"Úterý",
			"Středa",
			"Čtvrtek",
			"Pátek",
			"Sobota"
		],
		daysShort: [
			"Ne",
			"Po",
			"Út",
			"St",
			"Čt",
			"Pá",
			"So"
		],
		daysMin: [
			"Ne",
			"Po",
			"Út",
			"St",
			"Čt",
			"Pá",
			"So"
		],
		months: [
			"Leden",
			"Únor",
			"Březen",
			"Duben",
			"Květen",
			"Červen",
			"Červenec",
			"Srpen",
			"Září",
			"Říjen",
			"Listopad",
			"Prosinec"
		],
		monthsShort: [
			"Led",
			"Úno",
			"Bře",
			"Dub",
			"Kvě",
			"Čvn",
			"Čvc",
			"Srp",
			"Zář",
			"Říj",
			"Lis",
			"Pro"
		],
		today: "Dnes",
		clear: "Vymazat",
		dateFormat: "dd.MM.yyyy",
		timeFormat: "HH:mm",
		firstDay: 1
	};
}));
//#endregion
//#region ../../node_modules/air-datepicker/locale/da.js
var require_da = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.default = void 0;
	exports.default = {
		days: [
			"Søndag",
			"Mandag",
			"Tirsdag",
			"Onsdag",
			"Torsdag",
			"Fredag",
			"Lørdag"
		],
		daysShort: [
			"Søn",
			"Man",
			"Tir",
			"Ons",
			"Tor",
			"Fre",
			"Lør"
		],
		daysMin: [
			"Sø",
			"Ma",
			"Ti",
			"On",
			"To",
			"Fr",
			"Lø"
		],
		months: [
			"Januar",
			"Februar",
			"Marts",
			"April",
			"Maj",
			"Juni",
			"Juli",
			"August",
			"September",
			"Oktober",
			"November",
			"December"
		],
		monthsShort: [
			"Jan",
			"Feb",
			"Mar",
			"Apr",
			"Maj",
			"Jun",
			"Jul",
			"Aug",
			"Sep",
			"Okt",
			"Nov",
			"Dec"
		],
		today: "I dag",
		clear: "Nulstil",
		dateFormat: "dd/MM/yyyy",
		timeFormat: "HH:mm",
		firstDay: 1
	};
}));
//#endregion
//#region ../../node_modules/air-datepicker/locale/de.js
var require_de = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.default = void 0;
	exports.default = {
		days: [
			"Sonntag",
			"Montag",
			"Dienstag",
			"Mittwoch",
			"Donnerstag",
			"Freitag",
			"Samstag"
		],
		daysShort: [
			"Son",
			"Mon",
			"Die",
			"Mit",
			"Don",
			"Fre",
			"Sam"
		],
		daysMin: [
			"So",
			"Mo",
			"Di",
			"Mi",
			"Do",
			"Fr",
			"Sa"
		],
		months: [
			"Januar",
			"Februar",
			"März",
			"April",
			"Mai",
			"Juni",
			"Juli",
			"August",
			"September",
			"Oktober",
			"November",
			"Dezember"
		],
		monthsShort: [
			"Jan",
			"Feb",
			"Mär",
			"Apr",
			"Mai",
			"Jun",
			"Jul",
			"Aug",
			"Sep",
			"Okt",
			"Nov",
			"Dez"
		],
		today: "Heute",
		clear: "Löschen",
		dateFormat: "dd.MM.yyyy",
		timeFormat: "HH:mm",
		firstDay: 1
	};
}));
//#endregion
//#region ../../node_modules/air-datepicker/locale/el.js
var require_el = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.default = void 0;
	exports.default = {
		days: [
			"Κυριακή",
			"Δευτέρα",
			"Τρίτη",
			"Τετάρτη",
			"Πέμπτη",
			"Παρασκευή",
			"Σάββατο"
		],
		daysShort: [
			"Κυρ",
			"Δευ",
			"Τρί",
			"Τετ",
			"Πέμ",
			"Παρ",
			"Σάβ"
		],
		daysMin: [
			"Κυ",
			"Δε",
			"Τρ",
			"Τε",
			"Πε",
			"Πα",
			"Σα"
		],
		months: [
			"Ιανουάριος",
			"Φεβρουάριος",
			"Μάρτιος",
			"Απρίλιος",
			"Μάιος",
			"Ιούνιος",
			"Ιούλιος",
			"Αύγουστος",
			"Σεπτέμβριος",
			"Οκτώβριος",
			"Νοέμβριος",
			"Δεκέμβριος"
		],
		monthsShort: [
			"Ιαν",
			"Φεβ",
			"Μαρ",
			"Απρ",
			"Μάι",
			"Ιούν",
			"Ιούλ",
			"Αύγ",
			"Σεπ",
			"Οκτ",
			"Νοε",
			"Δεκ"
		],
		today: "Σήμερα",
		clear: "Καθαρισμός",
		dateFormat: "dd/MM/yyyy",
		timeFormat: "hh:mm aa",
		firstDay: 1
	};
}));
//#endregion
//#region ../../node_modules/air-datepicker/locale/en.js
var require_en = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.default = void 0;
	exports.default = {
		days: [
			"Sunday",
			"Monday",
			"Tuesday",
			"Wednesday",
			"Thursday",
			"Friday",
			"Saturday"
		],
		daysShort: [
			"Sun",
			"Mon",
			"Tue",
			"Wed",
			"Thu",
			"Fri",
			"Sat"
		],
		daysMin: [
			"Su",
			"Mo",
			"Tu",
			"We",
			"Th",
			"Fr",
			"Sa"
		],
		months: [
			"January",
			"February",
			"March",
			"April",
			"May",
			"June",
			"July",
			"August",
			"September",
			"October",
			"November",
			"December"
		],
		monthsShort: [
			"Jan",
			"Feb",
			"Mar",
			"Apr",
			"May",
			"Jun",
			"Jul",
			"Aug",
			"Sep",
			"Oct",
			"Nov",
			"Dec"
		],
		today: "Today",
		clear: "Clear",
		dateFormat: "MM/dd/yyyy",
		timeFormat: "hh:mm aa",
		firstDay: 0
	};
}));
//#endregion
//#region ../../node_modules/air-datepicker/locale/es.js
var require_es = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.default = void 0;
	exports.default = {
		days: [
			"Domingo",
			"Lunes",
			"Martes",
			"Miércoles",
			"Jueves",
			"Viernes",
			"Sábado"
		],
		daysShort: [
			"Dom",
			"Lun",
			"Mar",
			"Mie",
			"Jue",
			"Vie",
			"Sab"
		],
		daysMin: [
			"Do",
			"Lu",
			"Ma",
			"Mi",
			"Ju",
			"Vi",
			"Sa"
		],
		months: [
			"Enero",
			"Febrero",
			"Marzo",
			"Abril",
			"Mayo",
			"Junio",
			"Julio",
			"Agosto",
			"Septiembre",
			"Octubre",
			"Noviembre",
			"Diciembre"
		],
		monthsShort: [
			"Ene",
			"Feb",
			"Mar",
			"Abr",
			"May",
			"Jun",
			"Jul",
			"Ago",
			"Sep",
			"Oct",
			"Nov",
			"Dic"
		],
		today: "Hoy",
		clear: "Limpiar",
		dateFormat: "dd/MM/yyyy",
		timeFormat: "hh:mm aa",
		firstDay: 1
	};
}));
//#endregion
//#region ../../node_modules/air-datepicker/locale/eu.js
var require_eu = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.default = void 0;
	exports.default = {
		days: [
			"Igandea",
			"Astelehena",
			"Asteartea",
			"Asteazkena",
			"Osteguna",
			"Ostirala",
			"Larunbata"
		],
		daysShort: [
			"Iga",
			"Ast",
			"Asr",
			"Asz",
			"Ost",
			"Osr",
			"Lar"
		],
		daysMin: [
			"Ig",
			"As",
			"Ar",
			"Az",
			"Os",
			"Or",
			"La"
		],
		months: [
			"Urtarrila",
			"Otsaila",
			"Martxoa",
			"Apirila",
			"Maiatza",
			"Ekaina",
			"Uztaila",
			"Abuztua",
			"Iraila",
			"Urria",
			"Azaroa",
			"Abendua"
		],
		monthsShort: [
			"Urt",
			"Ots",
			"Mar",
			"Api",
			"Mai",
			"Eka",
			"Uzt",
			"Abu",
			"Ira",
			"Urr",
			"Aza",
			"Abe"
		],
		today: "Gaur",
		clear: "Garbitu",
		dateFormat: "dd/MM/yyyy",
		timeFormat: "hh:mm aa",
		firstDay: 1
	};
}));
//#endregion
//#region ../../node_modules/air-datepicker/locale/fi.js
var require_fi = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.default = void 0;
	exports.default = {
		days: [
			"Sunnuntai",
			"Maanantai",
			"Tiistai",
			"Keskiviikko",
			"Torstai",
			"Perjantai",
			"Lauantai"
		],
		daysShort: [
			"Su",
			"Ma",
			"Ti",
			"Ke",
			"To",
			"Pe",
			"La"
		],
		daysMin: [
			"Su",
			"Ma",
			"Ti",
			"Ke",
			"To",
			"Pe",
			"La"
		],
		months: [
			"Tammikuu",
			"Helmikuu",
			"Maaliskuu",
			"Huhtikuu",
			"Toukokuu",
			"Kesäkuu",
			"Heinäkuu",
			"Elokuu",
			"Syyskuu",
			"Lokakuu",
			"Marraskuu",
			"Joulukuu"
		],
		monthsShort: [
			"Tammi",
			"Helmi",
			"Maalis",
			"Huhti",
			"Touko",
			"Kesä",
			"Heinä",
			"Elo",
			"Syys",
			"Loka",
			"Marras",
			"Joulu"
		],
		today: "Tänään",
		clear: "Tyhjennä",
		dateFormat: "dd.MM.yyyy",
		timeFormat: "HH:mm",
		firstDay: 1
	};
}));
//#endregion
//#region ../../node_modules/air-datepicker/locale/fr.js
var require_fr = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.default = void 0;
	exports.default = {
		days: [
			"Dimanche",
			"Lundi",
			"Mardi",
			"Mercredi",
			"Jeudi",
			"Vendredi",
			"Samedi"
		],
		daysShort: [
			"Dim",
			"Lun",
			"Mar",
			"Mer",
			"Jeu",
			"Ven",
			"Sam"
		],
		daysMin: [
			"Di",
			"Lu",
			"Ma",
			"Me",
			"Je",
			"Ve",
			"Sa"
		],
		months: [
			"Janvier",
			"Février",
			"Mars",
			"Avril",
			"Mai",
			"Juin",
			"Juillet",
			"Août",
			"Septembre",
			"Octobre",
			"Novembre",
			"Décembre"
		],
		monthsShort: [
			"Jan",
			"Fév",
			"Mars",
			"Avr",
			"Mai",
			"Juin",
			"Juil",
			"Août",
			"Sep",
			"Oct",
			"Nov",
			"Dec"
		],
		today: "Aujourd'hui",
		clear: "Effacer",
		dateFormat: "dd/MM/yyyy",
		timeFormat: "HH:mm",
		firstDay: 1
	};
}));
//#endregion
//#region ../../node_modules/air-datepicker/locale/hr.js
var require_hr = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.default = void 0;
	exports.default = {
		days: [
			"Nedjelja",
			"Ponedjeljak",
			"Utorak",
			"Srijeda",
			"Četvrtak",
			"Petak",
			"Subota"
		],
		daysShort: [
			"Ned",
			"Pon",
			"Uto",
			"Sri",
			"Čet",
			"Pet",
			"Sub"
		],
		daysMin: [
			"Ne",
			"Po",
			"Ut",
			"Sr",
			"Če",
			"Pe",
			"Su"
		],
		months: [
			"Siječanj",
			"Veljača",
			"Ožujak",
			"Travanj",
			"Svibanj",
			"Lipanj",
			"Srpanj",
			"Kolovoz",
			"Rujan",
			"Listopad",
			"Studeni",
			"Prosinac"
		],
		monthsShort: [
			"Sij",
			"Velj",
			"Ožu",
			"Tra",
			"Svi",
			"Lip",
			"Srp",
			"Kol",
			"Ruj",
			"Lis",
			"Stu",
			"Pro"
		],
		today: "Danas",
		clear: "Očisti",
		dateFormat: "dd.MM.yyyy",
		timeFormat: "HH:mm",
		firstDay: 1
	};
}));
//#endregion
//#region ../../node_modules/air-datepicker/locale/hu.js
var require_hu = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.default = void 0;
	exports.default = {
		days: [
			"Vasárnap",
			"Hétfő",
			"Kedd",
			"Szerda",
			"Csütörtök",
			"Péntek",
			"Szombat"
		],
		daysShort: [
			"Va",
			"Hé",
			"Ke",
			"Sze",
			"Cs",
			"Pé",
			"Szo"
		],
		daysMin: [
			"V",
			"H",
			"K",
			"Sz",
			"Cs",
			"P",
			"Sz"
		],
		months: [
			"Január",
			"Február",
			"Március",
			"Április",
			"Május",
			"Június",
			"Július",
			"Augusztus",
			"Szeptember",
			"Október",
			"November",
			"December"
		],
		monthsShort: [
			"Jan",
			"Feb",
			"Már",
			"Ápr",
			"Máj",
			"Jún",
			"Júl",
			"Aug",
			"Szep",
			"Okt",
			"Nov",
			"Dec"
		],
		today: "Ma",
		clear: "Törlés",
		dateFormat: "yyyy-MM-dd",
		timeFormat: "hh:mm aa",
		firstDay: 1
	};
}));
//#endregion
//#region ../../node_modules/air-datepicker/locale/id.js
var require_id = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.default = void 0;
	exports.default = {
		days: [
			"Minggu",
			"Senin",
			"Selasa",
			"Rabu",
			"Kamis",
			"Jumat",
			"Sabtu"
		],
		daysShort: [
			"Min",
			"Sen",
			"Sel",
			"Rab",
			"Kam",
			"Jum",
			"Sab"
		],
		daysMin: [
			"Min",
			"Sen",
			"Sel",
			"Rab",
			"Kam",
			"Jum",
			"Sab"
		],
		months: [
			"Januari",
			"Februari",
			"Maret",
			"April",
			"Mei",
			"Juni",
			"Juli",
			"Agustus",
			"September",
			"Oktober",
			"November",
			"Desember"
		],
		monthsShort: [
			"Jan",
			"Feb",
			"Mar",
			"Apr",
			"Mei",
			"Jun",
			"Jul",
			"Agt",
			"Sep",
			"Okt",
			"Nov",
			"Des"
		],
		today: "Hari ini",
		clear: "Hapus",
		dateFormat: "dd/MM/yyyy",
		timeFormat: "hh:mm aa",
		firstDay: 1
	};
}));
//#endregion
//#region ../../node_modules/air-datepicker/locale/it.js
var require_it = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.default = void 0;
	exports.default = {
		days: [
			"Domenica",
			"Lunedì",
			"Martedì",
			"Mercoledì",
			"Giovedì",
			"Venerdì",
			"Sabato"
		],
		daysShort: [
			"Dom",
			"Lun",
			"Mar",
			"Mer",
			"Gio",
			"Ven",
			"Sab"
		],
		daysMin: [
			"Do",
			"Lu",
			"Ma",
			"Me",
			"Gi",
			"Ve",
			"Sa"
		],
		months: [
			"Gennaio",
			"Febbraio",
			"Marzo",
			"Aprile",
			"Maggio",
			"Giugno",
			"Luglio",
			"Agosto",
			"Settembre",
			"Ottobre",
			"Novembre",
			"Dicembre"
		],
		monthsShort: [
			"Gen",
			"Feb",
			"Mar",
			"Apr",
			"Mag",
			"Giu",
			"Lug",
			"Ago",
			"Set",
			"Ott",
			"Nov",
			"Dic"
		],
		today: "Oggi",
		clear: "Cancella",
		dateFormat: "dd/MM/yyyy",
		timeFormat: "HH:mm",
		firstDay: 1
	};
}));
//#endregion
//#region ../../node_modules/air-datepicker/locale/ja.js
var require_ja = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.default = void 0;
	exports.default = {
		days: [
			"日曜日",
			"月曜日",
			"火曜日",
			"水曜日",
			"木曜日",
			"金曜日",
			"土曜日"
		],
		daysShort: [
			"日",
			"月",
			"火",
			"水",
			"木",
			"金",
			"土"
		],
		daysMin: [
			"日",
			"月",
			"火",
			"水",
			"木",
			"金",
			"土"
		],
		months: [
			"1月",
			"2月",
			"3月",
			"4月",
			"5月",
			"6月",
			"7月",
			"8月",
			"9月",
			"10月",
			"11月",
			"12月"
		],
		monthsShort: [
			"1月",
			"2月",
			"3月",
			"4月",
			"5月",
			"6月",
			"7月",
			"8月",
			"9月",
			"10月",
			"11月",
			"12月"
		],
		today: "今日",
		clear: "クリア",
		dateFormat: "yyyy/MM/dd",
		timeFormat: "HH:mm",
		firstDay: 0
	};
}));
//#endregion
//#region ../../node_modules/air-datepicker/locale/ko.js
var require_ko = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.default = void 0;
	exports.default = {
		days: [
			"일요일",
			"월요일",
			"화요일",
			"수요일",
			"목요일",
			"금요일",
			"토요일"
		],
		daysShort: [
			"일",
			"월",
			"화",
			"수",
			"목",
			"금",
			"토"
		],
		daysMin: [
			"일",
			"월",
			"화",
			"수",
			"목",
			"금",
			"토"
		],
		months: [
			"1월",
			"2월",
			"3월",
			"4월",
			"5월",
			"6월",
			"7월",
			"8월",
			"9월",
			"10월",
			"11월",
			"12월"
		],
		monthsShort: [
			"1월",
			"2월",
			"3월",
			"4월",
			"5월",
			"6월",
			"7월",
			"8월",
			"9월",
			"10월",
			"11월",
			"12월"
		],
		today: "오늘",
		clear: "초기화",
		dateFormat: "MM/dd/yyyy",
		timeFormat: "hh:mm aa",
		firstDay: 0
	};
}));
//#endregion
//#region ../../node_modules/air-datepicker/locale/nb.js
var require_nb = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.default = void 0;
	exports.default = {
		days: [
			"Søndag",
			"Mandag",
			"Tirsdag",
			"Onsdag",
			"Torsdag",
			"Fredag",
			"Lørdag"
		],
		daysShort: [
			"Søn",
			"Man",
			"Tir",
			"Ons",
			"Tor",
			"Fre",
			"Lør"
		],
		daysMin: [
			"Sø",
			"Ma",
			"Ti",
			"On",
			"To",
			"Fr",
			"Lø"
		],
		months: [
			"Januar",
			"Februar",
			"Mars",
			"April",
			"Mai",
			"Juni",
			"Juli",
			"August",
			"September",
			"Oktober",
			"November",
			"Desember"
		],
		monthsShort: [
			"Jan",
			"Feb",
			"Mar",
			"Apr",
			"Mai",
			"Jun",
			"Jul",
			"Aug",
			"Sep",
			"Okt",
			"Nov",
			"Des"
		],
		today: "Idag",
		clear: "Fjern",
		dateFormat: "dd.mm.yyyy",
		timeFormat: "HH:mm",
		firstDay: 1
	};
}));
//#endregion
//#region ../../node_modules/air-datepicker/locale/nl.js
var require_nl = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.default = void 0;
	exports.default = {
		days: [
			"zondag",
			"maandag",
			"dinsdag",
			"woensdag",
			"donderdag",
			"vrijdag",
			"zaterdag"
		],
		daysShort: [
			"zo",
			"ma",
			"di",
			"wo",
			"do",
			"vr",
			"za"
		],
		daysMin: [
			"zo",
			"ma",
			"di",
			"wo",
			"do",
			"vr",
			"za"
		],
		months: [
			"Januari",
			"Februari",
			"Maart",
			"April",
			"Mei",
			"Juni",
			"Juli",
			"Augustus",
			"September",
			"Oktober",
			"November",
			"December"
		],
		monthsShort: [
			"Jan",
			"Feb",
			"Mrt",
			"Apr",
			"Mei",
			"Jun",
			"Jul",
			"Aug",
			"Sep",
			"Okt",
			"Nov",
			"Dec"
		],
		today: "Vandaag",
		clear: "Legen",
		dateFormat: "dd-MM-yyyy",
		timeFormat: "HH:mm",
		firstDay: 0
	};
}));
//#endregion
//#region ../../node_modules/air-datepicker/locale/th.js
var require_th = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.default = void 0;
	exports.default = {
		days: [
			"วันอาทิตย์",
			"วันจันทร์",
			"วันอังคาร",
			"วันพุธ",
			"วันพฤหัสบดี",
			"วันศุกร์",
			"วันเสาร์"
		],
		daysShort: [
			"อา.",
			"จ.",
			"อ.",
			"พ.",
			"พฤ.",
			"ศ.",
			"ส."
		],
		daysMin: [
			"อา.",
			"จ.",
			"อ.",
			"พ.",
			"พฤ.",
			"ศ.",
			"ส."
		],
		months: [
			"มกราคม",
			"กุมภาพันธ์",
			"มีนาคม",
			"เมษายน",
			"พฤษภาคม",
			"มิถุนายน",
			"กรกฎาคม",
			"สิงหาคม",
			"กันยายน",
			"ตุลาคม",
			"พฤศจิกายน",
			"ธันวาคม"
		],
		monthsShort: [
			"ม.ค.",
			"ก.พ.",
			"มี.ค.",
			"เม.ย.",
			"พ.ค.",
			"มิ.ย.",
			"ก.ค.",
			"ส.ค.",
			"ก.ย.",
			"ต.ค.",
			"พ.ย.",
			"ธ.ค."
		],
		today: "วันนี้",
		clear: "ล้าง",
		dateFormat: "dd/MM/yyyy",
		timeFormat: "HH:mm",
		firstDay: 0
	};
}));
//#endregion
//#region ../../node_modules/air-datepicker/locale/pl.js
var require_pl = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.default = void 0;
	exports.default = {
		days: [
			"Niedziela",
			"Poniedziałek",
			"Wtorek",
			"Środa",
			"Czwartek",
			"Piątek",
			"Sobota"
		],
		daysShort: [
			"Nie",
			"Pon",
			"Wto",
			"Śro",
			"Czw",
			"Pią",
			"Sob"
		],
		daysMin: [
			"Nd",
			"Pn",
			"Wt",
			"Śr",
			"Czw",
			"Pt",
			"So"
		],
		months: [
			"Styczeń",
			"Luty",
			"Marzec",
			"Kwiecień",
			"Maj",
			"Czerwiec",
			"Lipiec",
			"Sierpień",
			"Wrzesień",
			"Październik",
			"Listopad",
			"Grudzień"
		],
		monthsShort: [
			"Sty",
			"Lut",
			"Mar",
			"Kwi",
			"Maj",
			"Cze",
			"Lip",
			"Sie",
			"Wrz",
			"Paź",
			"Lis",
			"Gru"
		],
		today: "Dzisiaj",
		clear: "Wyczyść",
		dateFormat: "yyyy-MM-dd",
		timeFormat: "hh:mm:aa",
		firstDay: 1
	};
}));
//#endregion
//#region ../../node_modules/air-datepicker/locale/pt-BR.js
var require_pt_BR = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.default = void 0;
	exports.default = {
		days: [
			"Domingo",
			"Segunda",
			"Terça",
			"Quarta",
			"Quinta",
			"Sexta",
			"Sábado"
		],
		daysShort: [
			"Dom",
			"Seg",
			"Ter",
			"Qua",
			"Qui",
			"Sex",
			"Sab"
		],
		daysMin: [
			"Do",
			"Se",
			"Te",
			"Qu",
			"Qu",
			"Se",
			"Sa"
		],
		months: [
			"Janeiro",
			"Fevereiro",
			"Março",
			"Abril",
			"Maio",
			"Junho",
			"Julho",
			"Agosto",
			"Setembro",
			"Outubro",
			"Novembro",
			"Dezembro"
		],
		monthsShort: [
			"Jan",
			"Fev",
			"Mar",
			"Abr",
			"Mai",
			"Jun",
			"Jul",
			"Ago",
			"Set",
			"Out",
			"Nov",
			"Dez"
		],
		today: "Hoje",
		clear: "Limpar",
		dateFormat: "dd/MM/yyyy",
		timeFormat: "HH:mm",
		firstDay: 0
	};
}));
//#endregion
//#region ../../node_modules/air-datepicker/locale/pt.js
var require_pt = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.default = void 0;
	exports.default = {
		days: [
			"Domingo",
			"Segunda",
			"Terça",
			"Quarta",
			"Quinta",
			"Sexta",
			"Sábado"
		],
		daysShort: [
			"Dom",
			"Seg",
			"Ter",
			"Qua",
			"Qui",
			"Sex",
			"Sab"
		],
		daysMin: [
			"Do",
			"Se",
			"Te",
			"Qa",
			"Qi",
			"Sx",
			"Sa"
		],
		months: [
			"Janeiro",
			"Fevereiro",
			"Março",
			"Abril",
			"Maio",
			"Junho",
			"Julho",
			"Agosto",
			"Setembro",
			"Outubro",
			"Novembro",
			"Dezembro"
		],
		monthsShort: [
			"Jan",
			"Fev",
			"Mar",
			"Abr",
			"Mai",
			"Jun",
			"Jul",
			"Ago",
			"Set",
			"Out",
			"Nov",
			"Dez"
		],
		today: "Hoje",
		clear: "Limpar",
		dateFormat: "dd/MM/yyyy",
		timeFormat: "HH:mm",
		firstDay: 1
	};
}));
//#endregion
//#region ../../node_modules/air-datepicker/locale/ro.js
var require_ro = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.default = void 0;
	exports.default = {
		days: [
			"Duminică",
			"Luni",
			"Marţi",
			"Miercuri",
			"Joi",
			"Vineri",
			"Sâmbătă"
		],
		daysShort: [
			"Dum",
			"Lun",
			"Mar",
			"Mie",
			"Joi",
			"Vin",
			"Sâm"
		],
		daysMin: [
			"D",
			"L",
			"Ma",
			"Mi",
			"J",
			"V",
			"S"
		],
		months: [
			"Ianuarie",
			"Februarie",
			"Martie",
			"Aprilie",
			"Mai",
			"Iunie",
			"Iulie",
			"August",
			"Septembrie",
			"Octombrie",
			"Noiembrie",
			"Decembrie"
		],
		monthsShort: [
			"Ian",
			"Feb",
			"Mar",
			"Apr",
			"Mai",
			"Iun",
			"Iul",
			"Aug",
			"Sept",
			"Oct",
			"Nov",
			"Dec"
		],
		today: "Azi",
		clear: "Şterge",
		dateFormat: "dd.MM.yyyy",
		timeFormat: "HH:mm",
		firstDay: 1
	};
}));
//#endregion
//#region ../../node_modules/air-datepicker/locale/ru.js
var require_ru = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.default = void 0;
	exports.default = {
		days: [
			"Воскресенье",
			"Понедельник",
			"Вторник",
			"Среда",
			"Четверг",
			"Пятница",
			"Суббота"
		],
		daysShort: [
			"Вос",
			"Пон",
			"Вто",
			"Сре",
			"Чет",
			"Пят",
			"Суб"
		],
		daysMin: [
			"Вс",
			"Пн",
			"Вт",
			"Ср",
			"Чт",
			"Пт",
			"Сб"
		],
		months: [
			"Январь",
			"Февраль",
			"Март",
			"Апрель",
			"Май",
			"Июнь",
			"Июль",
			"Август",
			"Сентябрь",
			"Октябрь",
			"Ноябрь",
			"Декабрь"
		],
		monthsShort: [
			"Янв",
			"Фев",
			"Мар",
			"Апр",
			"Май",
			"Июн",
			"Июл",
			"Авг",
			"Сен",
			"Окт",
			"Ноя",
			"Дек"
		],
		today: "Сегодня",
		clear: "Очистить",
		dateFormat: "dd.MM.yyyy",
		timeFormat: "HH:mm",
		firstDay: 1
	};
}));
//#endregion
//#region ../../node_modules/air-datepicker/locale/si.js
var require_si = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.default = void 0;
	exports.default = {
		days: [
			"ඉරිදා",
			"සදුදා",
			"අඟහරැවදා",
			"බදාදා",
			"බ්‍රහස්‍පතින්‍",
			"සිකුරාදා",
			"සෙනසුරාදා"
		],
		daysShort: [
			"ඉරිදා",
			"සදුදා",
			"අඟහ",
			"බදාදා",
			"බ්‍රහස්‍",
			"සිකුරා",
			"සෙන"
		],
		daysMin: [
			"ඉරි",
			"සදු",
			"අඟ",
			"බදා",
			"බ්‍රහ",
			"සිකු",
			"සෙ"
		],
		months: [
			"ජනවාරි",
			"පෙබරවාරි",
			"මාර්තු",
			"අප්‍රේල්",
			"මැයි",
			"ජූනි",
			"ජූලි",
			"අගෝස්තු",
			"සැප්තැම්බර්",
			"ඔක්තෝබර්",
			"නොවැම්බර්",
			"දෙසැම්බර්"
		],
		monthsShort: [
			"ජන",
			"පෙබ",
			"මාර්",
			"අප්‍රේල්",
			"මැයි",
			"ජූනි",
			"ජූලි",
			"අගෝ",
			"සැප්",
			"ඔක්",
			"නොවැ",
			"දෙසැ"
		],
		today: "අද",
		clear: "යලි සකසන්න",
		dateFormat: "yyyy-mm-dd",
		timeFormat: "hh:ii aa",
		firstDay: 1
	};
}));
//#endregion
//#region ../../node_modules/air-datepicker/locale/sk.js
var require_sk = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.default = void 0;
	exports.default = {
		days: [
			"Nedeľa",
			"Pondelok",
			"Utorok",
			"Streda",
			"Štvrtok",
			"Piatok",
			"Sobota"
		],
		daysShort: [
			"Ned",
			"Pon",
			"Uto",
			"Str",
			"Štv",
			"Pia",
			"Sob"
		],
		daysMin: [
			"Ne",
			"Po",
			"Ut",
			"St",
			"Št",
			"Pi",
			"So"
		],
		months: [
			"Január",
			"Február",
			"Marec",
			"Apríl",
			"Máj",
			"Jún",
			"Júl",
			"August",
			"September",
			"Október",
			"November",
			"December"
		],
		monthsShort: [
			"Jan",
			"Feb",
			"Mar",
			"Apr",
			"Máj",
			"Jún",
			"Jul",
			"Aug",
			"Sep",
			"Okt",
			"Nov",
			"Dec"
		],
		today: "Dnes",
		clear: "Vymazať",
		dateFormat: "dd.MM.yyyy",
		timeFormat: "HH:mm",
		firstDay: 1
	};
}));
//#endregion
//#region ../../node_modules/air-datepicker/locale/sl.js
var require_sl = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.default = void 0;
	exports.default = {
		days: [
			"Nedelja",
			"Ponedeljek",
			"Torek",
			"Sreda",
			"Četrtek",
			"Petek",
			"Sobota"
		],
		daysShort: [
			"Ned",
			"Pon",
			"Tor",
			"Sre",
			"Čet",
			"Pet",
			"Sob"
		],
		daysMin: [
			"Ned",
			"Pon",
			"Tor",
			"Sre",
			"Čet",
			"Pet",
			"Sob"
		],
		months: [
			"Januar",
			"Februar",
			"Marec",
			"April",
			"Maj",
			"Junij",
			"Julij",
			"Avgust",
			"September",
			"Oktober",
			"November",
			"December"
		],
		monthsShort: [
			"Jan",
			"Feb",
			"Mar",
			"Apr",
			"Maj",
			"Jun",
			"Jul",
			"Avg",
			"Sep",
			"Okt",
			"Nov",
			"Dec"
		],
		today: "Danes",
		clear: "Počisti",
		dateFormat: "dd.mm.yyyy",
		timeFormat: "hh:ii aa",
		firstDay: 1
	};
}));
//#endregion
//#region ../../node_modules/air-datepicker/locale/sv.js
var require_sv = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.default = void 0;
	exports.default = {
		days: [
			"Söndag",
			"Måndag",
			"Tisdag",
			"Onsdag",
			"Torsdag",
			"Fredag",
			"Lördag"
		],
		daysShort: [
			"Sön",
			"Mån",
			"Tis",
			"Ons",
			"Tor",
			"Fre",
			"Lör"
		],
		daysMin: [
			"Sö",
			"Må",
			"Ti",
			"On",
			"To",
			"Fr",
			"Lö"
		],
		months: [
			"Januari",
			"Februari",
			"Mars",
			"April",
			"Maj",
			"Juni",
			"Juli",
			"Augusti",
			"September",
			"Oktober",
			"November",
			"December"
		],
		monthsShort: [
			"Jan",
			"Feb",
			"Mar",
			"Apr",
			"Maj",
			"Jun",
			"Jul",
			"Aug",
			"Sep",
			"Okt",
			"Nov",
			"Dec"
		],
		today: "I dag",
		clear: "Nollställ",
		dateFormat: "yyyy-MM-dd",
		timeFormat: "HH:mm",
		firstDay: 1
	};
}));
//#endregion
//#region ../../node_modules/air-datepicker/locale/tr.js
var require_tr = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.default = void 0;
	exports.default = {
		days: [
			"Pazar",
			"Pazartesi",
			"Salı",
			"Çarşamba",
			"Perşembe",
			"Cuma",
			"Cumartesi"
		],
		daysShort: [
			"Pzr",
			"Pts",
			"Sl",
			"Çar",
			"Per",
			"Cum",
			"Cts"
		],
		daysMin: [
			"Pa",
			"Pt",
			"Sl",
			"Ça",
			"Pe",
			"Cu",
			"Ct"
		],
		months: [
			"Ocak",
			"Şubat",
			"Mart",
			"Nisan",
			"Mayıs",
			"Haziran",
			"Temmuz",
			"Ağustos",
			"Eylül",
			"Ekim",
			"Kasım",
			"Aralık"
		],
		monthsShort: [
			"Oca",
			"Şbt",
			"Mrt",
			"Nsn",
			"Mys",
			"Hzr",
			"Tmz",
			"Ağt",
			"Eyl",
			"Ekm",
			"Ksm",
			"Arl"
		],
		today: "Bugün",
		clear: "Temizle",
		dateFormat: "dd.MM.yyyy",
		timeFormat: "hh:mm aa",
		firstDay: 1
	};
}));
//#endregion
//#region ../../node_modules/air-datepicker/locale/uk.js
var require_uk = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.default = void 0;
	exports.default = {
		days: [
			"Неділя",
			"Понеділок",
			"Вівторок",
			"Середа",
			"Четвер",
			"П’ятниця",
			"Субота"
		],
		daysShort: [
			"Нед",
			"Пнд",
			"Вів",
			"Срд",
			"Чтв",
			"Птн",
			"Сбт"
		],
		daysMin: [
			"Нд",
			"Пн",
			"Вт",
			"Ср",
			"Чт",
			"Пт",
			"Сб"
		],
		months: [
			"Січень",
			"Лютий",
			"Березень",
			"Квітень",
			"Травень",
			"Червень",
			"Липень",
			"Серпень",
			"Вересень",
			"Жовтень",
			"Листопад",
			"Грудень"
		],
		monthsShort: [
			"Січ",
			"Лют",
			"Бер",
			"Кві",
			"Тра",
			"Чер",
			"Лип",
			"Сер",
			"Вер",
			"Жов",
			"Лис",
			"Гру"
		],
		today: "Сьогодні",
		clear: "Очистити",
		dateFormat: "dd.MM.yyyy",
		timeFormat: "HH:mm",
		firstDay: 1
	};
}));
//#endregion
//#region ../../node_modules/air-datepicker/locale/zh.js
var require_zh = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.default = void 0;
	exports.default = {
		days: [
			"周日",
			"周一",
			"周二",
			"周三",
			"周四",
			"周五",
			"周六"
		],
		daysShort: [
			"日",
			"一",
			"二",
			"三",
			"四",
			"五",
			"六"
		],
		daysMin: [
			"日",
			"一",
			"二",
			"三",
			"四",
			"五",
			"六"
		],
		months: [
			"一月",
			"二月",
			"三月",
			"四月",
			"五月",
			"六月",
			"七月",
			"八月",
			"九月",
			"十月",
			"十一月",
			"十二月"
		],
		monthsShort: [
			"一月",
			"二月",
			"三月",
			"四月",
			"五月",
			"六月",
			"七月",
			"八月",
			"九月",
			"十月",
			"十一月",
			"十二月"
		],
		today: "今天",
		clear: "清除",
		dateFormat: "yyyy-MM-dd",
		timeFormat: "HH:mm",
		firstDay: 1
	};
}));
//#endregion
//#region src/date/helper.ts
var import_ar = /* @__PURE__ */ __toESM(require_ar(), 1);
var import_bg = /* @__PURE__ */ __toESM(require_bg(), 1);
var import_ca = /* @__PURE__ */ __toESM(require_ca(), 1);
var import_cs = /* @__PURE__ */ __toESM(require_cs(), 1);
var import_da = /* @__PURE__ */ __toESM(require_da(), 1);
var import_de = /* @__PURE__ */ __toESM(require_de(), 1);
var import_el = /* @__PURE__ */ __toESM(require_el(), 1);
var import_en = /* @__PURE__ */ __toESM(require_en(), 1);
var import_es = /* @__PURE__ */ __toESM(require_es(), 1);
var import_eu = /* @__PURE__ */ __toESM(require_eu(), 1);
var import_fi = /* @__PURE__ */ __toESM(require_fi(), 1);
var import_fr = /* @__PURE__ */ __toESM(require_fr(), 1);
var import_hr = /* @__PURE__ */ __toESM(require_hr(), 1);
var import_hu = /* @__PURE__ */ __toESM(require_hu(), 1);
var import_id = /* @__PURE__ */ __toESM(require_id(), 1);
var import_it = /* @__PURE__ */ __toESM(require_it(), 1);
var import_ja = /* @__PURE__ */ __toESM(require_ja(), 1);
var import_ko = /* @__PURE__ */ __toESM(require_ko(), 1);
var import_nb = /* @__PURE__ */ __toESM(require_nb(), 1);
var import_nl = /* @__PURE__ */ __toESM(require_nl(), 1);
var import_th = /* @__PURE__ */ __toESM(require_th(), 1);
var import_pl = /* @__PURE__ */ __toESM(require_pl(), 1);
var import_pt_BR = /* @__PURE__ */ __toESM(require_pt_BR(), 1);
var import_pt = /* @__PURE__ */ __toESM(require_pt(), 1);
var import_ro = /* @__PURE__ */ __toESM(require_ro(), 1);
var import_ru = /* @__PURE__ */ __toESM(require_ru(), 1);
var import_si = /* @__PURE__ */ __toESM(require_si(), 1);
var import_sk = /* @__PURE__ */ __toESM(require_sk(), 1);
var import_sl = /* @__PURE__ */ __toESM(require_sl(), 1);
var import_sv = /* @__PURE__ */ __toESM(require_sv(), 1);
var import_tr = /* @__PURE__ */ __toESM(require_tr(), 1);
var import_uk = /* @__PURE__ */ __toESM(require_uk(), 1);
var import_zh = /* @__PURE__ */ __toESM(require_zh(), 1);
var normalizeAdLocale = (locale) => {
	return "default" in locale ? locale.default : locale;
};
var LOCALE_MAP = {
	ar: {
		label: "Arabic",
		adLocale: normalizeAdLocale(import_ar.default),
		formatLocale: dateFns.ar
	},
	bg: {
		label: "Bulgarian",
		adLocale: normalizeAdLocale(import_bg.default),
		formatLocale: dateFns.bg
	},
	ca: {
		label: "Catalan",
		adLocale: normalizeAdLocale(import_ca.default),
		formatLocale: dateFns.ca
	},
	cs: {
		label: "Czech",
		adLocale: normalizeAdLocale(import_cs.default),
		formatLocale: dateFns.cs
	},
	da: {
		label: "Danish",
		adLocale: normalizeAdLocale(import_da.default),
		formatLocale: dateFns.da
	},
	de: {
		label: "German",
		adLocale: normalizeAdLocale(import_de.default),
		formatLocale: dateFns.de
	},
	el: {
		label: "Greek",
		adLocale: normalizeAdLocale(import_el.default),
		formatLocale: dateFns.el
	},
	en: {
		label: "English",
		adLocale: normalizeAdLocale(import_en.default),
		formatLocale: dateFns.enUS
	},
	es: {
		label: "Spanish",
		adLocale: normalizeAdLocale(import_es.default),
		formatLocale: dateFns.es
	},
	eu: {
		label: "Basque",
		adLocale: normalizeAdLocale(import_eu.default),
		formatLocale: dateFns.eu
	},
	fi: {
		label: "Finnish",
		adLocale: normalizeAdLocale(import_fi.default),
		formatLocale: dateFns.fi
	},
	fr: {
		label: "French",
		adLocale: normalizeAdLocale(import_fr.default),
		formatLocale: dateFns.fr
	},
	hr: {
		label: "Croatian",
		adLocale: normalizeAdLocale(import_hr.default),
		formatLocale: dateFns.hr
	},
	hu: {
		label: "Hungarian",
		adLocale: normalizeAdLocale(import_hu.default),
		formatLocale: dateFns.hu
	},
	id: {
		label: "Indonesian",
		adLocale: normalizeAdLocale(import_id.default),
		formatLocale: dateFns.id
	},
	it: {
		label: "Italian",
		adLocale: normalizeAdLocale(import_it.default),
		formatLocale: dateFns.it
	},
	ja: {
		label: "Japanese",
		adLocale: normalizeAdLocale(import_ja.default),
		formatLocale: dateFns.ja
	},
	ko: {
		label: "Korean",
		adLocale: normalizeAdLocale(import_ko.default),
		formatLocale: dateFns.ko
	},
	nb: {
		label: "Norwegian Bokmål",
		adLocale: normalizeAdLocale(import_nb.default),
		formatLocale: dateFns.nb
	},
	nl: {
		label: "Dutch",
		adLocale: normalizeAdLocale(import_nl.default),
		formatLocale: dateFns.nl
	},
	pl: {
		label: "Polish",
		adLocale: normalizeAdLocale(import_pl.default),
		formatLocale: dateFns.pl
	},
	"pt-Br": {
		label: "Portuguese",
		adLocale: normalizeAdLocale(import_pt_BR.default),
		formatLocale: dateFns.ptBR
	},
	pt: {
		label: "Portuguese",
		adLocale: normalizeAdLocale(import_pt.default),
		formatLocale: dateFns.pt
	},
	ro: {
		label: "Romanian",
		adLocale: normalizeAdLocale(import_ro.default),
		formatLocale: dateFns.ro
	},
	ru: {
		label: "Russian",
		adLocale: normalizeAdLocale(import_ru.default),
		formatLocale: dateFns.ru
	},
	si: {
		label: "Sinhala",
		adLocale: normalizeAdLocale(import_si.default),
		formatLocale: dateFns.enUS
	},
	sk: {
		label: "Slovak",
		adLocale: normalizeAdLocale(import_sk.default),
		formatLocale: dateFns.sk
	},
	sl: {
		label: "Slovenian",
		adLocale: normalizeAdLocale(import_sl.default),
		formatLocale: dateFns.sl
	},
	sv: {
		label: "Swedish",
		adLocale: normalizeAdLocale(import_sv.default),
		formatLocale: dateFns.sv
	},
	th: {
		label: "Thai",
		adLocale: normalizeAdLocale(import_th.default),
		formatLocale: dateFns.th
	},
	tr: {
		label: "Turkish",
		adLocale: normalizeAdLocale(import_tr.default),
		formatLocale: dateFns.tr
	},
	uk: {
		label: "Ukrainian",
		adLocale: normalizeAdLocale(import_uk.default),
		formatLocale: dateFns.uk
	},
	zh: {
		label: "Chinese",
		adLocale: normalizeAdLocale(import_zh.default),
		formatLocale: dateFns.zhCN
	}
};
var getAirDatepickerLocale = (locale) => {
	const data = LOCALE_MAP[locale];
	if (!data) throw new Error(`Unsupported locale: ${locale}`);
	return data;
};
var airDatepickerCss = `.air-datepicker-cell.-year-.-other-decade-,.air-datepicker-cell.-day-.-other-month-{color:var(--adp-color-other-month)}.air-datepicker-cell.-year-.-other-decade-:hover,.air-datepicker-cell.-day-.-other-month-:hover{color:var(--adp-color-other-month-hover)}.-disabled-.-focus-.air-datepicker-cell.-year-.-other-decade-,.-disabled-.-focus-.air-datepicker-cell.-day-.-other-month-{color:var(--adp-color-other-month)}.-selected-.air-datepicker-cell.-year-.-other-decade-,.-selected-.air-datepicker-cell.-day-.-other-month-{color:#fff;background:var(--adp-background-color-selected-other-month)}.-selected-.-focus-.air-datepicker-cell.-year-.-other-decade-,.-selected-.-focus-.air-datepicker-cell.-day-.-other-month-{background:var(--adp-background-color-selected-other-month-focused)}.-in-range-.air-datepicker-cell.-year-.-other-decade-,.-in-range-.air-datepicker-cell.-day-.-other-month-{background-color:var(--adp-background-color-in-range);color:var(--adp-color)}.-in-range-.-focus-.air-datepicker-cell.-year-.-other-decade-,.-in-range-.-focus-.air-datepicker-cell.-day-.-other-month-{background-color:var(--adp-background-color-in-range-focused)}.air-datepicker-cell.-year-.-other-decade-:empty,.air-datepicker-cell.-day-.-other-month-:empty{background:none;border:none}.air-datepicker-cell{border-radius:var(--adp-cell-border-radius);box-sizing:border-box;cursor:pointer;display:flex;position:relative;align-items:center;justify-content:center;z-index:1}.air-datepicker-cell.-focus-{background:var(--adp-cell-background-color-hover)}.air-datepicker-cell.-current-{color:var(--adp-color-current-date)}.air-datepicker-cell.-current-.-focus-{color:var(--adp-color)}.air-datepicker-cell.-current-.-in-range-{color:var(--adp-color-current-date)}.air-datepicker-cell.-disabled-{cursor:default;color:var(--adp-color-disabled)}.air-datepicker-cell.-disabled-.-focus-{color:var(--adp-color-disabled)}.air-datepicker-cell.-disabled-.-in-range-{color:var(--adp-color-disabled-in-range)}.air-datepicker-cell.-disabled-.-current-.-focus-{color:var(--adp-color-disabled)}.air-datepicker-cell.-in-range-{background:var(--adp-cell-background-color-in-range);border-radius:0}.air-datepicker-cell.-in-range-:hover,.air-datepicker-cell.-in-range-.-focus-{background:var(--adp-cell-background-color-in-range-hover)}.air-datepicker-cell.-range-from-{border:1px solid var(--adp-cell-border-color-in-range);background-color:var(--adp-cell-background-color-in-range);border-radius:var(--adp-cell-border-radius) 0 0 var(--adp-cell-border-radius)}.air-datepicker-cell.-range-to-{border:1px solid var(--adp-cell-border-color-in-range);background-color:var(--adp-cell-background-color-in-range);border-radius:0 var(--adp-cell-border-radius) var(--adp-cell-border-radius) 0}.air-datepicker-cell.-range-to-.-range-from-{border-radius:var(--adp-cell-border-radius)}.air-datepicker-cell.-selected-{color:#fff;border:none;background:var(--adp-cell-background-color-selected)}.air-datepicker-cell.-selected-.-current-{color:#fff;background:var(--adp-cell-background-color-selected)}.air-datepicker-cell.-selected-.-focus-{background:var(--adp-cell-background-color-selected-hover)}
.air-datepicker-body{transition:all var(--adp-transition-duration) var(--adp-transition-ease)}.air-datepicker-body.-hidden-{display:none}.air-datepicker-body--day-names{display:grid;grid-template-columns:repeat(7, var(--adp-day-cell-width));margin:8px 0 3px}.air-datepicker-body--day-name{color:var(--adp-day-name-color);display:flex;align-items:center;justify-content:center;flex:1;text-align:center;text-transform:uppercase;font-size:.8em}.air-datepicker-body--day-name.-clickable-{cursor:pointer}.air-datepicker-body--day-name.-clickable-:hover{color:var(--adp-day-name-color-hover)}.air-datepicker-body--cells{display:grid}.air-datepicker-body--cells.-days-{grid-template-columns:repeat(7, var(--adp-day-cell-width));grid-auto-rows:var(--adp-day-cell-height)}.air-datepicker-body--cells.-months-{grid-template-columns:repeat(3, 1fr);grid-auto-rows:var(--adp-month-cell-height)}.air-datepicker-body--cells.-years-{grid-template-columns:repeat(4, 1fr);grid-auto-rows:var(--adp-year-cell-height)}
.air-datepicker-nav{display:flex;justify-content:space-between;border-bottom:1px solid var(--adp-border-color-inner);min-height:var(--adp-nav-height);padding:var(--adp-padding);box-sizing:content-box}.-only-timepicker- .air-datepicker-nav{display:none}.air-datepicker-nav--title,.air-datepicker-nav--action{display:flex;cursor:pointer;align-items:center;justify-content:center}.air-datepicker-nav--action{width:var(--adp-nav-action-size);border-radius:var(--adp-border-radius);-webkit-user-select:none;-moz-user-select:none;user-select:none}.air-datepicker-nav--action:hover{background:var(--adp-background-color-hover)}.air-datepicker-nav--action:active{background:var(--adp-background-color-active)}.air-datepicker-nav--action.-disabled-{visibility:hidden}.air-datepicker-nav--action svg{width:32px;height:32px}.air-datepicker-nav--action path{fill:none;stroke:var(--adp-nav-arrow-color);stroke-width:2px}.air-datepicker-nav--title{border-radius:var(--adp-border-radius);padding:0 8px}.air-datepicker-nav--title i{font-style:normal;color:var(--adp-nav-color-secondary);margin-left:.3em}.air-datepicker-nav--title:hover{background:var(--adp-background-color-hover)}.air-datepicker-nav--title:active{background:var(--adp-background-color-active)}.air-datepicker-nav--title.-disabled-{cursor:default;background:none}
.air-datepicker-buttons{display:grid;grid-auto-columns:1fr;grid-auto-flow:column}.air-datepicker-button{display:inline-flex;color:var(--adp-btn-color);border-radius:var(--adp-btn-border-radius);cursor:pointer;height:var(--adp-btn-height);border:none;background:rgba(255,255,255,0)}.air-datepicker-button:hover{color:var(--adp-btn-color-hover);background:var(--adp-btn-background-color-hover)}.air-datepicker-button:focus{color:var(--adp-btn-color-hover);background:var(--adp-btn-background-color-hover);outline:none}.air-datepicker-button:active{background:var(--adp-btn-background-color-active)}.air-datepicker-button span{outline:none;display:flex;align-items:center;justify-content:center;width:100%;height:100%}
.air-datepicker-time{display:grid;grid-template-columns:max-content 1fr;grid-column-gap:12px;align-items:center;position:relative;padding:0 var(--adp-time-padding-inner)}.-only-timepicker- .air-datepicker-time{border-top:none}.air-datepicker-time--current{display:flex;align-items:center;flex:1;font-size:14px;text-align:center}.air-datepicker-time--current-colon{margin:0 2px 3px;line-height:1}.air-datepicker-time--current-hours,.air-datepicker-time--current-minutes{line-height:1;font-size:19px;font-family:"Century Gothic",CenturyGothic,AppleGothic,sans-serif;position:relative;z-index:1}.air-datepicker-time--current-hours:after,.air-datepicker-time--current-minutes:after{content:"";background:var(--adp-background-color-hover);border-radius:var(--adp-border-radius);position:absolute;left:-2px;top:-3px;right:-2px;bottom:-2px;z-index:-1;opacity:0}.air-datepicker-time--current-hours.-focus-:after,.air-datepicker-time--current-minutes.-focus-:after{opacity:1}.air-datepicker-time--current-ampm{text-transform:uppercase;align-self:flex-end;color:var(--adp-time-day-period-color);margin-left:6px;font-size:11px;margin-bottom:1px}.air-datepicker-time--row{display:flex;align-items:center;font-size:11px;height:17px;background:linear-gradient(to right, var(--adp-time-track-color), var(--adp-time-track-color)) left 50%/100% var(--adp-time-track-height) no-repeat}.air-datepicker-time--row:first-child{margin-bottom:4px}.air-datepicker-time--row input[type=range]{background:none;cursor:pointer;flex:1;height:100%;width:100%;padding:0;margin:0;-webkit-appearance:none}.air-datepicker-time--row input[type=range]::-webkit-slider-thumb{-webkit-appearance:none}.air-datepicker-time--row input[type=range]::-ms-tooltip{display:none}.air-datepicker-time--row input[type=range]:hover::-webkit-slider-thumb{border-color:var(--adp-time-track-color-hover)}.air-datepicker-time--row input[type=range]:hover::-moz-range-thumb{border-color:var(--adp-time-track-color-hover)}.air-datepicker-time--row input[type=range]:hover::-ms-thumb{border-color:var(--adp-time-track-color-hover)}.air-datepicker-time--row input[type=range]:focus{outline:none}.air-datepicker-time--row input[type=range]:focus::-webkit-slider-thumb{background:var(--adp-cell-background-color-selected);border-color:var(--adp-cell-background-color-selected)}.air-datepicker-time--row input[type=range]:focus::-moz-range-thumb{background:var(--adp-cell-background-color-selected);border-color:var(--adp-cell-background-color-selected)}.air-datepicker-time--row input[type=range]:focus::-ms-thumb{background:var(--adp-cell-background-color-selected);border-color:var(--adp-cell-background-color-selected)}.air-datepicker-time--row input[type=range]::-webkit-slider-thumb{box-sizing:border-box;height:12px;width:12px;border-radius:3px;border:1px solid var(--adp-time-track-color);background:#fff;cursor:pointer;-webkit-transition:background var(--adp-transition-duration);transition:background var(--adp-transition-duration)}.air-datepicker-time--row input[type=range]::-moz-range-thumb{box-sizing:border-box;height:12px;width:12px;border-radius:3px;border:1px solid var(--adp-time-track-color);background:#fff;cursor:pointer;-moz-transition:background var(--adp-transition-duration);transition:background var(--adp-transition-duration)}.air-datepicker-time--row input[type=range]::-ms-thumb{box-sizing:border-box;height:12px;width:12px;border-radius:3px;border:1px solid var(--adp-time-track-color);background:#fff;cursor:pointer;-ms-transition:background var(--adp-transition-duration);transition:background var(--adp-transition-duration)}.air-datepicker-time--row input[type=range]::-webkit-slider-thumb{margin-top:calc(var(--adp-time-thumb-size)/2*-1)}.air-datepicker-time--row input[type=range]::-webkit-slider-runnable-track{border:none;height:var(--adp-time-track-height);cursor:pointer;color:rgba(0,0,0,0);background:rgba(0,0,0,0)}.air-datepicker-time--row input[type=range]::-moz-range-track{border:none;height:var(--adp-time-track-height);cursor:pointer;color:rgba(0,0,0,0);background:rgba(0,0,0,0)}.air-datepicker-time--row input[type=range]::-ms-track{border:none;height:var(--adp-time-track-height);cursor:pointer;color:rgba(0,0,0,0);background:rgba(0,0,0,0)}.air-datepicker-time--row input[type=range]::-ms-fill-lower{background:rgba(0,0,0,0)}.air-datepicker-time--row input[type=range]::-ms-fill-upper{background:rgba(0,0,0,0)}
.air-datepicker{--adp-font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";--adp-font-size: 14px;--adp-width: 246px;--adp-z-index: 100;--adp-padding: 4px;--adp-grid-areas: "nav" "body" "timepicker" "buttons";--adp-transition-duration: .3s;--adp-transition-ease: ease-out;--adp-transition-offset: 8px;--adp-background-color: #fff;--adp-background-color-hover: #f0f0f0;--adp-background-color-active: #eaeaea;--adp-background-color-in-range: rgba(92, 196, 239, .1);--adp-background-color-in-range-focused: rgba(92, 196, 239, .2);--adp-background-color-selected-other-month-focused: #8ad5f4;--adp-background-color-selected-other-month: #a2ddf6;--adp-color: #4a4a4a;--adp-color-secondary: #9c9c9c;--adp-accent-color: #4eb5e6;--adp-color-current-date: var(--adp-accent-color);--adp-color-other-month: #dedede;--adp-color-disabled: #aeaeae;--adp-color-disabled-in-range: #939393;--adp-color-other-month-hover: #c5c5c5;--adp-border-color: #dbdbdb;--adp-border-color-inner: #efefef;--adp-border-radius: 4px;--adp-border-color-inline: #d7d7d7;--adp-nav-height: 32px;--adp-nav-arrow-color: var(--adp-color-secondary);--adp-nav-action-size: 32px;--adp-nav-color-secondary: var(--adp-color-secondary);--adp-day-name-color: #ff9a19;--adp-day-name-color-hover: #8ad5f4;--adp-day-cell-width: 1fr;--adp-day-cell-height: 32px;--adp-month-cell-height: 42px;--adp-year-cell-height: 56px;--adp-pointer-size: 10px;--adp-poiner-border-radius: 2px;--adp-pointer-offset: 14px;--adp-cell-border-radius: 4px;--adp-cell-background-color-hover: var(--adp-background-color-hover);--adp-cell-background-color-selected: #5cc4ef;--adp-cell-background-color-selected-hover: #45bced;--adp-cell-background-color-in-range: rgba(92, 196, 239, 0.1);--adp-cell-background-color-in-range-hover: rgba(92, 196, 239, 0.2);--adp-cell-border-color-in-range: var(--adp-cell-background-color-selected);--adp-btn-height: 32px;--adp-btn-color: var(--adp-accent-color);--adp-btn-color-hover: var(--adp-color);--adp-btn-border-radius: var(--adp-border-radius);--adp-btn-background-color-hover: var(--adp-background-color-hover);--adp-btn-background-color-active: var(--adp-background-color-active);--adp-time-track-height: 1px;--adp-time-track-color: #dedede;--adp-time-track-color-hover: #b1b1b1;--adp-time-thumb-size: 12px;--adp-time-padding-inner: 10px;--adp-time-day-period-color: var(--adp-color-secondary);--adp-mobile-font-size: 16px;--adp-mobile-nav-height: 40px;--adp-mobile-width: 320px;--adp-mobile-day-cell-height: 38px;--adp-mobile-month-cell-height: 48px;--adp-mobile-year-cell-height: 64px}.air-datepicker-overlay{--adp-overlay-background-color: rgba(0, 0, 0, .3);--adp-overlay-transition-duration: .3s;--adp-overlay-transition-ease: ease-out;--adp-overlay-z-index: 99}
.air-datepicker{background:var(--adp-background-color);border:1px solid var(--adp-border-color);box-shadow:0 4px 12px rgba(0,0,0,.15);border-radius:var(--adp-border-radius);box-sizing:content-box;display:grid;grid-template-columns:1fr;grid-template-rows:repeat(4, max-content);grid-template-areas:var(--adp-grid-areas);font-family:var(--adp-font-family),sans-serif;font-size:var(--adp-font-size);color:var(--adp-color);width:var(--adp-width);position:absolute;transition:opacity var(--adp-transition-duration) var(--adp-transition-ease),transform var(--adp-transition-duration) var(--adp-transition-ease);z-index:var(--adp-z-index)}.air-datepicker:not(.-custom-position-){opacity:0}.air-datepicker.-from-top-{transform:translateY(calc(var(--adp-transition-offset) * -1))}.air-datepicker.-from-right-{transform:translateX(var(--adp-transition-offset))}.air-datepicker.-from-bottom-{transform:translateY(var(--adp-transition-offset))}.air-datepicker.-from-left-{transform:translateX(calc(var(--adp-transition-offset) * -1))}.air-datepicker.-active-:not(.-custom-position-){transform:translate(0, 0);opacity:1}.air-datepicker.-active-.-custom-position-{transition:none}.air-datepicker.-inline-{border-color:var(--adp-border-color-inline);box-shadow:none;position:static;left:auto;right:auto;opacity:1;transform:none}.air-datepicker.-inline- .air-datepicker--pointer{display:none}.air-datepicker.-is-mobile-{--adp-font-size: var(--adp-mobile-font-size);--adp-day-cell-height: var(--adp-mobile-day-cell-height);--adp-month-cell-height: var(--adp-mobile-month-cell-height);--adp-year-cell-height: var(--adp-mobile-year-cell-height);--adp-nav-height: var(--adp-mobile-nav-height);--adp-nav-action-size: var(--adp-mobile-nav-height);position:fixed;width:var(--adp-mobile-width);border:none}.air-datepicker.-is-mobile- *{-webkit-tap-highlight-color:rgba(0,0,0,0)}.air-datepicker.-is-mobile- .air-datepicker--pointer{display:none}.air-datepicker.-is-mobile-:not(.-custom-position-){transform:translate(-50%, calc(-50% + var(--adp-transition-offset)))}.air-datepicker.-is-mobile-.-active-:not(.-custom-position-){transform:translate(-50%, -50%)}.air-datepicker.-custom-position-{transition:none}.air-datepicker-global-container{position:absolute;left:0;top:0}.air-datepicker--pointer{--pointer-half-size: calc(var(--adp-pointer-size) / 2);position:absolute;width:var(--adp-pointer-size);height:var(--adp-pointer-size);z-index:-1}.air-datepicker--pointer:after{content:"";position:absolute;background:#fff;border-top:1px solid var(--adp-border-color-inline);border-right:1px solid var(--adp-border-color-inline);border-top-right-radius:var(--adp-poiner-border-radius);width:var(--adp-pointer-size);height:var(--adp-pointer-size);box-sizing:border-box}.-top-left- .air-datepicker--pointer,.-top-center- .air-datepicker--pointer,.-top-right- .air-datepicker--pointer,[data-popper-placement^=top] .air-datepicker--pointer{top:calc(100% - var(--pointer-half-size) + 1px)}.-top-left- .air-datepicker--pointer:after,.-top-center- .air-datepicker--pointer:after,.-top-right- .air-datepicker--pointer:after,[data-popper-placement^=top] .air-datepicker--pointer:after{transform:rotate(135deg)}.-right-top- .air-datepicker--pointer,.-right-center- .air-datepicker--pointer,.-right-bottom- .air-datepicker--pointer,[data-popper-placement^=right] .air-datepicker--pointer{right:calc(100% - var(--pointer-half-size) + 1px)}.-right-top- .air-datepicker--pointer:after,.-right-center- .air-datepicker--pointer:after,.-right-bottom- .air-datepicker--pointer:after,[data-popper-placement^=right] .air-datepicker--pointer:after{transform:rotate(225deg)}.-bottom-left- .air-datepicker--pointer,.-bottom-center- .air-datepicker--pointer,.-bottom-right- .air-datepicker--pointer,[data-popper-placement^=bottom] .air-datepicker--pointer{bottom:calc(100% - var(--pointer-half-size) + 1px)}.-bottom-left- .air-datepicker--pointer:after,.-bottom-center- .air-datepicker--pointer:after,.-bottom-right- .air-datepicker--pointer:after,[data-popper-placement^=bottom] .air-datepicker--pointer:after{transform:rotate(315deg)}.-left-top- .air-datepicker--pointer,.-left-center- .air-datepicker--pointer,.-left-bottom- .air-datepicker--pointer,[data-popper-placement^=left] .air-datepicker--pointer{left:calc(100% - var(--pointer-half-size) + 1px)}.-left-top- .air-datepicker--pointer:after,.-left-center- .air-datepicker--pointer:after,.-left-bottom- .air-datepicker--pointer:after,[data-popper-placement^=left] .air-datepicker--pointer:after{transform:rotate(45deg)}.-top-left- .air-datepicker--pointer,.-bottom-left- .air-datepicker--pointer{left:var(--adp-pointer-offset)}.-top-right- .air-datepicker--pointer,.-bottom-right- .air-datepicker--pointer{right:var(--adp-pointer-offset)}.-top-center- .air-datepicker--pointer,.-bottom-center- .air-datepicker--pointer{left:calc(50% - var(--adp-pointer-size)/2)}.-left-top- .air-datepicker--pointer,.-right-top- .air-datepicker--pointer{top:var(--adp-pointer-offset)}.-left-bottom- .air-datepicker--pointer,.-right-bottom- .air-datepicker--pointer{bottom:var(--adp-pointer-offset)}.-left-center- .air-datepicker--pointer,.-right-center- .air-datepicker--pointer{top:calc(50% - var(--adp-pointer-size)/2)}.air-datepicker--navigation{grid-area:nav}.air-datepicker--content{box-sizing:content-box;padding:var(--adp-padding);grid-area:body}.-only-timepicker- .air-datepicker--content{display:none}.air-datepicker--time{grid-area:timepicker}.air-datepicker--buttons{grid-area:buttons}.air-datepicker--buttons,.air-datepicker--time{padding:var(--adp-padding);border-top:1px solid var(--adp-border-color-inner)}.air-datepicker-overlay{position:fixed;background:var(--adp-overlay-background-color);left:0;top:0;width:0;height:0;opacity:0;transition:opacity var(--adp-overlay-transition-duration) var(--adp-overlay-transition-ease),left 0s,height 0s,width 0s;transition-delay:0s,var(--adp-overlay-transition-duration),var(--adp-overlay-transition-duration),var(--adp-overlay-transition-duration);z-index:var(--adp-overlay-z-index)}.air-datepicker-overlay.-active-{opacity:1;width:100%;height:100%;transition:opacity var(--adp-overlay-transition-duration) var(--adp-overlay-transition-ease),height 0s,width 0s}`;
var injectStyles = (css) => {
	if (typeof document !== "undefined") {
		const styleElementId = "pdfme-air-datepicker-styles";
		if (!document.getElementById(styleElementId)) {
			const style = document.createElement("style");
			style.id = styleElementId;
			style.type = "text/css";
			style.appendChild(document.createTextNode(css));
			document.head.appendChild(style);
		}
	}
};
var strDateToDate = (strDate, type) => {
	if (!strDate.trim()) return /* @__PURE__ */ new Date();
	if (type === "time") {
		if (/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}$/.test(strDate)) return new Date(strDate.replace(/\//g, "-").replace(" ", "T"));
		return /* @__PURE__ */ new Date(`2021-01-01T${strDate}`);
	}
	return new Date(strDate);
};
var getFormat = (type, locale) => {
	switch (type) {
		case "date": return locale.adLocale.dateFormat;
		case "time": return "HH:mm";
		case "dateTime": return `${locale.adLocale.dateFormat} ${locale.adLocale.timeFormat}`;
	}
};
var isValidDateFormat = (formatString, locale) => {
	if (typeof formatString !== "string") return false;
	const normalizedFormat = formatString.trim();
	if (!normalizedFormat || normalizedFormat === "undefined") return false;
	try {
		format(/* @__PURE__ */ new Date(0), normalizedFormat, { locale: locale.formatLocale });
		return true;
	} catch {
		return false;
	}
};
var getSafeFormat = (type, schema, locale) => {
	return isValidDateFormat(schema.format, locale) ? schema.format.trim() : getFormat(type, locale);
};
var getFmtValue = (value, type, schema, locale) => {
	const formatString = getSafeFormat(type, schema, locale);
	return value ? format(strDateToDate(value, type), formatString, { locale: locale.formatLocale }) : "";
};
var getFmtContent = (date, type) => {
	const fmt = (() => {
		switch (type) {
			case "date": return "yyyy/MM/dd";
			case "time": return "HH:mm";
			case "dateTime": return "yyyy/MM/dd HH:mm";
		}
	})();
	return date ? format(date, fmt) : "";
};
var getPlugin = ({ type, icon }) => {
	const defaultLocale = "en";
	return {
		ui: async (arg) => {
			const { schema, value, onChange, rootElement, mode, options, i18n } = arg;
			const locale = getAirDatepickerLocale(schema.locale || options.lang || defaultLocale);
			const formatString = getSafeFormat(type, schema, locale);
			const textElement = document.createElement("div");
			const textElementStyle = {
				width: `${schema.width}mm`,
				height: `${schema.height}mm`,
				display: "flex",
				flexDirection: "column",
				justifyContent: mapVerticalAlignToFlex(VERTICAL_ALIGN_MIDDLE)
			};
			Object.assign(textElement.style, textElementStyle);
			await textSchema.ui({
				...arg,
				rootElement: textElement,
				mode: "viewer",
				value: getFmtValue(value, type, schema, locale),
				schema: {
					...schema,
					verticalAlignment: VERTICAL_ALIGN_MIDDLE,
					lineHeight: 1
				}
			});
			injectStyles(airDatepickerCss);
			const beforeRemoveEvent = new Event("beforeRemove");
			rootElement.dispatchEvent(beforeRemoveEvent);
			const input = document.createElement("input");
			Object.assign(input.style, {
				visibility: "hidden",
				position: "absolute"
			});
			const commitChange = (date) => {
				if (onChange) onChange({
					key: "content",
					value: getFmtContent(date, type)
				});
			};
			const adButtons = [{
				content: i18n("cancel"),
				onClick: (datepicker) => {
					datepicker.hide();
				}
			}, {
				content: i18n("clear"),
				onClick: (datepicker) => {
					datepicker.hide();
					commitChange(null);
				}
			}];
			if (type !== "date") adButtons.push({
				content: i18n("set"),
				onClick: (datepicker) => {
					datepicker.hide();
					commitChange(datepicker.selectedDates.length ? datepicker.selectedDates[0] : null);
				}
			});
			const airDatepicker = new AirDatepicker(input, {
				locale: locale.adLocale,
				selectedDates: value.trim() ? [strDateToDate(value, type)] : [],
				dateFormat: (date) => format(date, formatString, { locale: locale.formatLocale }),
				timepicker: type !== "date",
				onlyTimepicker: type === "time",
				isMobile: window.innerWidth < 768,
				buttons: adButtons,
				position({ $datepicker, $target, $pointer, done }) {
					$datepicker.style.position = "fixed";
					const offset = 5;
					const scrollY = window.scrollY;
					const scrollX = window.scrollX;
					const targetRect = $target.getBoundingClientRect();
					const dpHeight = $datepicker.offsetHeight;
					const dpWidth = $datepicker.offsetWidth;
					const spaceBelow = window.innerHeight - targetRect.bottom;
					const spaceAbove = targetRect.top;
					const showAbove = spaceBelow < dpHeight + offset && spaceAbove > dpHeight;
					let top = showAbove ? targetRect.top + scrollY - dpHeight - offset : targetRect.bottom + scrollY + offset;
					let left = targetRect.left + scrollX;
					if (left + dpWidth > window.innerWidth) left = window.innerWidth - dpWidth - 10;
					$datepicker.style.position = "absolute";
					$datepicker.style.top = `${top}px`;
					$datepicker.style.left = `${left}px`;
					if ($pointer) {
						$pointer.style.display = "block";
						$pointer.style.position = "absolute";
						$pointer.style.left = "10px";
						$pointer.style.top = showAbove ? "calc(100% - 5px)" : "-5px";
						$pointer.style.transform = showAbove ? "rotate(135deg)" : "rotate(-45deg)";
					}
					return function completeHide() {
						done();
					};
				},
				onSelect: ({ datepicker }) => {
					if (type === "date") {
						commitChange(datepicker.selectedDates.length ? datepicker.selectedDates[0] : null);
						datepicker.hide();
					}
				}
			});
			rootElement.addEventListener("beforeRemove", () => {
				if (isEditable(mode, schema)) airDatepicker.destroy();
			});
			textElement.addEventListener("click", () => {
				if (isEditable(mode, schema)) airDatepicker.show();
			});
			rootElement.appendChild(input);
			rootElement.appendChild(textElement);
		},
		pdf: (arg) => {
			const { schema, value, options } = arg;
			if (!value) return void 0;
			const locale = getAirDatepickerLocale(schema.locale || options.lang || defaultLocale);
			return textSchema.pdf({
				...arg,
				value: getFmtValue(value, type, schema, locale),
				schema: {
					...schema,
					verticalAlignment: VERTICAL_ALIGN_MIDDLE,
					lineHeight: 1
				}
			});
		},
		propPanel: {
			schema: ({ options, i18n, activeSchema, changeSchemas }) => {
				const font = options.font || { [DEFAULT_FONT_NAME]: {
					data: "",
					fallback: true
				} };
				const fontNames = Object.keys(font);
				const fallbackFontName = getFallbackFontName(font);
				const activeDateSchema = activeSchema;
				const locale = getAirDatepickerLocale(activeDateSchema.locale || options.lang || defaultLocale);
				const defaultFormat = getFormat(type, locale);
				const safeFormat = getSafeFormat(type, activeDateSchema, locale);
				const schemaChanges = [];
				if (activeDateSchema.locale === void 0 && activeDateSchema.locale !== options.lang) schemaChanges.push({
					schemaId: activeSchema.id,
					key: "locale",
					value: options.lang
				});
				if (activeDateSchema.format !== safeFormat) schemaChanges.push({
					schemaId: activeSchema.id,
					key: "format",
					value: safeFormat
				});
				if (schemaChanges.length > 0) changeSchemas(schemaChanges);
				const formatter = getExtraFormatterSchema(i18n);
				formatter.buttons = formatter.buttons.filter((button) => button.key === Formatter.ALIGNMENT);
				const validateDateTimeFormat = (_rule, formatString) => isValidDateFormat(formatString, locale);
				const localeOptions = Object.keys(LOCALE_MAP).map((lc) => ({
					label: `${lc} (${LOCALE_MAP[lc].label})`,
					value: lc
				}));
				return {
					format: {
						title: i18n("schemas.date.format"),
						type: "string",
						default: safeFormat,
						placeholder: defaultFormat,
						rules: [{
							validator: validateDateTimeFormat,
							message: i18n("validation.dateTimeFormat")
						}],
						span: 24
					},
					fontName: {
						title: i18n("schemas.text.fontName"),
						type: "string",
						widget: "select",
						default: fallbackFontName,
						placeholder: fallbackFontName,
						props: { options: fontNames.map((name) => ({
							label: name,
							value: name
						})) },
						span: 12
					},
					fontSize: {
						title: i18n("schemas.text.size"),
						type: "number",
						widget: "inputNumber",
						span: 6,
						props: { min: 0 }
					},
					characterSpacing: {
						title: i18n("schemas.text.spacing"),
						type: "number",
						widget: "inputNumber",
						span: 6,
						props: { min: 0 }
					},
					formatter,
					fontColor: {
						title: i18n("schemas.textColor"),
						type: "string",
						widget: "color",
						props: { disabledAlpha: true },
						rules: [{
							pattern: HEX_COLOR_PATTERN,
							message: i18n("validation.hexColor")
						}]
					},
					backgroundColor: {
						title: i18n("schemas.bgColor"),
						type: "string",
						widget: "color",
						props: { disabledAlpha: true },
						rules: [{
							pattern: HEX_COLOR_PATTERN,
							message: i18n("validation.hexColor")
						}]
					},
					locale: {
						title: i18n("schemas.date.locale"),
						type: "string",
						widget: "select",
						props: { options: localeOptions },
						span: 16
					}
				};
			},
			defaultSchema: {
				name: "",
				format: getFormat(type, getAirDatepickerLocale(defaultLocale)),
				type,
				content: getFmtContent(/* @__PURE__ */ new Date(), type),
				position: {
					x: 0,
					y: 0
				},
				width: 50,
				height: 10,
				rotate: 0,
				alignment: DEFAULT_ALIGNMENT,
				fontSize: 13,
				characterSpacing: 0,
				fontColor: DEFAULT_FONT_COLOR,
				fontName: void 0,
				backgroundColor: "",
				locale: void 0,
				opacity: 1
			}
		},
		icon
	};
};
var dateTime_default = getPlugin({
	type: "dateTime",
	icon: createSvgStr(CalendarClock)
});
var date_default = getPlugin({
	type: "date",
	icon: createSvgStr(Calendar)
});
var time_default = getPlugin({
	type: "time",
	icon: createSvgStr(Clock)
});
//#endregion
//#region src/select/index.ts
var selectIcon = createSvgStr(ChevronDown);
var addOptions = (props) => {
	const { rootElement, changeSchemas, activeSchema, i18n } = props;
	rootElement.style.width = "100%";
	const selectSchema = activeSchema;
	const currentOptions = selectSchema.options ? [...selectSchema.options] : [];
	const inputStyle = {
		width: "100%",
		padding: "6.25px 11px",
		border: "1px solid #ccc",
		borderRadius: "4px"
	};
	const buttonStyle = {
		border: "none",
		borderRadius: "4px",
		cursor: "pointer"
	};
	const updateSchemas = () => {
		changeSchemas([{
			key: "options",
			value: currentOptions,
			schemaId: activeSchema.id
		}, {
			key: "content",
			value: currentOptions[0] || "",
			schemaId: activeSchema.id
		}]);
	};
	const formContainer = document.createElement("div");
	Object.assign(formContainer.style, {
		width: "100%",
		display: "flex",
		alignItems: "center",
		marginBottom: "10px"
	});
	const input = document.createElement("input");
	input.type = "text";
	input.placeholder = i18n("schemas.select.optionPlaceholder");
	Object.assign(input.style, inputStyle, { marginRight: "10px" });
	const addButton = document.createElement("button");
	addButton.textContent = "+";
	Object.assign(addButton.style, buttonStyle, {
		width: "25px",
		height: "25px",
		padding: "4px 8px"
	});
	addButton.addEventListener("click", () => {
		const newValue = input.value.trim();
		if (newValue) {
			currentOptions.push(newValue);
			updateSchemas();
			renderOptions();
			input.value = "";
		}
	});
	formContainer.appendChild(input);
	formContainer.appendChild(addButton);
	const optionsList = document.createElement("ul");
	Object.assign(optionsList.style, {
		listStyle: "none",
		padding: "0"
	});
	const renderOptions = () => {
		optionsList.innerHTML = "";
		currentOptions.forEach((option, index) => {
			const li = document.createElement("li");
			Object.assign(li.style, {
				display: "flex",
				alignItems: "center",
				marginBottom: "5px"
			});
			const optionInput = document.createElement("input");
			optionInput.type = "text";
			optionInput.value = option;
			Object.assign(optionInput.style, inputStyle, { marginRight: "10px" });
			optionInput.addEventListener("change", () => {
				currentOptions[index] = optionInput.value;
				updateSchemas();
			});
			const removeButton = document.createElement("button");
			removeButton.textContent = "x";
			Object.assign(removeButton.style, buttonStyle, { padding: "4px 8px" });
			removeButton.addEventListener("click", () => {
				currentOptions.splice(index, 1);
				updateSchemas();
				renderOptions();
			});
			li.appendChild(optionInput);
			li.appendChild(removeButton);
			optionsList.appendChild(li);
		});
	};
	rootElement.appendChild(formContainer);
	rootElement.appendChild(optionsList);
	renderOptions();
};
var schema$3 = {
	ui: async (arg) => {
		const { schema, value, onChange, rootElement, mode } = arg;
		await textSchema.ui(Object.assign(arg, { mode: "viewer" }));
		if (mode !== "viewer" && !(mode === "form" && schema.readOnly)) {
			const buttonWidth = 30;
			const selectButton = document.createElement("button");
			selectButton.innerHTML = selectIcon;
			const selectButtonStyle = {
				position: "absolute",
				zIndex: -1,
				right: `-${buttonWidth}px`,
				top: "0",
				padding: "0",
				margin: "0",
				cursor: "pointer",
				height: `${buttonWidth}px`,
				width: `${buttonWidth}px`
			};
			Object.assign(selectButton.style, selectButtonStyle);
			rootElement.appendChild(selectButton);
			const selectElement = document.createElement("select");
			const selectElementStyle = {
				opacity: "0",
				position: "absolute",
				width: `calc(100% + ${buttonWidth}px)`,
				height: "100%",
				top: "0",
				left: "0",
				appearance: "initial"
			};
			Object.assign(selectElement.style, selectElementStyle);
			selectElement.value = value;
			selectElement.addEventListener("change", (e) => {
				if (onChange && e.target instanceof HTMLSelectElement) {
					if (onChange) onChange({
						key: "content",
						value: e.target.value
					});
				}
			});
			(Array.isArray(schema.options) ? schema.options : []).forEach((option) => {
				const optionElement = document.createElement("option");
				optionElement.value = option;
				optionElement.textContent = option;
				if (option === value) optionElement.selected = true;
				selectElement.appendChild(optionElement);
			});
			rootElement.appendChild(selectElement);
		}
	},
	pdf: textSchema.pdf,
	propPanel: {
		...textSchema.propPanel,
		widgets: {
			...propPanel$3.widgets,
			addOptions
		},
		schema: (propPanelProps) => {
			if (typeof propPanel$3.schema !== "function") throw Error("Oops, is text schema no longer a function?");
			return {
				...propPanel$3.schema(propPanelProps),
				"-------": {
					type: "void",
					widget: "Divider"
				},
				optionsContainer: {
					title: propPanelProps.i18n("schemas.select.options"),
					type: "string",
					widget: "Card",
					span: 24,
					properties: { options: {
						widget: "addOptions",
						span: 24
					} }
				}
			};
		},
		defaultSchema: {
			...textSchema.propPanel.defaultSchema,
			type: "select",
			content: "option1",
			options: ["option1", "option2"]
		}
	},
	icon: selectIcon
};
//#endregion
//#region src/radioGroup/index.ts
var defaultStroke$1 = "currentColor";
var getCheckedIcon$1 = (stroke = defaultStroke$1) => createSvgStr(CircleDot, { stroke });
var getUncheckedIcon$1 = (stroke = defaultStroke$1) => createSvgStr(Circle, { stroke });
var getIcon$1 = ({ value, color }) => value === "true" ? getCheckedIcon$1(color) : getUncheckedIcon$1(color);
var eventEmitter = new EventTarget();
var radioButtonStates = /* @__PURE__ */ new Map();
var eventListeners = /* @__PURE__ */ new Map();
var schema$2 = {
	ui: (arg) => {
		const { schema, value, onChange, rootElement, mode } = arg;
		const container = document.createElement("div");
		container.style.width = "100%";
		container.style.height = "100%";
		if (onChange) radioButtonStates.set(schema.name, {
			value,
			onChange
		});
		const oldListener = eventListeners.get(schema.name);
		if (oldListener) eventEmitter.removeEventListener(`group-${schema.group}`, oldListener);
		const handleGroupEvent = (event) => {
			if (event.detail !== schema.name) {
				const radioButtonState = radioButtonStates.get(schema.name);
				if (!radioButtonState) return;
				if (radioButtonState.value === "true") radioButtonState.onChange({
					key: "content",
					value: "false"
				});
			}
		};
		eventListeners.set(schema.name, handleGroupEvent);
		eventEmitter.addEventListener(`group-${schema.group}`, handleGroupEvent);
		if (isEditable(mode, schema)) container.addEventListener("click", () => {
			if (value !== "true" && onChange) {
				onChange({
					key: "content",
					value: "true"
				});
				radioButtonStates.set(schema.name, {
					value: "true",
					onChange
				});
				eventEmitter.dispatchEvent(new CustomEvent(`group-${schema.group}`, { detail: schema.name }));
			}
		});
		svgSchema.ui({
			...arg,
			rootElement: container,
			mode: "viewer",
			value: getIcon$1({
				value,
				color: schema.color
			})
		});
		rootElement.appendChild(container);
	},
	pdf: (arg) => svgSchema.pdf(Object.assign(arg, { value: getIcon$1({
		value: arg.value,
		color: arg.schema.color
	}) })),
	propPanel: {
		schema: ({ i18n }) => ({
			color: {
				title: i18n("schemas.color"),
				type: "string",
				widget: "color",
				props: { disabledAlpha: true },
				required: true,
				rules: [{
					pattern: HEX_COLOR_PATTERN,
					message: i18n("validation.hexColor")
				}]
			},
			group: {
				title: i18n("schemas.radioGroup.groupName"),
				type: "string"
			}
		}),
		defaultSchema: {
			name: "",
			type: "radioGroup",
			content: "false",
			position: {
				x: 0,
				y: 0
			},
			width: 8,
			height: 8,
			group: "MyGroup",
			color: "#000000"
		}
	},
	icon: getCheckedIcon$1()
};
//#endregion
//#region src/checkbox/index.ts
var defaultStroke = "currentColor";
var getCheckedIcon = (stroke = defaultStroke) => createSvgStr(SquareCheck, { stroke });
var getUncheckedIcon = (stroke = defaultStroke) => createSvgStr(Square, { stroke });
var getIcon = ({ value, color }) => value === "true" ? getCheckedIcon(color) : getUncheckedIcon(color);
var schema = {
	ui: (arg) => {
		const { schema, value, onChange, rootElement, mode } = arg;
		const container = document.createElement("div");
		container.style.width = "100%";
		container.style.height = "100%";
		if (isEditable(mode, schema)) container.addEventListener("click", () => {
			if (onChange) onChange({
				key: "content",
				value: value === "true" ? "false" : "true"
			});
		});
		svgSchema.ui({
			...arg,
			rootElement: container,
			mode: "viewer",
			value: getIcon({
				value,
				color: schema.color
			})
		});
		rootElement.appendChild(container);
	},
	pdf: (arg) => svgSchema.pdf(Object.assign(arg, { value: getIcon({
		value: arg.value,
		color: arg.schema.color
	}) })),
	propPanel: {
		schema: ({ i18n }) => ({ color: {
			title: i18n("schemas.color"),
			type: "string",
			widget: "color",
			props: { disabledAlpha: true },
			required: true,
			rules: [{
				pattern: HEX_COLOR_PATTERN,
				message: i18n("validation.hexColor")
			}]
		} }),
		defaultSchema: {
			name: "",
			type: "checkbox",
			content: "false",
			position: {
				x: 0,
				y: 0
			},
			width: 8,
			height: 8,
			color: "#000000"
		}
	},
	icon: getCheckedIcon()
};
//#endregion
//#region src/circleMark/index.ts
var HEX_COLOR_REGEXP = new RegExp(HEX_COLOR_PATTERN);
var isSelected = (value) => value === "true";
var hasRenderableStyle = (schema) => schema.width > 0 && schema.height > 0 && schema.borderWidth > 0 && typeof schema.color === "string" && HEX_COLOR_REGEXP.test(schema.color);
var circleMark = {
	ui: (arg) => {
		const { schema, value, onChange, rootElement, mode } = arg;
		const selected = isSelected(value);
		const editable = isEditable(mode, schema);
		const shouldRenderMark = selected && hasRenderableStyle(schema);
		if (!editable && !shouldRenderMark) return;
		const container = document.createElement("div");
		container.style.width = "100%";
		container.style.height = "100%";
		container.style.boxSizing = "border-box";
		if (editable) {
			container.style.cursor = "pointer";
			container.addEventListener("click", () => {
				if (onChange) onChange({
					key: "content",
					value: selected ? "false" : "true"
				});
			});
		}
		if (shouldRenderMark) {
			const mark = document.createElement("div");
			mark.style.width = "100%";
			mark.style.height = "100%";
			mark.style.boxSizing = "border-box";
			mark.style.borderRadius = "50%";
			mark.style.borderWidth = `${schema.borderWidth}mm`;
			mark.style.borderStyle = "solid";
			mark.style.borderColor = schema.color;
			mark.style.pointerEvents = "none";
			container.appendChild(mark);
		}
		rootElement.appendChild(container);
	},
	pdf: (arg) => {
		const { schema, value, page, options } = arg;
		if (!isSelected(value) || !hasRenderableStyle(schema)) return;
		const borderWidth = mm2pt(schema.borderWidth);
		const cArg = {
			schema,
			pageHeight: page.getHeight()
		};
		const { width, height, rotate, opacity } = convertForPdfLayoutProps(cArg);
		const { position: { x, y } } = convertForPdfLayoutProps({
			...cArg,
			applyRotateTranslate: false
		});
		const xScale = width / 2 - borderWidth / 2;
		const yScale = height / 2 - borderWidth / 2;
		if (xScale <= 0 || yScale <= 0) return;
		page.drawEllipse({
			x: x + width / 2,
			y: y + height / 2,
			xScale,
			yScale,
			rotate,
			borderWidth,
			borderColor: hex2PrintingColor(schema.color, options.colorType),
			borderOpacity: opacity
		});
	},
	propPanel: {
		schema: ({ i18n }) => ({
			color: {
				title: i18n("schemas.color"),
				type: "string",
				widget: "color",
				props: { disabledAlpha: true },
				required: true,
				rules: [{
					pattern: HEX_COLOR_PATTERN,
					message: i18n("validation.hexColor")
				}]
			},
			borderWidth: {
				title: i18n("schemas.borderWidth"),
				type: "number",
				widget: "inputNumber",
				props: {
					min: 0,
					step: 1
				},
				required: true
			}
		}),
		defaultSchema: {
			name: "",
			type: "circleMark",
			content: "false",
			position: {
				x: 0,
				y: 0
			},
			width: 10,
			height: 10,
			rotate: 0,
			opacity: 1,
			color: "#000000",
			borderWidth: 1
		}
	},
	icon: createSvgStr(Circle)
};
//#endregion
export { BUILT_IN_DYNAMIC_LAYOUT_SPLIT_UNITS, LIST_ITEM_SPLIT_UNIT, TABLE_BODY_SPLIT_UNIT, TEXT_LINE_SPLIT_UNIT, barcodes, builtInPlugins, schema as checkbox, circleMark, createListItemSplitRange, createTableBodySplitRange, createTextLineSplitRange, date_default as date, dateTime_default as dateTime, ellipse, getDynamicHeightsForTable, getDynamicLayoutForList, getDynamicLayoutForTable, getListItemRange, getTableBodyRange, getTextLineRange, imageSchema as image, lineSchema as line, listSchema as list, schema$1 as multiVariableText, schema$2 as radioGroup, rectangle, schema$3 as select, signature, svgSchema as svg, tableSchema as table, textSchema as text, time_default as time };

//# sourceMappingURL=index.js.map