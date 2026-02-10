import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        // Exponibiliza a chave da OpenAI para o frontend de forma compatível com o helper getCredential(...)
        // Use no .env um dos formatos abaixo:
        // - OPENAI_API_KEY=xxxxxxxx
        // - VITE_OPENAI_API_KEY=xxxxxxxx
        'process.env.OPENAI_API_KEY': JSON.stringify(env.OPENAI_API_KEY || env.VITE_OPENAI_API_KEY || ''),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
          // Força Vite a usar exatamente as cópias de React/ReactDOM do node_modules local,
          // evitando que qualquer outra versão pré-bundlada ou externa seja usada.
          'react': path.resolve(__dirname, 'node_modules/react'),
          'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
        }
      }
    };
});
