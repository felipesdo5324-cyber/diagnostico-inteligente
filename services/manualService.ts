import { supabase } from './supabase';
import OpenAI from 'openai';
import * as pdfjsLib from 'pdfjs-dist';
import { dataService } from './dataService';
import { Manual } from '../types';

// Configuração do leitor de PDF
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// Agora configurado para OpenAI
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // Necessário para rodar direto no seu app
});

export const manualService = {
  async uploadAndProcessManual(
    file: File,
    equipmentId: string,
    onProgress: (msg: string) => void
  ) {
    try {
      onProgress("Convertendo arquivo...");

      const arrayBuffer = await file.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");

      onProgress("Enviando para processamento...");

      const response = await fetch("/api/process-manual", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileBase64: base64,
          fileName: file.name,
          equipmentId,
        }),
      });

      if (!response.ok) {
        throw new Error("Erro ao processar manual");
      }

      onProgress("Manual processado com sucesso!");
    } catch (error) {
      console.error(error);
      onProgress("Erro ao processar manual.");
    }
  }
};
