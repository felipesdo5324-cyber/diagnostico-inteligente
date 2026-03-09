
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
 * Normaliza a resposta da IA (novo formato estruturado) para o contrato DiagnosticResult.
 *
 * Mapeamento do novo formato JSON:
 *   possible_causes ← sintomas_identificados + causa_provavel
 *   solutions[0]    ← avisos_seguranca (prefixados) + passos_resolucao
 *                     título = referencia_manual ou 'Plano de Resolução Técnica'
 */
function sanitizeResult(data: any): DiagnosticResult {
  const result: DiagnosticResult = {
    possible_causes: [],
    solutions: []
  };

  if (!data || typeof data !== 'object') return result;

  // ── Diagnóstico não encontrado no manual ─────────────────────────────────
  if (data.status_diagnostico === 'nao_encontrado') {
    result.possible_causes = ['Manual técnico não cobre este sintoma. Consulte o suporte Tecnoloc.'];
    result.solutions = [{
      title: 'Verificação Padrão Tecnoloc',
      steps: ['Realizar inspeção visual', 'Checar conexões elétricas', 'Validar níveis de fluidos'],
      difficulty: 'Fácil'
    }];
    return result;
  }

  // ── Causas: sintomas identificados + causa provável ──────────────────────
  const sintomas: string[] = Array.isArray(data.sintomas_identificados)
    ? data.sintomas_identificados.map(forceString).filter((s: string) => s.trim() !== '')
    : [];
  const causaProvavel = forceString(data.causa_provavel || '').trim();
  if (causaProvavel) sintomas.push(causaProvavel);
  result.possible_causes = sintomas.length > 0 ? sintomas : ['Causa não identificada no manual.'];

  // ── Passos: avisos de segurança (prefixados) + passos de resolução ────────
  const avisos: string[] = Array.isArray(data.avisos_seguranca)
    ? data.avisos_seguranca.map((a: any) => `⚠️ SEGURANÇA: ${forceString(a)}`).filter((s: string) => s.trim() !== '')
    : [];
  const passos: string[] = Array.isArray(data.passos_resolucao)
    ? data.passos_resolucao.map(forceString).filter((s: string) => s.trim() !== '')
    : [];
  const allSteps = [...avisos, ...passos];

  const refManual = forceString(data.referencia_manual || '').trim();
  const solutionTitle = refManual
    ? `Resolução Técnica — ${refManual}`
    : 'Plano de Resolução Técnica';

  result.solutions = [{
    title: solutionTitle,
    steps: allSteps.length > 0 ? allSteps : ['Consultar técnico especializado.'],
    difficulty: 'Média'
  }];

  return result;
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

    // Limite de tokens: ~30k TPM. Manual truncado a 20.000 chars (~5.000 tokens).
    const MAX_MANUAL_CHARS = 20000;
    const trimmedManual = manualContent && manualContent.length > MAX_MANUAL_CHARS
      ? manualContent.slice(0, MAX_MANUAL_CHARS) + '\n...[conteúdo truncado para respeitar limite de tokens]'
      : manualContent;

    const systemInstruction = `<role>
Você é um Especialista Sênior em Manutenção e Diagnóstico de Máquinas. Sua função é analisar problemas técnicos relatados por operadores e fornecer soluções precisas e seguras.
</role>

<objective>
Diagnosticar a causa raiz do problema relatado pelo usuário e fornecer um passo a passo para a resolução, baseando-se EXCLUSIVAMENTE nos manuais técnicos fornecidos no contexto.
</objective>

<constraints>
1. GROUNDING ESTRITO: Baseie sua resposta APENAS no texto contido na tag <manual_tecnico>. Não utilize seu conhecimento prévio para inventar passos de manutenção.
2. ANTI-ALUCINAÇÃO: Se as informações no <manual_tecnico> não forem suficientes para resolver o <problema_usuario>, você deve definir o status como "nao_encontrado" e afirmar que o manual não cobre este sintoma.
3. SEGURANÇA: Sempre priorize e liste os avisos de segurança (EPIs, desligar energia, etc.) mencionados no manual antes dos passos de resolução.
</constraints>

<instructions>
Antes de gerar a saída final, processe a informação usando o seguinte raciocínio:
1. Analise o <problema_usuario> e extraia sintomas chave ou códigos de erro.
2. Vasculhe o <manual_tecnico> em busca de correspondências exatas ou semânticas para esses sintomas.
3. Identifique a causa provável listada no manual.
4. Extraia os passos de resolução e os avisos de segurança associados a essa causa.
</instructions>

<output_format>
Retorne a resposta ESTRITAMENTE no formato JSON abaixo. Não inclua textos antes ou depois do JSON. Não inclua formatação markdown.

{
  "status_diagnostico": "sucesso" | "nao_encontrado",
  "sintomas_identificados": ["sintoma 1", "sintoma 2"],
  "causa_provavel": "Descrição da causa segundo o manual",
  "avisos_seguranca": ["aviso 1", "aviso 2"],
  "passos_resolucao": ["1. Passo um...", "2. Passo dois..."],
  "referencia_manual": "Página ou seção de onde a informação foi extraída"
}
</output_format>

<manual_tecnico>
${trimmedManual
  ? trimmedManual
  : 'Manual técnico não disponível para este equipamento.'}
${previousSolutions ? `\n=== EXPERIÊNCIAS ANTERIORES DE CAMPO ===\n${previousSolutions}\n===` : ''}
</manual_tecnico>`;

    const userPrompt = `<problema_usuario>
Equipamento: ${equipmentInfo.name} (${equipmentInfo.brand} ${equipmentInfo.model})
Categoria do defeito: ${equipmentInfo.category.toUpperCase()}
Defeito relatado: "${equipmentInfo.defect}"
</problema_usuario>`;

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
        temperature: 0.1, // Mínimo para máxima fidelidade ao manual
        max_tokens: 2048, // Mantém resposta detalhada dentro do limite de 30k TPM
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
  }
};
