import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, Users, Phone, MessageCircle, RefreshCw, Copy } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface WaitlistEntry {
  id: string;
  first_name: string;
  last_name: string;
  contact: string;
  contact_type: string;
  created_at: string;
}

export default function AdminWaitlist() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) {
      navigate('/');
      return;
    }
    loadWaitlist();
  }, [isAdmin, navigate]);

  const loadWaitlist = async () => {
    setLoading(true);
    try {
      const data = await api<Array<{ id: string; firstName: string; lastName: string; contact: string; contactType: string; createdAt: string }>>('/admin/waitlist');
      setEntries(data.map(e => ({ id: e.id, first_name: e.firstName, last_name: e.lastName, contact: e.contact, contact_type: e.contactType, created_at: e.createdAt })));
    } catch (error) {
      console.error('Error loading waitlist:', error);
      toast.error('Ошибка загрузки списка ожидания');
    } finally {
      setLoading(false);
    }
  };

  const copyContact = (contact: string) => {
    navigator.clipboard.writeText(contact);
    toast.success('Контакт скопирован');
  };

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), 'd MMM yyyy, HH:mm', { locale: ru });
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="font-serif text-2xl font-semibold text-foreground">
            Список ожидания
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Заявки на следующий поток курса
          </p>
        </div>
        <Button variant="outline" onClick={loadWaitlist} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Обновить
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Заявки ({entries.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Загрузка...
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Пока нет заявок
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Имя</TableHead>
                  <TableHead>Контакт</TableHead>
                  <TableHead>Дата заявки</TableHead>
                  <TableHead className="w-[100px]">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">
                      {entry.first_name} {entry.last_name}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {entry.contact_type === 'telegram' ? (
                          <MessageCircle className="h-4 w-4 text-blue-500" />
                        ) : (
                          <Phone className="h-4 w-4 text-green-500" />
                        )}
                        <span>{entry.contact}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(entry.created_at)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyContact(entry.contact)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
