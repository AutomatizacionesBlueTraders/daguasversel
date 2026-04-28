import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useAuth, AppRole } from '@/hooks/useAuth';
import { api, getApiError } from '@/lib/api';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import {
  UserPlus, RefreshCw, Shield, User as UserIcon, Check, X,
  AlertCircle, Trash2, Phone, Pencil, MailCheck
} from 'lucide-react';
import { N8N_WEBHOOK_URL } from '@/lib/constants';

interface UserRow {
  id: number;
  email: string;
  nombre: string;
  telefono: string | null;
  rol: AppRole;
  activo: boolean;
  debe_cambiar_password: boolean;
  email_verificado: boolean;
  ultimo_login: string | null;
  created_at: string;
}

function getRoleTypeForN8n(role: AppRole): string {
  if (role === 'admin') return 'administrador';
  if (role === 'tecnico') return 'tecnico';
  return 'administrativo';
}

async function notifyN8n(payload: Record<string, unknown>) {
  try {
    await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    // n8n es best-effort
  }
}

export default function Usuarios() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    nombre: '',
    telefono: '',
    rol: 'usuario' as AppRole,
  });
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState({ nombre: '', telefono: '', rol: 'usuario' as AppRole });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get<UserRow[]>('/auth/users');
      setUsers(r.data);
    } catch (err) {
      const payload = getApiError(err);
      toast({
        title: 'Error',
        description: payload?.error || 'No se pudieron cargar los usuarios',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const handleOpenDialog = () => {
    setNewUser({ email: '', nombre: '', telefono: '', rol: 'usuario' });
    setDialogOpen(true);
  };

  const handleCreateUser = async () => {
    if (!newUser.email || !newUser.nombre.trim()) {
      toast({ title: 'Error', description: 'Email y nombre son requeridos', variant: 'destructive' });
      return;
    }

    setCreating(true);
    try {
      const r = await api.post<UserRow>('/auth/users', {
        email: newUser.email.trim().toLowerCase(),
        nombre: newUser.nombre.trim(),
        telefono: newUser.telefono.trim() || null,
        rol: newUser.rol,
      });

      void notifyN8n({
        accion: 'registrar_usuario',
        nombre: r.data.nombre,
        telefono: r.data.telefono,
        tipo: getRoleTypeForN8n(r.data.rol),
      });

      toast({
        title: 'Usuario creado',
        description: `Se envió un correo de invitación a ${r.data.email}`,
      });
      setDialogOpen(false);
      void fetchUsers();
    } catch (err) {
      const payload = getApiError(err);
      let msg = payload?.error || 'No se pudo crear el usuario';
      if (payload?.code === 'EMAIL_DUPLICATE') {
        msg = 'Ya existe un usuario con este correo';
      } else if (payload?.code === 'NAME_DUPLICATE') {
        msg = 'Ya existe un usuario con este nombre';
      }
      toast({ title: 'Error al crear usuario', description: msg, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const handleOpenEditDialog = (u: UserRow) => {
    setEditingUser(u);
    setEditForm({ nombre: u.nombre, telefono: u.telefono || '', rol: u.rol });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    setSaving(true);
    try {
      const r = await api.patch<UserRow>(`/auth/users/${editingUser.id}`, {
        nombre: editForm.nombre.trim(),
        telefono: editForm.telefono.trim() || null,
        rol: editForm.rol,
      });

      void notifyN8n({
        accion: 'editar_usuario',
        nombre: r.data.nombre,
        telefono: r.data.telefono,
        tipo: getRoleTypeForN8n(r.data.rol),
      });

      toast({ title: 'Usuario actualizado' });
      setEditDialogOpen(false);
      setEditingUser(null);
      void fetchUsers();
    } catch (err) {
      const payload = getApiError(err);
      toast({
        title: 'Error',
        description: payload?.error || 'No se pudo actualizar el usuario',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (u: UserRow) => {
    try {
      await api.patch(`/auth/users/${u.id}`, { activo: !u.activo });
      toast({ title: u.activo ? 'Usuario desactivado' : 'Usuario activado' });
      void fetchUsers();
    } catch (err) {
      const payload = getApiError(err);
      toast({
        title: 'Error',
        description: payload?.error || 'No se pudo cambiar el estado',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteUser = async (u: UserRow) => {
    try {
      await api.delete(`/auth/users/${u.id}`);
      void notifyN8n({ accion: 'eliminar_usuario', nombre: u.nombre });
      toast({ title: 'Usuario eliminado' });
      void fetchUsers();
    } catch (err) {
      const payload = getApiError(err);
      toast({
        title: 'Error',
        description: payload?.error || 'No se pudo eliminar el usuario',
        variant: 'destructive',
      });
    }
  };

  const handleResendInvite = async (u: UserRow) => {
    try {
      await api.post(`/auth/users/${u.id}/resend-invite`);
      toast({ title: 'Invitación reenviada', description: `Se envió un nuevo correo a ${u.email}` });
    } catch (err) {
      const payload = getApiError(err);
      toast({
        title: 'Error',
        description: payload?.error || 'No se pudo reenviar la invitación',
        variant: 'destructive',
      });
    }
  };

  const getRoleIcon = (rol: AppRole) =>
    rol === 'admin' ? <Shield className="h-4 w-4 text-primary" />
    : rol === 'tecnico' ? <UserIcon className="h-4 w-4 text-amber-500" />
    : <UserIcon className="h-4 w-4" />;

  const getRoleLabel = (rol: AppRole) =>
    rol === 'admin' ? 'Administrador' : rol === 'tecnico' ? 'Técnico' : 'Administrativo';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Usuarios</h1>
          <p className="text-muted-foreground">Gestión de usuarios del sistema</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchUsers} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleOpenDialog}>
                <UserPlus className="h-4 w-4 mr-2" />
                Crear usuario
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Crear nuevo usuario</DialogTitle>
                <DialogDescription>
                  El usuario recibirá un correo con un código y un enlace para definir su contraseña.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="new-nombre">Nombre *</Label>
                  <Input
                    id="new-nombre"
                    placeholder="Juan Pérez"
                    value={newUser.nombre}
                    onChange={(e) => setNewUser({ ...newUser, nombre: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-email">Email *</Label>
                  <Input
                    id="new-email"
                    type="email"
                    placeholder="correo@ejemplo.com"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-telefono">Teléfono</Label>
                  <Input
                    id="new-telefono"
                    type="tel"
                    placeholder="3001234567"
                    value={newUser.telefono}
                    onChange={(e) => setNewUser({ ...newUser, telefono: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-rol">Rol</Label>
                  <Select
                    value={newUser.rol}
                    onValueChange={(v) => setNewUser({ ...newUser, rol: v as AppRole })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="usuario">Administrativo</SelectItem>
                      <SelectItem value="tecnico">Técnico</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleCreateUser} disabled={creating}>
                  {creating ? 'Creando...' : 'Crear y enviar invitación'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Contraseña</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 7 }).map((__, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-24" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No hay usuarios registrados
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.nombre}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span>{u.telefono || '-'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getRoleIcon(u.rol)}
                          <span className="text-sm font-medium">{getRoleLabel(u.rol)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={u.activo
                            ? 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30'
                            : 'bg-destructive/15 text-destructive border-destructive/30'}
                        >
                          {u.activo ? <><Check className="h-3 w-3 mr-1" />Activo</> : <><X className="h-3 w-3 mr-1" />Inactivo</>}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {u.debe_cambiar_password || !u.email_verificado ? (
                          <Badge variant="outline" className="bg-amber-500/15 text-amber-700 border-amber-500/30">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Pendiente
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-muted text-muted-foreground">
                            <Check className="h-3 w-3 mr-1" />
                            Activa
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleOpenEditDialog(u)}>
                            <Pencil className="h-4 w-4 mr-1" />
                            Editar
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleResendInvite(u)}>
                            <MailCheck className="h-4 w-4 mr-1" />
                            Reenviar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleActive(u)}
                            disabled={u.id === currentUser?.id}
                          >
                            {u.activo ? 'Desactivar' : 'Activar'}
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="sm" disabled={u.id === currentUser?.id}>
                                <Trash2 className="h-4 w-4 mr-1" />
                                Eliminar
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acción no se puede deshacer. Se eliminará permanentemente
                                  <span className="font-semibold"> {u.email}</span>.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteUser(u)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Eliminar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar usuario</DialogTitle>
            <DialogDescription>
              {editingUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-nombre">Nombre</Label>
              <Input
                id="edit-nombre"
                value={editForm.nombre}
                onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-telefono">Teléfono</Label>
              <Input
                id="edit-telefono"
                type="tel"
                placeholder="3001234567"
                value={editForm.telefono}
                onChange={(e) => setEditForm({ ...editForm, telefono: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-rol">Rol</Label>
              <Select
                value={editForm.rol}
                onValueChange={(v) => setEditForm({ ...editForm, rol: v as AppRole })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="usuario">Administrativo</SelectItem>
                  <SelectItem value="tecnico">Técnico</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editingUser?.id === currentUser?.id ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Estás editando tu propia cuenta. No puedes desactivarte ni eliminarte.
                </AlertDescription>
              </Alert>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
