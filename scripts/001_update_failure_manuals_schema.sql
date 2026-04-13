-- Migration: Adicionar campos código, causa_provável e ação_técnica à tabela failure_manuals
-- Data: 2026-04-13

-- Verificar se a tabela existe e fazer backup (opcional)
-- CREATE TABLE failure_manuals_backup AS SELECT * FROM failure_manuals;

-- Adicionar novas colunas se não existirem
ALTER TABLE failure_manuals
ADD COLUMN IF NOT EXISTS codigo VARCHAR(50),
ADD COLUMN IF NOT EXISTS descricao TEXT,
ADD COLUMN IF NOT EXISTS causa_provavel TEXT,
ADD COLUMN IF NOT EXISTS acao_tecnica TEXT;

-- Verificar a estrutura final
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'failure_manuals' ORDER BY ordinal_position;

-- Índices opcionais para busca rápida por código
CREATE INDEX IF NOT EXISTS idx_failure_manuals_codigo ON failure_manuals(codigo);
CREATE INDEX IF NOT EXISTS idx_failure_manuals_equipamento ON failure_manuals(equipamento);
CREATE INDEX IF NOT EXISTS idx_failure_manuals_marca_modelo ON failure_manuals(marca, modelo);
