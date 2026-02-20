import { supabase } from './supabase';

type ProcessManualResponse = {
  success: boolean;
  manualId?: string;
  fileUrl?: string;
  fileName?: string;
  error?: string;
};

export const manualService = {
  async uploadAndProcessManual(
    file: File,
    equipmentId: string,
    onProgress: (msg: string) => void,
  ) {
    onProgress('Fazendo upload do arquivo...');

    // 1. Upload direto para o Supabase Storage (evita limite de 4.5MB do Vercel)
    const filePath = `${equipmentId}/${Date.now()}-${file.name}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('tecnoloc_assets')
      .upload(filePath, file, { contentType: 'application/pdf', upsert: false });

    if (uploadError) {
      onProgress('Erro ao fazer upload do arquivo.');
      throw new Error(uploadError.message);
    }

    const { data: publicUrlData } = supabase.storage
      .from('tecnoloc_assets')
      .getPublicUrl(uploadData.path);
    const fileUrl = publicUrlData?.publicUrl ?? '';

    onProgress('Enviando para processamento...');

    // 2. Chama a API apenas com o caminho do arquivo (sem base64)
    const response = await fetch('/api/process-manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filePath: uploadData.path,
        fileUrl,
        fileName: file.name,
        equipmentId,
      }),
    });

    const rawResponse = await response.text();
    let payload: ProcessManualResponse = { success: false };
    try {
      payload = rawResponse ? JSON.parse(rawResponse) : { success: false };
    } catch (err) {
      console.error('Falha ao parsear resposta da API', { err, rawResponse: rawResponse.substring(0, 500) });
    }

    if (!response.ok || !payload.success) {
      onProgress('Erro ao processar.');
      throw new Error(payload?.error || 'Falha ao processar manual.');
    }

    onProgress('Manual processado com sucesso!');
    return {
      file_url: payload.fileUrl ?? fileUrl,
      file_name: payload.fileName ?? file.name,
      manual_id: payload.manualId ?? null,
    };
  },
};
