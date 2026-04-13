/**
 * BibTeX Parser for MUSIC Lab CMS
 *
 * Provides a floating panel on the publications editor page.
 * When the user pastes a BibTeX entry and clicks "Parse & Fill Fields",
 * the script parses common fields and populates the Sveltia CMS form
 * via DOM manipulation.
 *
 * bib_key convention: {first_author_initial}{surname}{year}{letter}
 * always lowercase, letter starts at 'a'.
 */

// ---------------------------------------------------------------------------
//  LaTeX-to-Unicode mapping (common escapes found in BibTeX)
// ---------------------------------------------------------------------------
const LATEX_REPLACEMENTS = [
  [/\\&/g, "&"],
  [/\\\$/g, "$"],
  [/\\%/g, "%"],
  [/\\#/g, "#"],
  [/\\_/g, "_"],
  [/\\~/g, "\u00A0"],
  [/\\textasciitilde\b/g, "~"],
  [/\\'a/g, "\u00E1"],
  [/\\'e/g, "\u00E9"],
  [/\\'i/g, "\u00ED"],
  [/\\'o/g, "\u00F3"],
  [/\\'u/g, "\u00FA"],
  [/\\"a/g, "\u00E4"],
  [/\\"e/g, "\u00EB"],
  [/\\"i/g, "\u00EF"],
  [/\\"o/g, "\u00F6"],
  [/\\"u/g, "\u00FC"],
  [/\\`a/g, "\u00E0"],
  [/\\`e/g, "\u00E8"],
  [/\\`i/g, "\u00EC"],
  [/\\`o/g, "\u00F2"],
  [/\\`u/g, "\u00F9"],
  [/\\\^a/g, "\u00E2"],
  [/\\\^e/g, "\u00EA"],
  [/\\\^i/g, "\u00EE"],
  [/\\\^o/g, "\u00F4"],
  [/\\\^u/g, "\u00FB"],
  [/\\c\{c\}/g, "\u00E7"],
  [/\\c\{C\}/g, "\u00C7"],
  [/\\'A/g, "\u00C1"],
  [/\\'E/g, "\u00C9"],
  [/\\'I/g, "\u00CD"],
  [/\\'O/g, "\u00D3"],
  [/\\'U/g, "\u00DA"],
  [/\\"A/g, "\u00C4"],
  [/\\"O/g, "\u00D6"],
  [/\\"U/g, "\u00DC"],
  [/\\~n/g, "\u00F1"],
  [/\\~N/g, "\u00D1"],
  [/\\ss\b/g, "\u00DF"],
  [/\\o\b/g, "\u00F8"],
  [/\\O\b/g, "\u00D8"],
  [/\\aa\b/g, "\u00E5"],
  [/\\AA\b/g, "\u00C5"],
  [/\\ae\b/g, "\u00E6"],
  [/\\AE\b/g, "\u00C6"],
  [/---/g, "\u2014"],
  [/--/g, "\u2013"],
  [/``/g, "\u201C"],
  [/''/g, "\u201D"],
];

/**
 * Strip LaTeX escapes and remove BibTeX brace grouping.
 */
function cleanLatex(str) {
  if (!str) return "";
  let out = str;
  for (const [re, repl] of LATEX_REPLACEMENTS) {
    out = out.replace(re, repl);
  }
  // Remove remaining curly braces (grouping)
  out = out.replace(/[{}]/g, "");
  // Collapse whitespace
  out = out.replace(/\s+/g, " ").trim();
  return out;
}

// ---------------------------------------------------------------------------
//  BibTeX parser
// ---------------------------------------------------------------------------

/**
 * Parse a single BibTeX entry string.
 * Returns an object with field names as keys.
 */
function parseBibtex(raw) {
  const result = {};

  // Detect entry type and citation key
  const header = raw.match(/@(\w+)\s*\{\s*([^,]*),/);
  if (header) {
    result._type = header[1].toLowerCase();
    result._citeKey = header[2].trim();
  }

  // Extract field = {value} or field = "value" or field = number
  // We need to handle nested braces properly.
  const fieldRegex = /(\w+)\s*=\s*/g;
  let match;
  while ((match = fieldRegex.exec(raw)) !== null) {
    const fieldName = match[1].toLowerCase();
    const startIdx = match.index + match[0].length;
    const value = extractValue(raw, startIdx);
    if (value !== null) {
      result[fieldName] = value;
    }
  }

  return result;
}

/**
 * Extract a BibTeX field value starting at a given index.
 * Handles brace-delimited, quote-delimited, and bare number values.
 */
function extractValue(str, idx) {
  // Skip whitespace
  while (idx < str.length && /\s/.test(str[idx])) idx++;

  if (idx >= str.length) return null;

  const ch = str[idx];

  if (ch === "{") {
    // Brace-delimited: count nested braces
    let depth = 0;
    let start = idx + 1;
    for (let i = idx; i < str.length; i++) {
      if (str[i] === "{") depth++;
      else if (str[i] === "}") {
        depth--;
        if (depth === 0) {
          return str.slice(start, i);
        }
      }
    }
    // Unbalanced — take what we have
    return str.slice(start);
  }

  if (ch === '"') {
    // Quote-delimited
    let end = str.indexOf('"', idx + 1);
    if (end === -1) end = str.length;
    return str.slice(idx + 1, end);
  }

  // Bare value (number, macro) — take until comma or closing brace
  const endMatch = str.slice(idx).match(/^([^,}]+)/);
  return endMatch ? endMatch[1].trim() : null;
}

/**
 * Split a BibTeX author string ("Last, First and Last2, First2 and ...")
 * into an array of "First Last" strings.
 */
function parseAuthors(authorStr) {
  if (!authorStr) return [];
  // Split on " and " (case-insensitive)
  const parts = authorStr.split(/\s+and\s+/i);
  return parts.map((part) => {
    part = cleanLatex(part.trim());
    // Handle "Last, First" format
    if (part.includes(",")) {
      const [last, ...first] = part.split(",").map((s) => s.trim());
      return [...first, last].join(" ");
    }
    // Already "First Last"
    return part;
  });
}

/**
 * Generate a bib_key from first author name and year.
 * Convention: {first_name_initial}{surname}{year}{letter}, all lowercase.
 * @param {string} firstAuthor  - "First Last" or "First Middle Last"
 * @param {string|number} year
 * @param {Set<string>} existingKeys - set of keys already in use
 * @returns {string}
 */
function generateBibKey(firstAuthor, year, existingKeys = new Set()) {
  const parts = firstAuthor.trim().split(/\s+/);
  const firstName = parts[0] || "";
  const surname = parts[parts.length - 1] || "";
  const initial = firstName.charAt(0).toLowerCase();
  const surnameClean = surname.toLowerCase().replace(/[^a-z]/g, "");
  const prefix = `${initial}${surnameClean}${year}`;

  // Find next available letter
  const letters = "abcdefghijklmnopqrstuvwxyz";
  for (const letter of letters) {
    const candidate = `${prefix}${letter}`;
    if (!existingKeys.has(candidate)) {
      return candidate;
    }
  }
  // Fallback (26+ papers by same first-author in one year is unlikely)
  return `${prefix}a`;
}

// ---------------------------------------------------------------------------
//  DOM interaction — populate Sveltia CMS form fields
// ---------------------------------------------------------------------------

/**
 * Attempt to set a Sveltia CMS form field value.
 *
 * Sveltia CMS renders form fields as standard HTML inputs/textareas inside
 * its shadow DOM or regular DOM. We try multiple strategies:
 *   1. Look for inputs by field name label
 *   2. Look for inputs by data attribute
 *   3. Fallback: use aria-label or placeholder
 */
function setFieldValue(fieldName, value) {
  if (value === undefined || value === null) return false;

  // Strategy: find all labels, match by text content, then find the
  // associated input/textarea/select.
  const labels = document.querySelectorAll("label, [class*='label']");
  for (const label of labels) {
    const text = (label.textContent || "").trim().toLowerCase();
    const target = fieldName.toLowerCase();

    if (text === target || text.startsWith(target)) {
      // Find the nearest input/textarea in the same parent container
      const container = label.closest("[class*='field']") || label.parentElement;
      if (!container) continue;

      const input =
        container.querySelector("input:not([type='hidden']):not([type='checkbox'])") ||
        container.querySelector("textarea") ||
        container.querySelector("select");

      if (input) {
        setNativeValue(input, value);
        return true;
      }
    }
  }

  // Fallback: search by placeholder or aria-label
  const selector = [
    `input[placeholder*="${fieldName}" i]`,
    `textarea[placeholder*="${fieldName}" i]`,
    `input[aria-label*="${fieldName}" i]`,
    `textarea[aria-label*="${fieldName}" i]`,
  ].join(", ");

  const el = document.querySelector(selector);
  if (el) {
    setNativeValue(el, value);
    return true;
  }

  return false;
}

/**
 * Set an input value in a way that React/Svelte/framework-managed
 * inputs will pick up (dispatch native events).
 */
function setNativeValue(el, value) {
  const nativeInputValueSetter =
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set ||
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;

  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(el, String(value));
  } else {
    el.value = String(value);
  }

  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

/**
 * Attempt to populate list (authors / tags) fields.
 * Sveltia CMS list widgets vary, so we try best-effort.
 */
function setListField(fieldName, values) {
  if (!values || !values.length) return false;

  // For list widgets, look for the field container, then try to
  // add items via the add button + fill each input.
  // This is fragile with Sveltia CMS, so we log what we can't fill.
  const labels = document.querySelectorAll("label, [class*='label']");
  for (const label of labels) {
    const text = (label.textContent || "").trim().toLowerCase();
    if (text !== fieldName.toLowerCase()) continue;

    const container = label.closest("[class*='field']") || label.parentElement;
    if (!container) continue;

    // Look for existing list inputs
    const inputs = container.querySelectorAll("input");
    const addBtn = container.querySelector("button");

    // Fill existing inputs first
    let filled = 0;
    for (let i = 0; i < values.length; i++) {
      if (i < inputs.length) {
        setNativeValue(inputs[i], values[i]);
        filled++;
      } else if (addBtn) {
        // Click add, then fill the new input
        addBtn.click();
        // Wait a tick for the DOM to update
        setTimeout(() => {
          const newInputs = container.querySelectorAll("input");
          if (newInputs[i]) {
            setNativeValue(newInputs[i], values[i]);
          }
        }, 100 * (i - filled + 1));
      }
    }
    return true;
  }
  return false;
}

/**
 * Collect existing publication bib keys from the CMS entries list.
 * Falls back to fetching from the content directory if the DOM approach fails.
 */
async function getExistingKeys() {
  const keys = new Set();

  // Try to read from the publications list in the CMS sidebar / entry list
  const links = document.querySelectorAll("a[href*='publications']");
  for (const link of links) {
    const href = link.getAttribute("href") || "";
    const match = href.match(/publications\/([a-z0-9]+)$/);
    if (match) keys.add(match[1]);
  }

  // Also try fetching the list from the GitHub API (if available via CMS backend)
  // This is best-effort — if it fails, we just use what we found in the DOM.
  try {
    const resp = await fetch("/admin/existing-keys.json");
    if (resp.ok) {
      const data = await resp.json();
      if (Array.isArray(data)) data.forEach((k) => keys.add(k));
    }
  } catch {
    // Silently ignore — not critical
  }

  return keys;
}

/**
 * Map from BibTeX venue type keywords to our schema enum values.
 */
function detectVenueType(bibtexType, fields) {
  if (bibtexType === "article" || fields.journal) return "journal";
  if (bibtexType === "inproceedings" || bibtexType === "conference" || fields.booktitle)
    return "conference";
  if (bibtexType === "misc" || bibtexType === "unpublished") return "preprint";
  if (bibtexType === "phdthesis" || bibtexType === "mastersthesis") return "thesis";
  if (bibtexType === "patent") return "patent";
  if (fields.booktitle && /workshop/i.test(fields.booktitle)) return "workshop";
  return "conference"; // default
}

// ---------------------------------------------------------------------------
//  Main parse-and-fill handler
// ---------------------------------------------------------------------------

async function handleParse() {
  const statusEl = document.getElementById("bibtex-status");
  const inputEl = document.getElementById("bibtex-input");
  const raw = inputEl.value.trim();

  if (!raw) {
    statusEl.className = "status error";
    statusEl.textContent = "Please paste a BibTeX entry first.";
    return;
  }

  try {
    const fields = parseBibtex(raw);

    // Resolve values
    const title = cleanLatex(fields.title || "");
    const authors = parseAuthors(fields.author || "");
    const year = fields.year ? parseInt(fields.year, 10) : new Date().getFullYear();
    const venue = cleanLatex(fields.journal || fields.booktitle || "");
    const doi = (fields.doi || "").replace(/^https?:\/\/doi\.org\//i, "");
    const abstract = cleanLatex(fields.abstract || "");
    const venueType = detectVenueType(fields._type, fields);

    // Generate bib_key
    const existingKeys = await getExistingKeys();
    const bibKey =
      authors.length > 0
        ? generateBibKey(authors[0], year, existingKeys)
        : `unknown${year}a`;

    // Build the R2 PDF URL (user can override)
    const pdfUrl = `https://pub-6526459aa6b442a7b070a1f0578eb4eb.r2.dev/papers/${bibKey}.pdf`;

    // Log parsed data for debugging
    console.log("[BibTeX Parser] Parsed:", {
      bibKey,
      title,
      authors,
      year,
      venue,
      venueType,
      doi,
      abstract: abstract.slice(0, 80) + "...",
    });

    // Attempt to fill form fields.
    // We use a short delay to give the CMS form time to be fully rendered.
    const results = {};
    const fieldMap = [
      ["BibTeX Key", bibKey],
      ["Title", title],
      ["Year", year],
      ["Venue", venue],
      ["DOI", doi],
      ["Abstract", abstract],
      ["PDF URL", pdfUrl],
      ["BibTeX", raw],
    ];

    let filledCount = 0;
    let failedFields = [];

    for (const [label, value] of fieldMap) {
      if (value) {
        const ok = setFieldValue(label, value);
        if (ok) filledCount++;
        else failedFields.push(label);
        results[label] = ok ? "filled" : "not found";
      }
    }

    // Try venue type select
    const venueTypeSet = setFieldValue("Venue Type", venueType);
    if (venueTypeSet) filledCount++;
    else failedFields.push("Venue Type");

    // Try authors list
    if (authors.length > 0) {
      const authorsSet = setListField("Authors", authors);
      if (authorsSet) filledCount++;
      else failedFields.push("Authors");
    }

    // Status message
    if (failedFields.length === 0) {
      statusEl.className = "status success";
      statusEl.innerHTML = `
        Parsed successfully. All fields populated.<br>
        <strong>bib_key:</strong> <code>${bibKey}</code><br>
        <strong>Authors:</strong> ${authors.join("; ")}<br>
        Please review all values before saving.
      `;
    } else {
      statusEl.className = "status success";
      statusEl.innerHTML = `
        Parsed: <strong>${filledCount}</strong> fields filled.<br>
        <strong>bib_key:</strong> <code>${bibKey}</code><br>
        <strong>Authors:</strong> ${authors.join("; ")}<br>
        <em>Could not auto-fill:</em> ${failedFields.join(", ")}.<br>
        <small>Sveltia CMS may require manual entry for list/select fields.
        Copy the values above and paste them in.</small>
      `;
    }
  } catch (err) {
    statusEl.className = "status error";
    statusEl.textContent = `Parse error: ${err.message}`;
    console.error("[BibTeX Parser] Error:", err);
  }
}

// ---------------------------------------------------------------------------
//  Panel visibility — only show when editing a publication
// ---------------------------------------------------------------------------

function isOnPublicationsPage() {
  const hash = window.location.hash || "";
  const path = window.location.pathname || "";
  return (
    hash.includes("publications") ||
    path.includes("publications") ||
    hash.includes("collection/publications")
  );
}

function updatePanelVisibility() {
  const toggle = document.getElementById("bibtex-toggle");
  const panel = document.getElementById("bibtex-panel");

  if (isOnPublicationsPage()) {
    toggle.style.display = "block";
  } else {
    toggle.style.display = "none";
    panel.style.display = "none";
  }
}

// ---------------------------------------------------------------------------
//  Init
// ---------------------------------------------------------------------------

function init() {
  const toggle = document.getElementById("bibtex-toggle");
  const panel = document.getElementById("bibtex-panel");
  const closeBtn = document.getElementById("bibtex-close");
  const parseBtn = document.getElementById("bibtex-parse");

  toggle.addEventListener("click", () => {
    panel.style.display = panel.style.display === "none" ? "block" : "none";
  });

  closeBtn.addEventListener("click", () => {
    panel.style.display = "none";
  });

  parseBtn.addEventListener("click", handleParse);

  // Monitor URL hash changes (Sveltia CMS is an SPA)
  updatePanelVisibility();
  window.addEventListener("hashchange", updatePanelVisibility);

  // Also poll periodically in case the CMS changes routes without hash changes
  setInterval(updatePanelVisibility, 2000);
}

// Wait for the page to fully load (CMS may take a moment)
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
