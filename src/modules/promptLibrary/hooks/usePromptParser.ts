
import { useState, useEffect, useCallback } from 'react';
import { PromptDNA } from '../types/promptTypes';
import { promptParserService } from '../services/promptParserService';

export const usePromptParser = (initialText: string = '') => {
  const [promptText, setPromptText] = useState(initialText);
  const [dna, setDna] = useState<PromptDNA>(promptParserService.parse(initialText));

  useEffect(() => {
    const timer = setTimeout(() => {
      const parsed = promptParserService.parse(promptText);
      setDna(parsed);
    }, 500);

    return () => clearTimeout(timer);
  }, [promptText]);

  const updateDNA = useCallback((key: keyof PromptDNA, value: string) => {
    setDna(prev => {
      const next = { ...prev, [key]: value };
      const newText = promptParserService.rebuild(next);
      setPromptText(newText);
      return next;
    });
  }, []);

  return {
    promptText,
    setPromptText,
    dna,
    setDna,
    updateDNA
  };
};
