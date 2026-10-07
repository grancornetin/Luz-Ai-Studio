// src/components/shared/useImagePicker.tsx
// Abre el selector nativo de fotos desde cualquier botón.
// Sin `capture`: en iPhone el sistema ofrece Fototeca, Tomar foto o Elegir
// archivo; en Android, cámara, galería o archivos. Respeta el mismo
// consentimiento de contenido que ImageSlot y comprime antes de entregar.
import React, { useRef, useState } from 'react';
import UploadConsentModal from './UploadConsentModal';
import { readAndCompressFile } from '../../utils/imageUtils';
import { hasConsented, hasRemoteConsent, saveConsentToFirestore } from '../../utils/uploadConsent';

type OnPicked = (dataUrl: string) => void;

export function useImagePicker() {
  const inputRef = useRef<HTMLInputElement>(null);
  const callbackRef = useRef<OnPicked | null>(null);
  const pendingFileRef = useRef<File | null>(null);
  const [showConsent, setShowConsent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const process = async (file: File) => {
    setIsLoading(true);
    try {
      const compressed = await readAndCompressFile(file);
      callbackRef.current?.(compressed);
    } catch (error) {
      console.error('Error al procesar la imagen:', error);
    } finally {
      setIsLoading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (hasConsented() || await hasRemoteConsent()) {
      await process(file);
    } else {
      pendingFileRef.current = file;
      setShowConsent(true);
    }
  };

  const open = (onPicked: OnPicked) => {
    callbackRef.current = onPicked;
    inputRef.current?.click();
  };

  const element = (
    <>
      {showConsent && (
        <UploadConsentModal
          onAccept={async () => {
            setShowConsent(false);
            await saveConsentToFirestore();
            if (pendingFileRef.current) await process(pendingFileRef.current);
            pendingFileRef.current = null;
          }}
          onCancel={() => {
            setShowConsent(false);
            pendingFileRef.current = null;
            if (inputRef.current) inputRef.current.value = '';
          }}
        />
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleChange}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />
    </>
  );

  return { open, element, isLoading };
}
