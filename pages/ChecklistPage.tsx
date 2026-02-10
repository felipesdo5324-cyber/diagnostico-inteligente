
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ClipboardCheck, 
  Search, 
  Loader2, 
  CheckCircle2, 
  Upload, 
  FileText, 
  Send, 
  FileCheck, 
  ArrowLeft 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label, Select, Checkbox, Textarea } from '../components/UI';
import { toast } from 'sonner';

export default function ChecklistPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'search' | 'manage'>('search');
  const [equipmentType, setEquipmentType] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [checklists, setChecklists] = useState<any>(null);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  
  // Finalização
  const [showFinalizationForm, setShowFinalizationForm] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [finalizationData, setFinalizationData] = useState({
    equipment_name: '',
    patrimonio: '',
    horimetro: '',
    technician_name: '',
    email: ''
  });
  
  // Upload form
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadFormData, setUploadFormData] = useState({
    equipment_type: 'torre',
    equipment_name: '',
    brand: '',
    model: '',
    description: '',
  });

  // MOCK: Dados simulados
  const mockChecklistData = {
    equipment_info: { name: 'Torre MLT6SKD', type: 'torre' },
    checklists: [
      {
        title: 'Motor e Níveis',
        category: 'preventiva',
        items: [
          { description: 'Nível de óleo do motor', critical: true },
          { description: 'Nível de água do radiador', critical: true },
          { description: 'Vazamentos de fluidos', critical: true },
        ]
      },
      {
        title: 'Sistema Elétrico',
        category: 'funcionamento',
        items: [
          { description: 'Bateria e cabos', critical: false },
          { description: 'Lâmpadas dos refletores', critical: false },
          { description: 'Painel de controle', critical: true },
        ]
      },
      {
        title: 'Estrutura',
        category: 'carenagem',
        items: [
          { description: 'Pneus e calibragem', critical: false },
          { description: 'Patolas de fixação', critical: true },
          { description: 'Pintura e adesivos', critical: false },
        ]
      }
    ]
  };

  const handleSearch = async () => {
    if (!equipmentType) {
      toast.error('Selecione o tipo de equipamento');
      return;
    }
    setIsSearching(true);
    setChecklists(null);
    setCheckedItems({});
    setTimeout(() => {
      setChecklists(mockChecklistData);
      setIsSearching(false);
    }, 1000);
  };

  const toggleCheckItem = (checklistIdx: number, itemIdx: number) => {
    const key = `${checklistIdx}-${itemIdx}`;
    setCheckedItems(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'preventiva': 'bg-yellow-100 text-yellow-800 border-yellow-300',
      'funcionamento': 'bg-blue-100 text-blue-800 border-blue-300',
      'limpeza': 'bg-green-100 text-green-800 border-green-300',
      'pintura': 'bg-purple-100 text-purple-800 border-purple-300',
      'carenagem': 'bg-indigo-100 text-indigo-800 border-indigo-300'
    };
    return colors[category] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const equipmentTypeLabels: Record<string, string> = {
    'torre': 'Torre de Iluminação',
    'gerador': 'Gerador',
    'maquina_solda': 'Máquina de Solda',
    'outro': 'Outro'
  };

  const handleFinalize = async () => {
    if (!finalizationData.technician_name) {
      toast.error('Preencha seu nome');
      return;
    }
    setIsSending(true);
    setTimeout(() => {
      toast.success(`Checklist finalizado com sucesso!\nEnviado para: ${finalizationData.email || 'Processamento técnico'}`);
      setIsSending(false);
      setShowFinalizationForm(false);
      navigate('/');
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto">
        
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <Button variant="ghost" className="pl-0 hover:bg-transparent mb-2 text-slate-600" onClick={() => navigate('/')}>
               <ArrowLeft className="w-4 h-4 mr-2" /> Voltar ao Menu
            </Button>
            <div className="flex items-center gap-3">
              <ClipboardCheck className="w-8 h-8 text-orange-600" />
              <h1 className="text-3xl font-black text-gray-900 tracking-tight">Checklist de Manutenção</h1>
            </div>
            <p className="text-slate-500 mt-1 font-medium">Gerencie e execute inspeções técnicas de frotas.</p>
          </div>
        </div>

        {/* Custom Tabs */}
        <div className="flex p-1 bg-slate-200 rounded-xl mb-8 max-w-sm">
          <button 
            onClick={() => setActiveTab('search')}
            className={`flex-1 flex items-center justify-center py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'search' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Search className="w-4 h-4 mr-2" /> Realizar
          </button>
          <button 
            onClick={() => setActiveTab('manage')}
            className={`flex-1 flex items-center justify-center py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'manage' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Upload className="w-4 h-4 mr-2" /> Cadastrar
          </button>
        </div>

        {activeTab === 'search' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <Card>
              <CardHeader>
                <CardTitle>Selecione o Equipamento</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <Label>Tipo de Equipamento</Label>
                    <Select value={equipmentType} onValueChange={setEquipmentType}>
                      <option value="">Selecione o tipo...</option>
                      <option value="torre">Torre de Iluminação</option>
                      <option value="gerador">Gerador</option>
                      <option value="maquina_solda">Máquina de Solda</option>
                      <option value="outro">Outro</option>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button 
                      onClick={handleSearch}
                      disabled={isSearching}
                      variant="orange"
                      className="w-full md:w-auto h-[42px] px-8"
                    >
                      {isSearching ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Buscando...</>
                      ) : (
                        <><Search className="w-4 h-4 mr-2" /> Iniciar Checklist</>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {checklists && (
              <div className="space-y-6">
                <Card className="bg-gradient-to-r from-orange-50 to-white border-l-4 border-l-orange-500">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600">
                        <ClipboardCheck className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">
                          {checklists.equipment_info.name}
                        </h3>
                        <p className="text-slate-500 font-medium capitalize">
                          {equipmentTypeLabels[checklists.equipment_info.type]}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {checklists.checklists?.map((group: any, checklistIdx: number) => (
                  <Card key={checklistIdx}>
                    <CardHeader className="bg-slate-50/50 flex flex-row items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                        <CardTitle className="text-lg">{group.title}</CardTitle>
                      </div>
                      <span className={`px-2 py-1 rounded text-[10px] font-black uppercase border ${getCategoryColor(group.category)}`}>
                        {group.category}
                      </span>
                    </CardHeader>
                    <CardContent className="grid gap-3">
                      {group.items?.map((item: any, itemIdx: number) => {
                        const itemKey = `${checklistIdx}-${itemIdx}`;
                        const isChecked = !!checkedItems[itemKey];
                        
                        return (
                          <div 
                            key={itemIdx}
                            onClick={() => toggleCheckItem(checklistIdx, itemIdx)}
                            className={`flex items-start gap-4 p-4 rounded-xl border-2 transition-all cursor-pointer hover:border-indigo-200 ${
                              isChecked 
                                ? 'bg-green-50 border-green-500' 
                                : item.critical 
                                  ? 'bg-white border-red-100 hover:border-red-300' 
                                  : 'bg-white border-slate-100 hover:border-slate-300'
                            }`}
                          >
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={() => toggleCheckItem(checklistIdx, itemIdx)}
                            />
                            <div className="flex-1">
                              <p className={`text-sm font-bold ${isChecked ? 'text-green-900' : 'text-slate-700'}`}>
                                {item.description}
                              </p>
                            </div>
                            {item.critical && !isChecked && (
                              <span className="px-2 py-0.5 bg-red-100 text-red-600 text-[9px] font-black uppercase tracking-wide rounded">
                                Crítico
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                ))}

                <Card className="border-t-4 border-t-green-500">
                  <CardHeader className="bg-slate-50">
                    <CardTitle className="flex items-center gap-2 text-slate-800">
                      <FileCheck className="w-5 h-5" />
                      Finalizar Inspeção
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {!showFinalizationForm ? (
                      <Button 
                        onClick={() => setShowFinalizationForm(true)}
                        variant="success"
                        className="w-full h-14 text-lg"
                      >
                        <Send className="w-5 h-5 mr-2" />
                        Concluir e Assinar
                      </Button>
                    ) : (
                      <div className="space-y-6 animate-in fade-in">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label>Patrimônio *</Label>
                            <Input
                              value={finalizationData.patrimonio}
                              onChange={(e) => setFinalizationData({...finalizationData, patrimonio: e.target.value})}
                              placeholder="Ex: PAT-001234"
                            />
                          </div>
                          <div>
                            <Label>Horímetro Atual *</Label>
                            <Input
                              value={finalizationData.horimetro}
                              onChange={(e) => setFinalizationData({...finalizationData, horimetro: e.target.value})}
                              placeholder="Ex: 1250 h"
                              type="number"
                            />
                          </div>
                          <div>
                            <Label>Nome do Técnico *</Label>
                            <Input
                              value={finalizationData.technician_name}
                              onChange={(e) => setFinalizationData({...finalizationData, technician_name: e.target.value})}
                              placeholder="Seu nome completo"
                            />
                          </div>
                          <div>
                            <Label>E-mail do Supervisor</Label>
                            <Input
                              type="email"
                              value={finalizationData.email}
                              onChange={(e) => setFinalizationData({...finalizationData, email: e.target.value})}
                              placeholder="supervisor@tecnoloc.com"
                            />
                          </div>
                        </div>
                        
                        <div className="flex gap-3 justify-end pt-4">
                          <Button 
                            variant="ghost" 
                            onClick={() => setShowFinalizationForm(false)}
                            disabled={isSending}
                          >
                            Cancelar
                          </Button>
                          <Button 
                            onClick={handleFinalize}
                            disabled={isSending}
                            variant="success"
                            className="px-10"
                          >
                            {isSending ? (
                              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</>
                            ) : (
                              <><Send className="w-4 h-4 mr-2" /> Enviar Relatório</>
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}

        {activeTab === 'manage' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-800">Modelos de Checklist</h2>
              <Button onClick={() => setShowUploadForm(!showUploadForm)} variant="orange">
                <Upload className="w-4 h-4 mr-2" /> Novo Modelo
              </Button>
            </div>

            {showUploadForm && (
              <Card className="mb-6 bg-orange-50/20 border-orange-100">
                <CardHeader>
                  <CardTitle>Cadastrar Novo Checklist (via PDF/IA)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label>Equipamento</Label>
                        <Input placeholder="Nome do modelo" value={uploadFormData.equipment_name} onChange={e => setUploadFormData({...uploadFormData, equipment_name: e.target.value})} />
                      </div>
                      <div>
                        <Label>Processamento IA</Label>
                         <div className="p-8 border-2 border-dashed border-slate-300 rounded-xl bg-white text-center cursor-pointer hover:border-orange-500 transition-colors">
                            <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                            <p className="text-xs text-slate-500">Clique para enviar o manual PDF para extração automática de itens</p>
                         </div>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => setShowUploadForm(false)}>Cancelar</Button>
                        <Button variant="orange" disabled>Extrair e Salvar</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="text-center py-24 bg-white rounded-2xl border-2 border-dashed border-slate-200">
               <FileText className="w-16 h-16 mx-auto text-slate-200 mb-4" />
               <p className="text-slate-400 font-medium">Nenhum modelo customizado encontrado.</p>
               <p className="text-xs text-slate-300">Use os modelos padrão para realizar inspeções.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
