
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, LogIn, UserPlus, ArrowRight, ShieldCheck, Loader2 } from 'lucide-react';
import { Card, CardContent, Button, Input, Label } from '../components/UI';
import { dataService } from '../services/dataService';
import { toast } from 'sonner';

export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [isForcedChange, setIsForcedChange] = useState(false);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const from = location.state?.from?.pathname || "/";
  const ADMIN_EMAIL = 'felipe.sdo17@gmail.com';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      if (isLogin) {
        await dataService.signIn(email, password);
        
        if (email.toLowerCase() === ADMIN_EMAIL.toLowerCase() && password === '123456') {
          setIsForcedChange(true);
          toast.info("Acesso Administrativo: Por favor, atualize sua senha inicial.");
        } else {
          toast.success("Acesso autorizado!");
          navigate(from, { replace: true });
        }
      } else {
        await dataService.signUp(email, password);
        toast.success("Conta criada com sucesso!");
        setIsLogin(true);
      }
    } catch (error: any) {
      toast.error(error.message || "Erro de login. Verifique suas credenciais.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) return toast.error("A senha deve ter no mínimo 6 caracteres.");
    if (newPassword === '123456') return toast.error("Por favor, escolha uma senha diferente da padrão.");
    if (newPassword !== confirmPassword) return toast.error("As senhas não coincidem.");
    
    setLoading(true);
    try {
      await dataService.updatePassword(newPassword);
      toast.success("Senha administrativa atualizada!");
      navigate(from, { replace: true });
    } catch (error: any) {
      toast.error("Erro ao atualizar: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (isForcedChange) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[#0a0f1e] font-sans relative overflow-hidden w-full">
        <div className="w-full max-w-md relative z-10 text-center">
           <div className="inline-block p-4 bg-white rounded-3xl mb-6 shadow-2xl">
            <img 
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/695d0a9200ced41a30cb2042/2614e7d21_image.png" 
              alt="Tecnoloc"
              className="h-12 object-contain"
            />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight uppercase mb-8">Alterar Senha</h1>

          <Card className="border-none bg-white shadow-2xl rounded-3xl overflow-hidden">
            <CardContent className="p-8 space-y-6">
              <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <p className="text-xs text-indigo-900 leading-relaxed font-medium text-left">
                  Identificamos o uso da senha padrão. Por favor, defina uma nova senha para sua segurança.
                </p>
              </div>

              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div className="space-y-1 text-left">
                  <Label className="text-black text-xs uppercase font-black">Nova Senha</Label>
                  <Input 
                    type="password" 
                    required 
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="bg-slate-100 border-none text-black h-12" 
                    placeholder="Mínimo 6 caracteres" 
                  />
                </div>
                <div className="space-y-1 text-left">
                  <Label className="text-black text-xs uppercase font-black">Confirmar Senha</Label>
                  <Input 
                    type="password" 
                    required 
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="bg-slate-100 border-none text-black h-12" 
                    placeholder="Repita a nova senha" 
                  />
                </div>
                <Button type="submit" disabled={loading} className="w-full h-14 bg-[#4338ca] hover:bg-indigo-600 font-black uppercase text-lg shadow-xl text-white">
                  {loading ? <Loader2 className="animate-spin" /> : 'Confirmar'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0a0f1e] overflow-y-auto relative font-sans w-full">
      <div className="w-full max-w-md relative z-10 flex flex-col items-center">
        
        {/* Banner Logo */}
        <div className="w-full bg-white rounded-xl overflow-hidden shadow-2xl mb-8">
          <img 
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/695d0a9200ced41a30cb2042/2614e7d21_image.png" 
            alt="Tecnoloc Banner"
            className="w-full h-auto object-cover"
          />
        </div>

        <h1 className="text-4xl font-black text-white tracking-tight uppercase mb-10 text-center">Portal Técnico</h1>

        <Card className="w-full border-none bg-white shadow-2xl rounded-[1.5rem] overflow-hidden">
          <CardContent className="p-8 md:p-10 space-y-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label className="text-slate-800 text-xs uppercase font-black tracking-widest">E-mail</Label>
                <div className="relative group">
                  <Mail className="absolute left-3 top-4 w-5 h-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                  <Input 
                    type="email" 
                    required 
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="pl-11 bg-slate-100 border-2 border-transparent focus:border-indigo-500 text-black h-14 placeholder:text-slate-400 rounded-xl w-full" 
                    placeholder="usuario@tecnoloc.com" 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-800 text-xs uppercase font-black tracking-widest">Senha</Label>
                <div className="relative group">
                  <Lock className="absolute left-3 top-4 w-5 h-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                  <Input 
                    type="password" 
                    required 
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="pl-11 bg-slate-100 border-2 border-transparent focus:border-indigo-500 text-black h-14 placeholder:text-slate-400 rounded-xl w-full" 
                    placeholder="••••••••" 
                  />
                </div>
              </div>

              <Button type="submit" disabled={loading} className="w-full h-14 bg-[#3b49df] hover:bg-[#2a38c4] text-white font-black uppercase text-lg shadow-lg transition-all rounded-xl">
                {loading ? <Loader2 className="animate-spin" /> : (
                  <span className="flex items-center justify-center gap-2">
                    <LogIn className="w-6 h-6" /> Acessar Sistema
                  </span>
                )}
              </Button>
            </form>

            <div className="pt-4 text-center">
              <button 
                onClick={() => setIsLogin(!isLogin)} 
                className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2"
              >
                {isLogin ? 'Novo por aqui? Criar conta' : 'Já possui conta? Fazer login'}
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}