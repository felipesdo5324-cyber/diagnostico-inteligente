
import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Loader2, CheckCircle, ArrowLeft,
  ShieldCheck, Camera, X, ImageIcon,
  Wrench, Zap, Layers, FileText, Send, AlertCircle
} from 'lucide-react';
import { aiService } from '../services/aiService';
import { dataService } from '../services/dataService';
import { DiagnosticResult } from '../types';
import { Card, CardContent, CardHeader, Button, Input, Label, Textarea, Badge } from '../components/UI';
import { toast } from 'sonner';

export default function DiagnosticPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    equipment_name: '', brand: '', model: '', defect_description: '',
    defect_category: 'ambos' as 'eletrico' | 'mecanico' | 'ambos'
  });
  
  const [selectedImage, setSelectedImage] = useState<File | null>(null); 
  const [imagePreview, setImagePreview] = useState<string | null>(null);   
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [diagnosisResult, setDiagnosisResult] = useState<DiagnosticResult | null>(null);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  
  const [resolutionType, setResolutionType] = useState<'salvar_depois' | 'conforme_manual' | 'forma_diferente'>('conforme_manual');
  const [technicianName, setTechnicianName] = useState("");
  const [actualSolution, setActualSolution] = useState("");
  const [attachmentNotes, setAttachmentNotes] = useState("");

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleAnalyze = async () => {
    if (!formData.equipment_name || (!formData.defect_description && !selectedImage)) {
      toast.error('Identifique o equipamento e descreva o problema.');
      return;
    }
    
    setIsAnalyzing(true);
    setErrorStatus(null);
    setDiagnosisResult(null);

    try {
      const manual = await dataService.findManualByModel(formData.model);
      const allLogs = await dataService.getLogs();
      const fieldTips = allLogs
        .filter(l => l.equipment_model === formData.model || l.defect_category === formData.defect_category)
        .slice(0, 3)
        .map(l => `Experiência: ${l.defect_description} -> Solução: ${l.technician_notes}`)
        .join('\n');

      let base64Image = null;
      if (selectedImage) {
        base64Image = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve((e.target?.result as string).split(',')[1]);
          reader.readAsDataURL(selectedImage);
        });
      }

      const result = await aiService.analyzeEquipment(
        { 
          name: formData.equipment_name, 
          brand: formData.brand, 
          model: formData.model, 
          defect: formData.defect_description, 
          category: formData.defect_category 
        },
        manual?.description || null,
        fieldTips || null,
        base64Image
      );

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/240d5f97-0e7f-435f-997f-7f599a21e610',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          id:`log_${Date.now()}_diagnosticPage`,
          timestamp:Date.now(),
          location:'pages/DiagnosticPage.tsx:handleAnalyze',
          message:'Received diagnostic result from aiService',
          data:{
            possibleCausesCount:result.possible_causes.length,
            solutionsCount:result.solutions.length
          },
          runId:'pre-fix',
          hypothesisId:'H1'
        })
      }).catch(()=>{});
      // #endregion

      setDiagnosisResult(result);
      toast.success('Análise técnica concluída!');

    } catch (error: any) {
      console.error(error);
      setErrorStatus(error.message || "Erro na análise.");
      toast.error("Falha no motor de IA.");
    } finally { 
      setIsAnalyzing(false); 
    }
  };

  const handleSaveFeedback = async () => {
    if (!technicianName) return toast.error("Informe seu nome.");
    setIsSaving(true);
    try {
      await dataService.saveLog({
        equipment_model: formData.model,
        equipment_name: formData.equipment_name,
        brand: formData.brand,
        defect_category: formData.defect_category,
        diagnosis: diagnosisResult!,
        status: resolutionType !== 'salvar_depois' ? 'Resolvido' : 'Pendente',
        resolution_type: resolutionType,
        defect_description: formData.defect_description,
        technician_notes: actualSolution,
        attachment_notes: attachmentNotes
      });
      toast.success("Histórico salvo!");
      navigate('/historico');
    } catch (error) { 
      toast.error("Erro ao salvar."); 
    } finally { 
      setIsSaving(false); 
    }
  };

  // Helper para renderizar texto de forma segura
  const renderSafeText = (val: any) => {
    if (typeof val === 'string') return val;
    if (!val) return "";
    return val.text || val.description || val.value || JSON.stringify(val);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <Button variant="ghost" onClick={() => navigate('/')} className="mb-6 group">
          <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" /> Menu Principal
        </Button>

        <Card className="border-t-4 border-t-indigo-600 shadow-xl mb-8">
          <CardHeader className="bg-slate-50/50">
            <h2 className="flex items-center gap-3 text-indigo-900 text-xl font-black uppercase tracking-tight">
              <ShieldCheck className="h-6 w-6 text-indigo-600" /> Diagnóstico com Inteligência Artificial
            </h2>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1"><Label>Equipamento</Label><Input value={formData.equipment_name} onChange={e => setFormData({...formData, equipment_name: e.target.value})} placeholder="Ex: Gerador" /></div>
              <div className="space-y-1"><Label>Marca</Label><Input value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} placeholder="Ex: Atlas Copco" /></div>
              <div className="space-y-1"><Label>Modelo</Label><Input value={formData.model} onChange={e => setFormData({...formData, model: e.target.value})} placeholder="Ex: QAS 150" /></div>
            </div>

            <div className="space-y-3">
              <Label>Tipo de Falha</Label>
              <div className="flex gap-4">
                {[{ id: 'eletrico', label: 'Elétrico', icon: <Zap className="w-4 h-4" /> }, { id: 'mecanico', label: 'Mecânico', icon: <Wrench className="w-4 h-4" /> }, { id: 'ambos', label: 'Ambos', icon: <Layers className="w-4 h-4" /> }].map((cat) => (
                  <button key={cat.id} onClick={() => setFormData({...formData, defect_category: cat.id as any})} className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all font-bold ${formData.defect_category === cat.id ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300'}`}>{cat.icon} {cat.label}</button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Relato do Técnico</Label>
              <div className="relative">
                <Textarea value={formData.defect_description} onChange={e => setFormData({...formData, defect_description: e.target.value})} placeholder="Descreva o sintoma ou erro apresentado..." className="min-h-[100px] pr-12" />
                <button onClick={() => fileInputRef.current?.click()} className="absolute bottom-3 right-3 p-2 bg-indigo-50 rounded-lg text-indigo-600 hover:bg-indigo-100 transition-colors"><Camera className="w-5 h-5" /></button>
                <input type="file" ref={fileInputRef} onChange={handleImageSelect} className="hidden" accept="image/*" />
              </div>
              {imagePreview && (
                <div className="mt-2 relative inline-block animate-in zoom-in-95">
                  <img src={imagePreview} className="h-24 rounded-lg border-2 border-white shadow-md" />
                  <button onClick={() => {setSelectedImage(null); setImagePreview(null);}} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg hover:bg-red-600 transition-transform active:scale-90">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            {errorStatus && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                <p className="text-sm text-red-700 font-medium">{errorStatus}</p>
              </div>
            )}

            <Button onClick={handleAnalyze} disabled={isAnalyzing} className="w-full h-14 font-black uppercase text-lg bg-indigo-600 shadow-xl">
              {isAnalyzing ? (
                <>
                  <Loader2 className="animate-spin mr-2" /> Analisando com ChatGPT (OpenAI)...
                </>
              ) : (
                <>
                  <Zap className="mr-2 w-5 h-5 fill-current" /> Gerar Diagnóstico Técnico
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {diagnosisResult && (
          <div className="animate-in slide-in-from-bottom-4 duration-500 space-y-8 pb-24">
            <Card className="border-l-[12px] border-l-green-600 shadow-xl relative overflow-visible">
              <div className="absolute -left-3 top-8 w-6 h-6 bg-green-600 rounded-full flex items-center justify-center text-white shadow-lg"><CheckCircle className="w-4 h-4" /></div>
              <CardHeader className="bg-green-50/50 pl-10"><h3 className="text-green-800 font-black uppercase text-sm tracking-widest">Diagnóstico Concluído</h3></CardHeader>
              <div className="p-6 space-y-8 pl-10">
                <div>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><AlertCircle className="w-3 h-3" /> Causas Prováveis</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {diagnosisResult.possible_causes.map((c, i) => (
                      <div key={i} className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm text-slate-700 font-bold flex gap-3">
                        <span className="text-indigo-400 shrink-0">•</span> 
                        <span>{renderSafeText(c)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Wrench className="w-3 h-3" /> Plano de Ação</h4>
                  <div className="space-y-4">
                    {diagnosisResult.solutions.map((s, i) => (
                      <div key={i} className="p-6 border border-indigo-50 rounded-2xl bg-white shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-center mb-4">
                          <h5 className="font-black text-slate-900 text-lg">{renderSafeText(s.title)}</h5>
                          <Badge className={`${s.difficulty === 'Fácil' ? 'bg-green-100 text-green-700' : s.difficulty === 'Média' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'} border-transparent px-3 py-1`}>{s.difficulty}</Badge>
                        </div>
                        <div className="space-y-3">
                          {s.steps.map((step, si) => (
                            <div key={si} className="text-sm text-slate-600 flex gap-4 items-start">
                              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 font-black text-[10px] shrink-0">{si+1}</span>
                              <p className="pt-0.5 leading-relaxed font-medium">{renderSafeText(step)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            <Card className="bg-slate-900 border-none shadow-2xl overflow-hidden">
              <CardHeader className="border-b border-slate-800 bg-slate-800/50"><div className="flex items-center gap-2 text-white font-black uppercase tracking-widest text-xs"><Send className="w-5 h-5 text-indigo-400" /> Registrar Solução no Banco de Dados</div></CardHeader>
              <CardContent className="space-y-6 pt-6">
                <div className="grid grid-cols-1 gap-3">
                  {[{ id: 'salvar_depois', title: 'Apenas Registro', desc: 'Registrar visita sem resolução completa.' }, { id: 'conforme_manual', title: 'Resolvido com IA', desc: 'O plano de ação da IA resolveu o problema.' }, { id: 'forma_diferente', title: 'Resolvido (Alternativo)', desc: 'Solução encontrada fora do plano da IA.' }].map((opt) => (
                    <div key={opt.id} onClick={() => setResolutionType(opt.id as any)} className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${resolutionType === opt.id ? 'bg-indigo-600 border-indigo-400' : 'bg-slate-800 border-slate-700 hover:border-slate-600'}`}>
                      <div className={`mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center ${resolutionType === opt.id ? 'border-white bg-white' : 'border-slate-500'}`}>{resolutionType === opt.id && <div className="w-2 h-2 rounded-full bg-indigo-600" />}</div>
                      <div><p className={`font-bold ${resolutionType === opt.id ? 'text-white' : 'text-slate-300'}`}>{opt.title}</p><p className={`text-xs ${resolutionType === opt.id ? 'text-indigo-100' : 'text-slate-500'}`}>{opt.desc}</p></div>
                    </div>
                  ))}
                </div>
                <div className="space-y-4 pt-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div><Label className="text-slate-400">Técnico Executor *</Label><Input className="bg-slate-800 border-slate-700 text-white focus:ring-indigo-500" placeholder="Nome completo" value={technicianName} onChange={e => setTechnicianName(e.target.value)} /></div>
                    {resolutionType === 'forma_diferente' && (<div className="animate-in fade-in"><Label className="text-indigo-400 font-bold">Resumo da Solução Real *</Label><Input className="bg-slate-800 border-indigo-900 text-white" placeholder="O que foi realizado de diferente?" value={actualSolution} onChange={e => setActualSolution(e.target.value)} /></div>)}
                  </div>
                  <div><Label className="text-slate-400">Observações Adicionais</Label><Textarea className="bg-slate-800 border-slate-700 text-white" placeholder="Peças trocadas, números de série, etc..." value={attachmentNotes} onChange={e => setAttachmentNotes(e.target.value)} /></div>
                  <Button onClick={handleSaveFeedback} disabled={isSaving} className="w-full h-14 bg-indigo-600 font-black uppercase text-lg shadow-lg">
                    {isSaving ? <Loader2 className="animate-spin" /> : 'Finalizar e Sincronizar'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
