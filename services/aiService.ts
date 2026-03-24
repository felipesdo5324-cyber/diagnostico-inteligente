
import OpenAI from "openai";
import { DiagnosticResult } from "../types";

// Função auxiliar para buscar credenciais de forma robusta
const getCredential = (key: string): string | undefined => {
  const viteKey = `VITE_${key}`;
  return (process.env as any)[key] || 
         (process.env as any)[viteKey] || 
         (import.meta as any).env?.[viteKey] || 
         (import.meta as any).env?.[key];
};

const apiKey = getCredential('OPENAI_API_KEY');

const openai = new OpenAI({
  apiKey: apiKey || 'dummy', // Evita crash na inicialização se a key não existir imediatamente
  dangerouslyAllowBrowser: true // Permite uso no frontend conforme arquitetura atual
});

/**
 * Converte qualquer valor em uma string pura, extraindo conteúdo de objetos se necessário.
 * Crucial para evitar o erro visual [object Object] no frontend.
 */
function forceString(val: any): string {
  if (val === null || val === undefined) return "";
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    // Busca por chaves de conteúdo conhecidas em modelos de IA
    const priorityKeys = ['text', 'description', 'desc', 'item', 'causa', 'valor', 'value', 'passo', 'step', 'instrucao'];
    for (const key of priorityKeys) {
      if (val[key] && typeof val[key] === 'string') return val[key];
    }
    const firstStringKey = Object.keys(val).find(k => typeof val[k] === 'string');
    if (firstStringKey) return val[firstStringKey];
    return JSON.stringify(val);
  }
  return String(val);
}

/**
 * Normaliza a resposta da IA para o contrato DiagnosticResult.
 */
function sanitizeResult(data: any): DiagnosticResult {
  const result: DiagnosticResult = {
    possible_causes: [],
    solutions: []
  };

  if (!data || typeof data !== 'object') return result;

  // Normalização de Causas
  const rawCauses = Array.isArray(data.possible_causes) ? data.possible_causes : 
                   Array.isArray(data.causas) ? data.causas : [];
  result.possible_causes = rawCauses.map(forceString).filter(s => s.trim() !== "");

  // Normalização de Soluções
  const rawSolutions = Array.isArray(data.solutions) ? data.solutions : 
                      Array.isArray(data.solucoes) ? data.solucoes : [];
  
  result.solutions = rawSolutions.map((s: any) => {
    if (typeof s === 'string') {
      return { title: 'Ação Corretiva', steps: [s], difficulty: 'Média' as const };
    }
    
    // Mapeamento flexível de chaves para suportar variações da IA
    const title = forceString(s.title || s.titulo || s.nome || "Solução Técnica");
    const steps = Array.isArray(s.steps) ? s.steps : 
                 Array.isArray(s.passos) ? s.passos : [forceString(s.steps || s.passos)];
    
    let difficulty: 'Fácil' | 'Média' | 'Difícil' = 'Média';
    const d = forceString(s.difficulty || s.dificuldade).toLowerCase();
    if (d.includes('fácil') || d.includes('facil') || d.includes('easy')) difficulty = 'Fácil';
    if (d.includes('difícil') || d.includes('dificil') || d.includes('hard')) difficulty = 'Difícil';

    return {
      title,
      steps: steps.map(forceString).filter(st => st.trim() !== ""),
      difficulty
    };
  });

  // Garantia mínima de conteúdo
  if (result.solutions.length === 0) {
    result.solutions = [{
      title: "Verificação Padrão Tecnoloc",
      steps: ["Realizar inspeção visual", "Checar conexões elétricas", "Validar níveis de fluidos"],
      difficulty: "Fácil"
    }];
  }

  return result;
}

/**
 * Extrai texto de um PDF usando pdfjs-dist
 */
async function extractTextFromPDF(pdfBase64: string): Promise<string> {
  try {
    // Importar dinamicamente para evitar problemas de build
    const pdfjsLib = await import('pdfjs-dist');
    
    // Configurar worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

    // Converter base64 para Uint8Array
    const pdfData = Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0));
    
    // Carregar PDF
    const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
    
    let fullText = '';
    
    // Extrair texto de todas as páginas
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n\n';
    }
    
    return fullText.trim();
  } catch (error) {
    console.error('Erro ao extrair texto do PDF:', error);
    throw new Error('Não foi possível extrair texto do PDF. Verifique se o arquivo está válido.');
  }
}

export const aiService = {
  analyzeEquipment: async (
    equipmentInfo: { name: string; brand: string; model: string; defect: string; category: string },
    manualContent: string | null,
    previousSolutions: string | null,
    imageBase64: string | null
  ): Promise<DiagnosticResult> => {
    
    if (!apiKey) {
      throw new Error("Chave de API da OpenAI não configurada (OPENAI_API_KEY).");
    }

    const systemInstruction = `Você é o Engenheiro Chefe de Manutenção da Tecnoloc.
Sua tarefa é diagnosticar falhas em equipamentos industriais (geradores, torres de iluminação, compressores).

DADOS DISPONÍVEIS:
- MANUAL: ${manualContent || "Não disponível"}.
- HISTÓRICO: ${previousSolutions || "Sem registros anteriores"}.
- CATEGORIA: ${equipmentInfo.category.toUpperCase()}.

REGRAS DE OURO:
1. Forneça pelo menos 3 causas prováveis.
2. Cada solução deve ser um plano detalhado com NO MÍNIMO 3 passos claros.
3. Use terminologia técnica precisa mas instruções práticas para o canteiro de obras.
4. O campo 'difficulty' deve ser obrigatoriamente: 'Fácil', 'Média' ou 'Difícil'.

FORMATO OBRIGATÓRIO (JSON):
{
  "possible_causes": ["Causa 1", "Causa 2", "Causa 3"],
  "solutions": [
    {
      "title": "Título da Solução",
      "steps": ["Passo 1", "Passo 2", "Passo 3"],
      "difficulty": "Fácil"
    }
  ]
}`;

    const userPrompt = `EQUIPAMENTO: ${equipmentInfo.name} (${equipmentInfo.brand} ${equipmentInfo.model})
DEFEITO: "${equipmentInfo.defect}"
Gere um diagnóstico técnico rigoroso e um plano de ação completo.`;

    // Montagem do conteúdo da mensagem do usuário (Texto + Imagem Opcional)
    let userContent: any;
    
    if (imageBase64) {
      userContent = [
        { type: "text", text: userPrompt },
        { 
          type: "image_url", 
          image_url: { 
            url: `data:image/jpeg;base64,${imageBase64}`,
            detail: "high"
          } 
        }
      ];
    } else {
      userContent = userPrompt;
    }

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: userContent }
        ],
        response_format: { type: "json_object" },
        temperature: 0.2, // Baixa temperatura para maior precisão técnica
      });

      const text = response.choices[0].message.content;
      if (!text) throw new Error("A IA retornou uma resposta vazia.");
      
      const parsed = JSON.parse(text);

      const sanitized = sanitizeResult(parsed);

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/240d5f97-0e7f-435f-997f-7f599a21e610',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          id:`log_${Date.now()}_aiService`,
          timestamp:Date.now(),
          location:'services/aiService.ts:analyzeEquipment',
          message:'Sanitized diagnostic result summary',
          data:{
            possibleCausesCount:sanitized.possible_causes.length,
            solutionsCount:sanitized.solutions.length
          },
          runId:'pre-fix',
          hypothesisId:'H1'
        })
      }).catch(()=>{});
      // #endregion

      return sanitized;
      
    } catch (error: any) {
      console.error("Erro Crítico OpenAI Service:", error);
      throw new Error(`Falha no Diagnóstico GPT-4o: ${error.message}`);
    }
  },

  /**
   * Extrai falhas e resoluções de um documento PDF usando IA visão
   */
  extractFailuresFromPDF: async (
    pdfBase64: string,
    equipamento: string,
    modelo: string,
    categoria: 'eletrica' | 'mecanica'
  ): Promise<Array<{ titulo: string; falha: string; resolucao: string }>> => {
    if (!apiKey) {
      throw new Error("Chave de API da OpenAI não configurada (OPENAI_API_KEY).");
    }

    try {
      // Primeiro, extrair texto do PDF
      const pdfText = await extractTextFromPDF(pdfBase64);
      
      if (!pdfText || pdfText.trim().length === 0) {
        throw new Error("O PDF não contém texto legível ou está vazio.");
      }

      const systemPrompt = `Você é um especialista em análise de documentos técnicos de manutenção. 
Sua tarefa é extrair de um documento de texto uma lista estruturada de falhas e suas resoluções.

EQUIPAMENTO: ${equipamento}
MODELO: ${modelo}
CATEGORIA: ${categoria === 'eletrica' ? 'Elétrica' : 'Mecânica'}

CONTEÚDO DO DOCUMENTO:
${pdfText}

Para cada falha encontrada no documento, extraia:
1. Um título curto e descritivo da falha
2. A descrição completa do sintoma/falha
3. Os passos detalhados de resolução

FORMATO DE SAÍDA (JSON válido):
{
  "failures": [
    {
      "titulo": "Título descritivo (5-10 palavras)",
      "falha": "Descrição completa do sintoma/falha conforme documento",
      "resolucao": "Passos numerados ou detalhados de resolução conforme documento"
    }
  ]
}

IMPORTANTE:
- Mantenha a linguagem e terminologia do documento original
- Se houver múltiplas falhas, crie uma entrada para cada uma
- Se não encontrar falhas estruturadas, tente extrair informações de problemas/soluções mencionados
- Sempre retorne um JSON válido`;

      const userPrompt = `Analise o conteúdo do documento acima e extraia todas as falhas/problemas e suas resoluções. 
O documento é um manual de manutenção para um ${equipamento} modelo ${modelo} da categoria ${categoria}.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { 
            role: "system", 
            content: systemPrompt 
          },
          { 
            role: "user", 
            content: userPrompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.5,
        max_tokens: 4096
      });

      const text = response.choices[0].message.content;
      if (!text) throw new Error("A IA retornou uma resposta vazia ao processar o PDF.");

      const parsed = JSON.parse(text);
      const failures = Array.isArray(parsed.failures) ? parsed.failures : [];

      if (failures.length === 0) {
        throw new Error("Nenhuma falha foi encontrada no PDF. Verifique se o documento contém informações de falhas e resoluções.");
      }

      // Validar estrutura de cada falha
      const validFailures = failures.filter((f: any) => 
        f.titulo && typeof f.titulo === 'string' &&
        f.falha && typeof f.falha === 'string' &&
        f.resolucao && typeof f.resolucao === 'string'
      );

      if (validFailures.length === 0) {
        throw new Error("O formato das falhas extraídas é inválido. Tente com outro documento.");
      }

      return validFailures;

    } catch (error: any) {
      console.error("Erro ao extrair falhas do PDF:", error);
      throw new Error(`Erro ao processar PDF: ${error.message}`);
    }
  }
};
