export interface DiagnosticResult {
  possible_causes: string[];
  solutions: {
    title: string;
    steps: string[];
    difficulty: 'Fácil' | 'Média' | 'Difícil';
  }[];
}

export interface MaintenanceLog {
  id: string;
  equipment_model: string;
  equipment_name: string;
  brand: string;
  defect_category: 'eletrico' | 'mecanico' | 'ambos';
  defect_description: string;
  diagnosis: DiagnosticResult;
  status: 'Resolvido' | 'Pendente';
  resolution_type: 'salvar_depois' | 'conforme_manual' | 'forma_diferente';
  technician_notes: string;
  attachment_notes?: string;
  date: string;
}

export interface Manual {
  id: string;
  equipment_name: string;
  brand: string;
  model: string;
  manual_type: 'usuario' | 'tecnico' | 'manutencao' | 'outro';
  manual_category: 'eletrico' | 'mecanico' | 'ambos';
  description: string;
  file_url: string;
  file_name: string;
}
