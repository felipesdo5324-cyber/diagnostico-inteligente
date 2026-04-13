import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Upload, FileText, Download, Trash2 } from 'lucide-react';
import { dataService } from '../services/dataService';
import { toast } from 'sonner';

interface FailureManual {
  id: string;
  titulo: string;
  categoria: 'eletrica' | 'mecanica';
  equipamento: string;
  marca: string;
  modelo: string;
  codigo?: string | null;
  descricao?: string;
  causa_provavel?: string;
  acao_tecnica?: string;
  falha?: string;
  resolucao?: string;
  attachment_url?: string;
  file_url?: string;
  created_at: string;
}

export default function ManualCadastroPage() {
  const [abaAtiva, setAbaAtiva] = useState<'upload' | 'visualizacao'>('upload');
  const [fileSelected, setFileSelected] = useState<File | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [equipamento, setEquipamento] = useState('');
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [categoria, setCategoria] = useState<'eletrica' | 'mecanica'>('mecanica');
  const [uploading, setUploading] = useState(false);
  const [manuais, setManuais] = useState<FailureManual[]>([]);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    carregarManuais();
  }, []);

  const carregarManuais = async () => {
    try {
      setCarregando(true);
      const data = await dataService.getFailureManuals();
      setManuais(data || []);
    } catch (error: any) {
      toast.error('Erro ao carregarmanuais: ' + error.message);
    } finally {
      setCarregando(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFileSelected(e.target.files[0]);
    }
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setPhotoFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fileSelected) {
      toast.error('Selecione um arquivo PDF');
      return;
    }

    if (!equipamento.trim()) {
      toast.error('Preencha o equipamento');
      return;
    }

    if (!marca.trim()) {
      toast.error('Preencha a marca');
      return;
    }

    if (!modelo.trim()) {
      toast.error('Preencha o modelo');
      return;
    }

    setUploading(true);
    try {
      const { file_path, file_url } = await dataService.uploadFile(fileSelected);
      let photoUrl: string | undefined;
      if (photoFile) {
        const photoUpload = await dataService.uploadFile(photoFile);
        photoUrl = photoUpload.file_url;
      }

      toast.loading('Upload do PDF concluído, processando no servidor...');

      const response = await fetch('/api/extract-failures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: file_path, fileUrl: file_url, photoUrl, equipamento, marca, modelo, categoria }),
      });

      if (!response.ok) {
        const body = await response.json();
        throw new Error(body?.error || 'Erro no processamento do servidor');
      }

      const result = await response.json();
      const extracted = result.failures as Array<{ 
        codigo?: string | null;
        descricao?: string;
        titulo?: string;
        falha?: string;
        causa_provavel?: string;
        acao_tecnica?: string;
        resolucao?: string;
      }>;

      if (!extracted || extracted.length === 0) {
        throw new Error('Nenhuma falha foi extraída do PDF');
      }

      for (const failure of extracted) {
        await dataService.saveFailureManual({
          categoria,
          equipamento,
          marca,
          modelo,
          codigo: failure.codigo || null,
          descricao: failure.descricao || failure.titulo || 'Falha extraída',
          causa_provavel: failure.causa_provavel || failure.falha || '',
          acao_tecnica: failure.acao_tecnica || failure.resolucao || '',
          attachment_url: photoUrl,
          fileUrl: file_url,
        });
      }

      toast.success(`${extracted.length} falhas foram cadastradas com sucesso!`);
      setFileSelected(null);
      setPhotoFile(null);
      setEquipamento('');
      setMarca('');
      setModelo('');
      setAbaAtiva('visualizacao');
      carregarManuais();
    } catch (error: any) {
      toast.error('Erro ao processar PDF: ' + error.message);
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente deletar este manual?')) return;

    try {
      await dataService.deleteFailureManual(id);
      toast.success('Manual deletado com sucesso!');
      carregarManuais();
    } catch (error: any) {
      toast.error('Erro ao deletar: ' + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="p-2 hover:bg-slate-100 rounded-lg transition">
              <ArrowLeft className="w-6 h-6 text-slate-600" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Manual de Falhas</h1>
              <p className="text-sm text-slate-500">Cadastro e gestão de manuais técnicos</p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex gap-4 mb-8">
          <button
            onClick={() => setAbaAtiva('upload')}
            className={`px-6 py-3 font-medium rounded-lg transition ${
              abaAtiva === 'upload'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
            }`}
          >
            <Upload className="w-4 h-4 inline mr-2" />
            Upload de PDF
          </button>
          <button
            onClick={() => setAbaAtiva('visualizacao')}
            className={`px-6 py-3 font-medium rounded-lg transition ${
              abaAtiva === 'visualizacao'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
            }`}
          >
            <FileText className="w-4 h-4 inline mr-2" />
            Manuais Cadastrados ({manuais.length})
          </button>
        </div>

        {/* Upload Tab */}
        {abaAtiva === 'upload' && (
          <div className="bg-white rounded-lg shadow p-8 max-w-2xl">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* File Upload */}
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-indigo-400 transition cursor-pointer"
                   onClick={() => document.getElementById('file-input')?.click()}>
                <Upload className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                <p className="text-lg font-medium text-slate-700 mb-1">
                  {fileSelected ? fileSelected.name : 'Clique ou arraste um PDF'}
                </p>
                <p className="text-sm text-slate-500">Máximo 50MB</p>
                <input 
                  id="file-input"
                  type="file" 
                  accept=".pdf" 
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {/* Campos */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Equipamento</label>
                <input
                  type="text"
                  value={equipamento}
                  onChange={(e) => setEquipamento(e.target.value)}
                  placeholder="Ex: Motor Diesel Cummins"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Marca</label>
                <input
                  type="text"
                  value={marca}
                  onChange={(e) => setMarca(e.target.value)}
                  placeholder="Ex: Cummins"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Modelo</label>
                <input
                  type="text"
                  value={modelo}
                  onChange={(e) => setModelo(e.target.value)}
                  placeholder="Ex: ISF 3.8"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Foto do Alarme (opcional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoSelect}
                  className="w-full text-sm text-slate-600"
                />
                {photoFile && (
                  <p className="text-xs text-slate-500 mt-2">Arquivo selecionado: {photoFile.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Categoria</label>
                <select
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value as 'eletrica' | 'mecanica')}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="mecanica">Mecânica</option>
                  <option value="eletrica">Elétrica</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={uploading || !fileSelected}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white font-medium py-3 rounded-lg transition"
              >
                {uploading ? 'Processando...' : 'Enviar e Processar'}
              </button>
            </form>
          </div>
        )}

        {/* Visualization Tab */}
        {abaAtiva === 'visualizacao' && (
          <div className="space-y-4">
            {carregando ? (
              <div className="text-center py-12">
                <p className="text-slate-600">Carregando manuais...</p>
              </div>
            ) : manuais.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-600 font-medium">Nenhum manual cadastrado ainda</p>
                <p className="text-sm text-slate-500 mt-1">Faça upload de um PDF para começar</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {manuais.map((manual) => (
                  <div key={manual.id} className="bg-white rounded-lg shadow p-6 hover:shadow-md transition">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-bold text-lg text-slate-900">{manual.titulo}</h3>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            manual.categoria === 'mecanica'
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {manual.categoria === 'mecanica' ? 'Mecânica' : 'Elétrica'}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(manual.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Deletar"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Grid de informações */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-slate-500 font-semibold uppercase">Equipamento</p>
                        <p className="text-sm text-slate-700">{manual.equipamento}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-semibold uppercase">Marca / Modelo</p>
                        <p className="text-sm text-slate-700">{manual.marca} / {manual.modelo}</p>
                      </div>
                      {manual.codigo && (
                        <div>
                          <p className="text-xs text-slate-500 font-semibold uppercase">Código</p>
                          <p className="text-sm text-slate-700 font-mono bg-slate-50 px-2 py-1 rounded">{manual.codigo}</p>
                        </div>
                      )}
                    </div>

                    {/* Descrição */}
                    {manual.descricao && (
                      <div className="mb-4 pb-4 border-b border-slate-200">
                        <p className="text-xs text-slate-500 font-semibold uppercase">Descrição</p>
                        <p className="text-sm text-slate-700 leading-relaxed">{manual.descricao}</p>
                      </div>
                    )}

                    {/* Causa Provável */}
                    {manual.causa_provavel && (
                      <div className="mb-4 pb-4 border-b border-slate-200">
                        <p className="text-xs text-slate-500 font-semibold uppercase">Causa Provável</p>
                        <p className="text-sm text-slate-700 leading-relaxed">{manual.causa_provavel}</p>
                      </div>
                    )}

                    {/* Ação Técnica */}
                    {manual.acao_tecnica && (
                      <div className="mb-4">
                        <p className="text-xs text-slate-500 font-semibold uppercase">Ação Técnica (Resolução)</p>
                        <p className="text-sm text-slate-700 leading-relaxed">{manual.acao_tecnica}</p>
                      </div>
                    )}

                    {/* Fallback para campos antigos */}
                    {!manual.descricao && manual.falha && (
                      <div className="mb-4 pb-4 border-b border-slate-200">
                        <p className="text-xs text-slate-500 font-semibold uppercase">Falha</p>
                        <p className="text-sm text-slate-700 leading-relaxed">{manual.falha}</p>
                      </div>
                    )}
                    {!manual.acao_tecnica && manual.resolucao && (
                      <div className="mb-4">
                        <p className="text-xs text-slate-500 font-semibold uppercase">Resolução</p>
                        <p className="text-sm text-slate-700 leading-relaxed">{manual.resolucao}</p>
                      </div>
                    )}

                    {/* Links para anexos */}
                    <div className="flex gap-3 pt-4 border-t border-slate-200">
                      {manual.file_url && (
                        <a href={manual.file_url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline text-sm font-medium">
                          📄 PDF
                        </a>
                      )}
                      {manual.attachment_url && (
                        <a href={manual.attachment_url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline text-sm font-medium">
                          📷 Foto
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
