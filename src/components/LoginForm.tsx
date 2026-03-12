import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, AlertCircle, Brain, Zap, Target, CalendarPlus } from 'lucide-react';
import { TestimonialsSection } from './TestimonialsSection';
import { WaitlistModal } from './WaitlistModal';

export function LoginForm() {
  const { signIn, signUp, validateInvitationCode } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [invitationCode, setInvitationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [codeValidating, setCodeValidating] = useState(false);
  const [codeValid, setCodeValid] = useState<boolean | null>(null);
  const [waitlistOpen, setWaitlistOpen] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const { error } = await signIn(email, password);
    
    if (error) {
      setError(error);
    }
    setIsLoading(false);
  };

  const handleCodeBlur = async () => {
    if (!invitationCode.trim()) {
      setCodeValid(null);
      return;
    }
    
    setCodeValidating(true);
    const result = await validateInvitationCode(invitationCode);
    setCodeValid(result.valid);
    if (!result.valid) {
      setError(result.error || 'Недействительный код');
    } else {
      setError('');
    }
    setCodeValidating(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    setIsLoading(true);

    const { error } = await signUp(email, password, name, invitationCode);
    
    if (error) {
      setError(error);
    } else {
      setSuccess('Регистрация успешна! Вы можете войти.');
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen mesh-bg">
      <div className="lg:flex lg:min-h-screen">
        {/* Left side - Decorative */}
        <div className="hidden lg:flex lg:flex-1 relative overflow-hidden">
          <div className="absolute inset-0 gradient-hero opacity-90" />
          
          {/* Decorative elements */}
          <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-1/3 right-1/4 w-48 h-48 rounded-full bg-white/10 blur-2xl" />
          
          <div className="relative z-10 flex flex-1 flex-col justify-center px-12 py-12 xl:px-20">
            <div className="max-w-md">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <span className="text-white font-extrabold text-lg tracking-tight">21</span>
                </div>
                <span className="font-extrabold text-2xl text-white tracking-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  21DAY
                </span>
              </div>

              <h1 className="font-extrabold text-4xl xl:text-5xl text-white leading-tight mb-6 tracking-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>
                Освойте{' '}
                <span className="underline decoration-white/30 underline-offset-4">
                  искусственный интеллект
                </span>
                <br />
                за 21 день
              </h1>
              
              <p className="text-white/80 text-lg leading-relaxed mb-10">
                Практический курс для помогающих специалистов. От основ до продвинутых техник.
              </p>

              {/* Features */}
              <div className="space-y-4">
                {[
                  { icon: Brain, text: '21 практический урок' },
                  { icon: Zap, text: 'AI-тесты для закрепления' },
                  { icon: Target, text: 'Персональный прогресс' },
                ].map((feature, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                      <feature.icon className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-white font-medium">{feature.text}</span>
                  </div>
                ))}
              </div>

              {/* Waitlist button - highly visible with animation */}
              <Button 
                onClick={() => setWaitlistOpen(true)}
                className="mt-8 bg-white text-primary font-semibold hover:bg-white/90 hover:scale-105 shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-white"
                size="lg"
              >
                <CalendarPlus className="w-5 h-5 mr-2" />
                Записаться в следующий поток
              </Button>
            </div>
          </div>
        </div>

        <WaitlistModal open={waitlistOpen} onOpenChange={setWaitlistOpen} />

        {/* Right side - Form */}
        <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-md animate-fade-in-up">
            {/* Mobile logo */}
            <div className="lg:hidden text-center mb-8">
              <div className="inline-flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-2xl gradient-hero flex items-center justify-center shadow-glow">
                  <span className="text-white font-extrabold text-base tracking-tight">21</span>
                </div>
                <span className="font-extrabold text-3xl text-foreground tracking-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  21<span className="text-primary">DAY</span>
                </span>
              </div>
              <p className="text-muted-foreground mt-1 text-sm">
                21-дневный курс по ИИ
              </p>
              {/* Mobile waitlist button */}
              <Button 
                onClick={() => setWaitlistOpen(true)}
                className="mt-4 bg-primary text-primary-foreground font-semibold hover:bg-primary/90 hover:scale-105 shadow-lg hover:shadow-xl transition-all duration-300"
                size="lg"
              >
                <CalendarPlus className="w-5 h-5 mr-2" />
                Записаться в следующий поток
              </Button>
            </div>

            {/* Form card */}
            <div className="bg-card rounded-3xl border border-border/50 shadow-large overflow-hidden">
              <Tabs defaultValue="login" className="w-full">
                <div className="px-6 sm:px-8 pt-6 sm:pt-8">
                  <TabsList className="grid w-full grid-cols-2 h-12 p-1 bg-secondary/50 rounded-xl">
                    <TabsTrigger 
                      value="login" 
                      className="rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-soft font-medium"
                    >
                      Вход
                    </TabsTrigger>
                    <TabsTrigger 
                      value="register"
                      className="rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-soft font-medium"
                    >
                      Регистрация
                    </TabsTrigger>
                  </TabsList>
                </div>
                
                <div className="p-6 sm:p-8 pt-6">
                  <TabsContent value="login" className="mt-0">
                    <form onSubmit={handleSignIn} className="space-y-5">
                      <div className="space-y-2">
                        <Label htmlFor="email-login" className="text-sm font-medium">
                          Email
                        </Label>
                        <Input
                          id="email-login"
                          type="email"
                          placeholder="email@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          className="h-12 rounded-xl border-border/50 focus:border-primary bg-secondary/30"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="password-login" className="text-sm font-medium">
                          Пароль
                        </Label>
                        <Input
                          id="password-login"
                          type="password"
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          className="h-12 rounded-xl border-border/50 focus:border-primary bg-secondary/30"
                        />
                      </div>

                      {error && (
                        <div className="flex items-start gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20">
                          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-destructive">{error}</p>
                        </div>
                      )}

                      <Button 
                        type="submit" 
                        className="w-full h-12 rounded-xl gradient-hero hover:opacity-90 shadow-glow transition-all font-semibold text-base"
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            Вход...
                          </>
                        ) : (
                          'Войти'
                        )}
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="register" className="mt-0">
                    <form onSubmit={handleSignUp} className="space-y-5">
                      <div className="space-y-2">
                        <Label htmlFor="invitation-code" className="text-sm font-medium">
                          Пригласительный код
                        </Label>
                        <div className="relative">
                          <Input
                            id="invitation-code"
                            type="text"
                            placeholder="Например: X1D5378"
                            value={invitationCode}
                            onChange={(e) => {
                              setInvitationCode(e.target.value.toUpperCase());
                              setCodeValid(null);
                            }}
                            onBlur={handleCodeBlur}
                            className={`h-12 rounded-xl border-border/50 focus:border-primary bg-secondary/30 uppercase ${
                              codeValid === true ? 'border-green-500 bg-green-50/10' : 
                              codeValid === false ? 'border-destructive bg-destructive/5' : ''
                            }`}
                          />
                          {codeValidating && (
                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                          )}
                          {codeValid === true && !codeValidating && (
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500">✓</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground leading-5">
                          Код необязателен. Без кода вы войдете как <span className="font-semibold text-foreground">Пользователь ИИ</span>, с кодом получите доступ к полному курсу как <span className="font-semibold text-foreground">student</span>.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="name-register" className="text-sm font-medium">
                          Ф.И.О.
                        </Label>
                        <Input
                          id="name-register"
                          type="text"
                          placeholder="Ваше Ф.И.О."
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          required
                          className="h-12 rounded-xl border-border/50 focus:border-primary bg-secondary/30"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email-register" className="text-sm font-medium">
                          Email
                        </Label>
                        <Input
                          id="email-register"
                          type="email"
                          placeholder="email@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          className="h-12 rounded-xl border-border/50 focus:border-primary bg-secondary/30"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="password-register" className="text-sm font-medium">
                          Пароль
                        </Label>
                        <Input
                          id="password-register"
                          type="password"
                          placeholder="Минимум 6 символов"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          minLength={6}
                          className="h-12 rounded-xl border-border/50 focus:border-primary bg-secondary/30"
                        />
                      </div>

                      {error && (
                        <div className="flex items-start gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20">
                          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-destructive">{error}</p>
                        </div>
                      )}

                      {success && (
                        <div className="flex items-center gap-3 p-4 rounded-xl bg-success/10 border border-success/20">
                          <p className="text-sm text-success font-medium">{success}</p>
                        </div>
                      )}

                      <Button 
                        type="submit" 
                        className="w-full h-12 rounded-xl gradient-hero hover:opacity-90 shadow-glow transition-all font-semibold text-base"
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            Регистрация...
                          </>
                        ) : (
                          'Создать аккаунт'
                        )}
                      </Button>
                    </form>
                  </TabsContent>
                </div>
              </Tabs>
            </div>

            {/* Footer text */}
            <p className="text-center text-sm text-muted-foreground mt-6">
              Создавая аккаунт, вы соглашаетесь с условиями использования
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl px-4 pb-8 pt-6 sm:px-6 lg:px-10 lg:pb-10">
        <TestimonialsSection variant="public" />
      </div>
    </div>
  );
}