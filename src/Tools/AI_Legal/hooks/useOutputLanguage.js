import { useState, useCallback, useRef, useEffect } from 'react';
import { generateChatResponse } from '../../../services/geminiService';

// ── Translation system prompt ──────────────────────────────────────────────────
const TRANSLATION_SYSTEM_PROMPT = `You are a professional legal translator. Translate the following English legal text into Hindi (Devanagari script).

CRITICAL RULES:
1. TRANSLATE: All headings, paragraphs, bullet points, numbered lists, table cells, legal advice, summaries, arguments, recommendations, notes, and warnings.
2. DO NOT TRANSLATE (keep exactly as-is):
   - Case Names (e.g. "Lalita Kumari vs State of UP", "Maneka Gandhi vs Union of India")
   - Legal codes: IPC, BNS, CrPC, BNSS, CPC, Constitution, Supreme Court, High Court, District Court
   - Section numbers (e.g. Section 302, Section 65B, Article 21, Section 100)
   - Legal citations (e.g. AIR 1980 SC 898, 2014 2 SCC 1, SCR 605)
   - Proper nouns: AISA, India, state names, district names, city names
   - Latin legal terms: ratio decidendi, mens rea, actus reus, habeas corpus, suo motu
3. PRESERVE EXACTLY: All Markdown formatting (##, ###, **, *, -, 1., | tables |, \`code\`, > quotes).
4. PRESERVE EXACTLY: All structural labels at the start of each paragraph (e.g. "SUMMARY:", "SEC_SUMMARY:", "STRENGTHS:", etc.) — translate only the text AFTER the colon.
5. PRESERVE EXACTLY: The triple-pipe delimiter "|||" wherever it appears — it is a structural separator and must NOT be altered, removed, or translated.
6. PRESERVE EXACTLY: The " | " (space-pipe-space) separator used between list items — do not remove or alter them.
7. OUTPUT: Only the translated text. No explanation. No preamble. No "Here is the translation:".`;

// ── Simple hash for cache keying ───────────────────────────────────────────────
const simpleHash = (str) => {
  let h = 0;
  for (let i = 0; i < Math.min(str.length, 500); i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h |= 0;
  }
  return h.toString(36);
};

// ── Global translation cache (persists across component remounts) ───────────────
const globalTranslationCache = new Map();

/**
 * useOutputLanguage
 * 
 * @param {string} moduleId - Unique ID for this module (e.g. 'legal_chat', 'draft_maker')
 * @param {string} sessionId - Optional session/chat ID for per-session persistence
 * 
 * @returns {{
 *   outputLang: 'en'|'hi',
 *   setOutputLang: Function,
 *   isTranslating: boolean,
 *   getDisplayText: (text: string) => string,
 *   translateText: (text: string) => Promise<string>,
 *   clearCache: () => void,
 * }}
 */
const useOutputLanguage = (moduleId = 'legal', sessionId = '') => {
  const storageKey = moduleId === 'evidence_analysis' ? 'analysisLanguage' : `aisa_output_lang_${moduleId}_${sessionId}`;

  const [outputLang, setOutputLangState] = useState(() => {
    try {
      return localStorage.getItem(storageKey) || 'en';
    } catch {
      return 'en';
    }
  });

  const [isTranslating, setIsTranslating] = useState(false);

  // Local translation cache (Map: hash → hindiText)
  const localCache = useRef(new Map());

  // Track in-flight translation promises to avoid duplicate calls
  const inFlightRef = useRef(new Map());

  // Persist language preference
  const setOutputLang = useCallback((lang) => {
    setOutputLangState(lang);
    try {
      localStorage.setItem(storageKey, lang);
    } catch { /* ignore */ }
  }, [storageKey]);

  // Restore from localStorage on session/module change
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved && saved !== outputLang) {
        setOutputLangState(saved);
      }
    } catch { /* ignore */ }
  }, [storageKey]); // eslint-disable-line

  /**
   * Translate a single text block to Hindi.
   * Returns cached version if available.
   */
  const translateText = useCallback(async (text) => {
    if (!text || !text.trim()) return text;

    const cacheKey = simpleHash(text);

    // 1. Check local component cache
    if (localCache.current.has(cacheKey)) {
      return localCache.current.get(cacheKey);
    }

    // 2. Check global cross-component cache
    if (globalTranslationCache.has(cacheKey)) {
      const cached = globalTranslationCache.get(cacheKey);
      localCache.current.set(cacheKey, cached);
      return cached;
    }

    // 3. If already translating this exact text, wait for that promise
    if (inFlightRef.current.has(cacheKey)) {
      return inFlightRef.current.get(cacheKey);
    }

    // 4. Call Gemini for translation
    const translationPromise = (async () => {
      try {
        const response = await generateChatResponse(
          [],           // history
          text,         // message to translate
          TRANSLATION_SYSTEM_PROMPT,
          [],           // attachments
          'English',    // API response language param
          null,         // abortSignal
          'legal',      // mode
          null,         // sessionId
          null          // projectId
        );

        const translated =
          response?.reply ||
          (typeof response === 'string' ? response : '') ||
          text;

        // Cache it
        localCache.current.set(cacheKey, translated);
        globalTranslationCache.set(cacheKey, translated);
        return translated;
      } catch (err) {
        console.error('[useOutputLanguage] Translation failed:', err);
        return text; // Fallback to original on error
      } finally {
        inFlightRef.current.delete(cacheKey);
      }
    })();

    inFlightRef.current.set(cacheKey, translationPromise);
    return translationPromise;
  }, []);

  /**
   * Get display text synchronously.
   * Returns Hindi from cache if lang='hi' and cached, else original.
   */
  const getDisplayText = useCallback((text) => {
    if (outputLang === 'en' || !text) return text;
    const cacheKey = simpleHash(text);
    return (
      localCache.current.get(cacheKey) ||
      globalTranslationCache.get(cacheKey) ||
      text // Return original until translation resolves
    );
  }, [outputLang]);

  const clearCache = useCallback(() => {
    localCache.current.clear();
  }, []);

  return {
    outputLang,
    setOutputLang,
    isTranslating,
    setIsTranslating,
    getDisplayText,
    translateText,
    clearCache,
  };
};

export default useOutputLanguage;
