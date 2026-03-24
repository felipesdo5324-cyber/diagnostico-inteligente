import { supabase } from './supabase';

type ProcessManualResponse = {
  success: boolean;
  error?: string;
};

export const manualService = {
  /**
   * Passo 1: envia o arquivo para o Supabase Storage e retorna
   * o caminho + URL publica + nome do arquivo.
   */
  async uploadFile(
    file: File,
    equipmentId: string,
    onProgress: (msg: string) => void,
  ): Promise<{ filePath: string; fileUrl: string; fileName: string }> {
    onProgress('Fazendo upload do arquivo...');

    const folder = equipmentId?.trim() || 'manuals';
    const filePath = `${folder}/${Date.now()}-${file.name}`;

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

    onProgress('Upload concluido!');
    return {
      filePath: uploadData.path,
      fileUrl: publicUrlData?.publicUrl ?? '',
      fileName: file.name,
    };
  },

  /**
   * Passo 2: envia apenas o caminho do arquivo e o manualId para
   * a API serverless gerar embeddings e salvar em manual_sections.
   * Chamado APOS o manual ser salvo no banco.
   */
  async processManualSections(
    manualId: string,
    filePath: string,
    equipmentId: string,
    onProgress: (msg: string) => void,
  ): Promise<void> {
    onProgress('Gerando embeddings do manual...');

    const response = await fetch('/api/process-manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manualId, filePath, equipmentId }),
    });

    const rawResponse = await response.text();
    let payload: ProcessManualResponse = { success: false };
    try {
      payload = rawResponse ? JSON.parse(rawResponse) : { success: false };
    } catch (err) {
      console.error('Falha ao parsear resposta da API', { err, raw: rawResponse.substring(0, 500) });
    }

    if (!response.ok || !payload.success) {
      onProgress('Erro ao processar embeddings.');
      throw new Error(payload?.error || 'Falha ao processar manual.');
    }

    onProgress('Manual processado com sucesso!');
  },
};
