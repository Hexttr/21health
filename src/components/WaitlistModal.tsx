import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { api } from '@/api/client';
import { Loader2, CheckCircle, Sparkles, Brain, Users, Calendar, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

interface WaitlistModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WaitlistModal({ open, onOpenChange }: WaitlistModalProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [contact, setContact] = useState('');
  const [contactType, setContactType] = useState<'telegram' | 'phone'>('telegram');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!firstName.trim() || !lastName.trim() || !contact.trim()) {
      toast.error('Заполните все поля');
      return;
    }

    setIsLoading(true);
    try {
      await api('/waitlist', {
        method: 'POST',
        body: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          contact: contact.trim(),
          contactType,
        },
      });
      setIsSuccess(true);
      toast.success('Заявка отправлена!');
    } catch {
      toast.error('Ошибка при отправке. Попробуйте позже.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset form after closing
    setTimeout(() => {
      setFirstName('');
      setLastName('');
      setContact('');
      setContactType('telegram');
      setIsSuccess(false);
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        {isSuccess ? (
          <div className="p-8 text-center">
            <div className="w-20 h-20 rounded-full gradient-hero mx-auto mb-6 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-white" />
            </div>
            <h2 className="font-serif text-2xl font-semibold mb-3">Вы в списке!</h2>
            <p className="text-muted-foreground mb-6">
              Мы свяжемся с вами, когда откроется запись на следующий поток курса.
            </p>
            <Button onClick={handleClose} className="gradient-hero">
              Закрыть
            </Button>
          </div>
        ) : (
          <>
            {/* Header with gradient */}
            <div className="gradient-hero p-8 text-white">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <span className="font-serif text-xl font-semibold">NeuroAcademy</span>
              </div>
              <DialogHeader>
                <DialogTitle className="font-serif text-3xl font-semibold text-white leading-tight">
                  Освойте ИИ за 21 день
                </DialogTitle>
              </DialogHeader>
              <p className="mt-3 text-white/90 text-lg">
                Практический курс для помогающих специалистов
              </p>
            </div>

            {/* Content */}
            <div className="p-8">
              {/* Features grid */}
              <div className="grid grid-cols-2 gap-4 mb-8">
                {[
                  { icon: Brain, title: '21 урок', desc: 'Пошаговая программа' },
                  { icon: MessageCircle, title: 'AI-тьютор', desc: 'Персональная поддержка' },
                  { icon: Users, title: 'Сообщество', desc: 'Единомышленники' },
                  { icon: Calendar, title: 'Гибкий формат', desc: 'Учитесь в своём темпе' },
                ].map((feature, index) => (
                  <div key={index} className="p-4 rounded-xl bg-secondary/50 border border-border/50">
                    <feature.icon className="w-6 h-6 text-primary mb-2" />
                    <h4 className="font-medium text-sm">{feature.title}</h4>
                    <p className="text-xs text-muted-foreground">{feature.desc}</p>
                  </div>
                ))}
              </div>

              <div className="mb-6">
                <h3 className="font-serif text-xl font-semibold mb-2">Что вы получите:</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">✓</span>
                    Навыки работы с ChatGPT, Gemini и другими ИИ-инструментами
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">✓</span>
                    Готовые промпты для вашей практики
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">✓</span>
                    Практические задания с AI-проверкой
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">✓</span>
                    Сертификат о прохождении курса
                  </li>
                </ul>
              </div>

              {/* Form */}
              <div className="border-t border-border/50 pt-6">
                <h3 className="font-serif text-lg font-semibold mb-4">
                  Записаться в следующий поток
                </h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">Имя *</Label>
                      <Input
                        id="firstName"
                        placeholder="Ваше имя"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="h-11 rounded-xl"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Фамилия *</Label>
                      <Input
                        id="lastName"
                        placeholder="Ваша фамилия"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="h-11 rounded-xl"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label>Как с вами связаться? *</Label>
                    <RadioGroup 
                      value={contactType} 
                      onValueChange={(value) => setContactType(value as 'telegram' | 'phone')}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="telegram" id="telegram" />
                        <Label htmlFor="telegram" className="cursor-pointer">Telegram</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="phone" id="phone" />
                        <Label htmlFor="phone" className="cursor-pointer">Телефон</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contact">
                      {contactType === 'telegram' ? 'Ваш Telegram (@username)' : 'Номер телефона'} *
                    </Label>
                    <Input
                      id="contact"
                      placeholder={contactType === 'telegram' ? '@username' : '+7 (999) 123-45-67'}
                      value={contact}
                      onChange={(e) => setContact(e.target.value)}
                      className="h-11 rounded-xl"
                      required
                    />
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full h-12 rounded-xl gradient-hero hover:opacity-90 shadow-glow transition-all font-semibold"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Отправка...
                      </>
                    ) : (
                      'Записаться в лист ожидания'
                    )}
                  </Button>

                  <p className="text-xs text-center text-muted-foreground">
                    Мы свяжемся с вами, когда откроется запись на следующий поток
                  </p>
                </form>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
