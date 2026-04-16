import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';

type Dept = { id: string; name: string };
type Unit = { id: string; name: string; departmentId: string };
type Position = { id: string; name: string };
type Group = { id: string; name: string };
type Course = { id: string; title: string };
type UserRow = { id: string; email: string; name: string | null };

export default function LmsAdminOrg() {
  const [orgName, setOrgName] = useState('');
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [deptId, setDeptId] = useState('');
  const [units, setUnits] = useState<Unit[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [newDept, setNewDept] = useState('');
  const [newUnit, setNewUnit] = useState('');
  const [newPos, setNewPos] = useState('');
  const [newGroup, setNewGroup] = useState('');

  const [memberGroupId, setMemberGroupId] = useState('');
  const [memberUserId, setMemberUserId] = useState('');

  const [asg, setAsg] = useState({
    courseId: '',
    assigneeType: 'user' as 'user' | 'group',
    groupId: '',
    userId: '',
    startsAt: new Date().toISOString().slice(0, 16),
    enforceSequence: true,
  });

  const [emp, setEmp] = useState({ userId: '', departmentId: '', unitId: '', positionId: '' });
  const [empUnits, setEmpUnits] = useState<Unit[]>([]);

  const refresh = async () => {
    setLoading(true);
    try {
      const [o, d, p, g, c, u] = await Promise.all([
        api<{ organization: { name: string } | null }>('/lms/organization'),
        api<{ departments: Dept[] }>('/lms/departments'),
        api<{ positions: Position[] }>('/lms/positions'),
        api<{ groups: Group[] }>('/lms/groups'),
        api<{ courses: Course[] }>('/lms/courses'),
        api<{ users: UserRow[] }>('/lms/users-for-assignment'),
      ]);
      setOrgName(o.organization?.name || '');
      setDepartments(d.departments);
      setPositions(p.positions);
      setGroups(g.groups);
      setCourses(c.courses);
      setUsers(u.users);
      if (d.departments.length && !deptId) setDeptId(d.departments[0].id);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (!deptId) {
      setUnits([]);
      return;
    }
    api<{ units: Unit[] }>(`/lms/units?departmentId=${encodeURIComponent(deptId)}`).then((r) => setUnits(r.units));
  }, [deptId]);

  useEffect(() => {
    if (!emp.departmentId) {
      setEmpUnits([]);
      return;
    }
    api<{ units: Unit[] }>(`/lms/units?departmentId=${encodeURIComponent(emp.departmentId)}`).then((r) =>
      setEmpUnits(r.units),
    );
  }, [emp.departmentId]);

  const saveOrg = async () => {
    await api('/lms/organization', { method: 'PATCH', body: { name: orgName } });
    toast.success('Сохранено');
    void refresh();
  };

  const addDept = async () => {
    if (!newDept.trim()) return;
    await api('/lms/departments', { method: 'POST', body: { name: newDept.trim(), sortOrder: 0 } });
    setNewDept('');
    toast.success('Подразделение создано');
    void refresh();
  };

  const addUnit = async () => {
    if (!deptId || !newUnit.trim()) return;
    await api('/lms/units', { method: 'POST', body: { departmentId: deptId, name: newUnit.trim(), sortOrder: 0 } });
    setNewUnit('');
    toast.success('Отдел добавлен');
    if (deptId) {
      const r = await api<{ units: Unit[] }>(`/lms/units?departmentId=${encodeURIComponent(deptId)}`);
      setUnits(r.units);
    }
  };

  const addPos = async () => {
    if (!newPos.trim()) return;
    await api('/lms/positions', { method: 'POST', body: { name: newPos.trim(), sortOrder: 0 } });
    setNewPos('');
    toast.success('Должность добавлена');
    void refresh();
  };

  const addGroup = async () => {
    if (!newGroup.trim()) return;
    await api('/lms/groups', { method: 'POST', body: { name: newGroup.trim() } });
    setNewGroup('');
    toast.success('Группа создана');
    void refresh();
  };

  const addMember = async () => {
    if (!memberGroupId || !memberUserId) return;
    await api(`/lms/groups/${memberGroupId}/members`, { method: 'POST', body: { userId: memberUserId } });
    toast.success('Участник добавлен');
  };

  const saveEmployee = async () => {
    if (!emp.userId) return;
    await api('/lms/employees', {
      method: 'POST',
      body: {
        userId: emp.userId,
        departmentId: emp.departmentId || null,
        unitId: emp.unitId || null,
        positionId: emp.positionId || null,
      },
    });
    toast.success('Сотрудник сохранён');
  };

  const createAssignment = async () => {
    if (!asg.courseId || !asg.startsAt) return;
    const body: Record<string, unknown> = {
      courseId: asg.courseId,
      assigneeType: asg.assigneeType,
      startsAt: new Date(asg.startsAt).toISOString(),
      enforceSequence: asg.enforceSequence,
    };
    if (asg.assigneeType === 'group') body.groupId = asg.groupId;
    else body.userId = asg.userId;
    await api('/lms/assignments', { method: 'POST', body });
    toast.success('Назначение создано');
  };

  if (loading && !orgName && departments.length === 0) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/lms" className="gap-1">
            <ChevronLeft className="w-4 h-4" /> LMS
          </Link>
        </Button>
        <h1 className="text-2xl font-serif font-bold">Оргструктура и назначения</h1>
      </div>

      <Card className="p-5 space-y-3">
        <h2 className="font-semibold">Организация</h2>
        <Label>Название</Label>
        <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} />
        <Button size="sm" onClick={() => void saveOrg()}>
          Сохранить
        </Button>
      </Card>

      <Card className="p-5 space-y-3">
        <h2 className="font-semibold">Подразделения</h2>
        <div className="flex gap-2 flex-wrap">
          <Input
            placeholder="Новое подразделение"
            value={newDept}
            onChange={(e) => setNewDept(e.target.value)}
            className="max-w-xs"
          />
          <Button size="sm" onClick={() => void addDept()}>
            Добавить
          </Button>
        </div>
        <select
          className="w-full max-w-md border rounded-md px-2 py-2 text-sm bg-background"
          value={deptId}
          onChange={(e) => setDeptId(e.target.value)}
        >
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <div className="flex gap-2 flex-wrap">
          <Input
            placeholder="Отдел внутри подразделения"
            value={newUnit}
            onChange={(e) => setNewUnit(e.target.value)}
            className="max-w-xs"
          />
          <Button size="sm" variant="secondary" onClick={() => void addUnit()}>
            Добавить отдел
          </Button>
        </div>
        <ul className="text-sm text-muted-foreground list-disc pl-5">
          {units.map((u) => (
            <li key={u.id}>{u.name}</li>
          ))}
        </ul>
      </Card>

      <Card className="p-5 space-y-3">
        <h2 className="font-semibold">Должности</h2>
        <div className="flex gap-2 flex-wrap">
          <Input value={newPos} onChange={(e) => setNewPos(e.target.value)} placeholder="Новая должность" className="max-w-xs" />
          <Button size="sm" onClick={() => void addPos()}>
            Добавить
          </Button>
        </div>
        <ul className="text-sm list-disc pl-5">
          {positions.map((p) => (
            <li key={p.id}>{p.name}</li>
          ))}
        </ul>
      </Card>

      <Card className="p-5 space-y-3">
        <h2 className="font-semibold">Сотрудник (привязка к оргструктуре)</h2>
        <select
          className="w-full max-w-md border rounded-md px-2 py-2 text-sm bg-background"
          value={emp.userId}
          onChange={(e) => setEmp({ ...emp, userId: e.target.value })}
        >
          <option value="">— пользователь —</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name || u.email}
            </option>
          ))}
        </select>
        <select
          className="w-full max-w-md border rounded-md px-2 py-2 text-sm bg-background"
          value={emp.departmentId}
          onChange={(e) => setEmp({ ...emp, departmentId: e.target.value, unitId: '' })}
        >
          <option value="">Подразделение</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <select
          className="w-full max-w-md border rounded-md px-2 py-2 text-sm bg-background"
          value={emp.unitId}
          onChange={(e) => setEmp({ ...emp, unitId: e.target.value })}
        >
          <option value="">Отдел</option>
          {empUnits.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <select
          className="w-full max-w-md border rounded-md px-2 py-2 text-sm bg-background"
          value={emp.positionId}
          onChange={(e) => setEmp({ ...emp, positionId: e.target.value })}
        >
          <option value="">Должность</option>
          {positions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <Button size="sm" onClick={() => void saveEmployee()}>
          Сохранить сотрудника
        </Button>
      </Card>

      <Card className="p-5 space-y-3">
        <h2 className="font-semibold">Учебные группы</h2>
        <div className="flex gap-2 flex-wrap">
          <Input value={newGroup} onChange={(e) => setNewGroup(e.target.value)} placeholder="Название группы" />
          <Button size="sm" onClick={() => void addGroup()}>
            Создать
          </Button>
        </div>
        <div className="grid md:grid-cols-2 gap-2">
          <select
            className="border rounded-md px-2 py-2 text-sm bg-background"
            value={memberGroupId}
            onChange={(e) => setMemberGroupId(e.target.value)}
          >
            <option value="">Группа</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <select
            className="border rounded-md px-2 py-2 text-sm bg-background"
            value={memberUserId}
            onChange={(e) => setMemberUserId(e.target.value)}
          >
            <option value="">Пользователь</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name || u.email}
              </option>
            ))}
          </select>
        </div>
        <Button size="sm" variant="secondary" onClick={() => void addMember()}>
          Добавить в группу
        </Button>
      </Card>

      <Card className="p-5 space-y-3">
        <h2 className="font-semibold">Назначение курса</h2>
        <select
          className="w-full border rounded-md px-2 py-2 text-sm bg-background"
          value={asg.courseId}
          onChange={(e) => setAsg({ ...asg, courseId: e.target.value })}
        >
          <option value="">Курс</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        <select
          className="w-full border rounded-md px-2 py-2 text-sm bg-background"
          value={asg.assigneeType}
          onChange={(e) => setAsg({ ...asg, assigneeType: e.target.value as 'user' | 'group' })}
        >
          <option value="user">На сотрудника</option>
          <option value="group">На группу</option>
        </select>
        {asg.assigneeType === 'group' ? (
          <select
            className="w-full border rounded-md px-2 py-2 text-sm bg-background"
            value={asg.groupId}
            onChange={(e) => setAsg({ ...asg, groupId: e.target.value })}
          >
            <option value="">Группа</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        ) : (
          <select
            className="w-full border rounded-md px-2 py-2 text-sm bg-background"
            value={asg.userId}
            onChange={(e) => setAsg({ ...asg, userId: e.target.value })}
          >
            <option value="">Пользователь</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name || u.email}
              </option>
            ))}
          </select>
        )}
        <Label>Старт</Label>
        <Input
          type="datetime-local"
          value={asg.startsAt}
          onChange={(e) => setAsg({ ...asg, startsAt: e.target.value })}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={asg.enforceSequence}
            onChange={(e) => setAsg({ ...asg, enforceSequence: e.target.checked })}
          />
          Последовательное прохождение
        </label>
        <Button onClick={() => void createAssignment()}>Создать назначение</Button>
      </Card>
    </div>
  );
}
