import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.js";
import { NextApiRequest, NextApiResponse } from "next";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

function createChunks(text: string, size: number, overlap: number) {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + size));
    i += size - overlap;
  }
  return chunks;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método não permitido" });
    }

    const { fileBase64, fileName, equipmentId } = req.body;

    if (!fileBase64 || !equipmentId) {
      return res.status(400).json({ error: "Dados inválidos" });
    }

    // Converter base64 para Buffer
    const buffer = Buffer.from(fileBase64, "base64");

    // Upload Storage
    const filePath = `${equipmentId}/${Date.now()}-${fileName}`;
    const { error: uploadError } = await supabase.storage
      .from("tecnoloc_assets")
      .upload(filePath, buffer, {
        contentType: "application/pdf",
      });

    if (uploadError) throw uploadError;

    // Salvar manual
    const { data: manualData, error: manualError } = await supabase
      .from("manuals")
      .insert({ equipment_id: equipmentId, file_path: filePath })
      .select()
      .single();

    if (manualError) throw manualError;

    const manualId = manualData.id;
    console.log("Manual inserido com sucesso:", manualData);

    // Extrair texto
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    let fullText = "";

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      fullText +=
        textContent.items.map((item: any) => item.str).join(" ") + "\n";
    }

    console.log("Texto extraído tamanho:", fullText.length);

    const chunks = createChunks(fullText, 1000, 150);

    console.log("Quantidade de chunks:", chunks.length);

    // Gerar embeddings e inserir
    let chunksInseridos = 0;
    for (const chunk of chunks) {
      console.log(`Processando chunk ${chunksInseridos + 1}/${chunks.length}`);
      const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: chunk,
      });

      const embedding = embeddingResponse.data[0].embedding;
      console.log(`Embedding gerado para chunk ${chunksInseridos + 1}`);

      if (embedding.length !== 1536) {
        throw new Error("Dimensão do embedding inválida");
      }

      const { error } = await supabase.from("manual_sections").insert({
        manual_id: manualId,
        equipment_id: equipmentId,
        content: chunk,
        embedding: embedding,
      });

      if (error) {
        console.error("Erro ao inserir chunk:", error);
        throw error;
      }
      chunksInseridos++;
      console.log(`Chunk ${chunksInseridos} inserido com sucesso`);
    }

    console.log(`✓ Todos os ${chunksInseridos} chunks foram inseridos com sucesso`);

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("Erro no processamento:", error);
    return res.status(500).json({ error: error.message });
  }
}
