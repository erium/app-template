"use client";

import { useState } from "react";
import { api, queryKeys } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Trash2, UserPlus, Shield, Eye, Edit, XCircle, Mail } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useTranslation } from "react-i18next";

export default function AdminUsers() {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"viewer" | "editor" | "admin">("viewer");
  const { t } = useTranslation();

  const queryClient = useQueryClient();
  const { data: users, isLoading } = useQuery({
    queryKey: queryKeys.tenantUsers,
    queryFn: api.getUsers,
  });
  const { data: invites, refetch: refetchInvites } = useQuery({
    queryKey: queryKeys.pendingInvites,
    queryFn: api.getPendingInvites,
  });
  const { data: me } = useQuery({
    queryKey: queryKeys.me,
    queryFn: api.getMe,
  });

  const inviteMutation = useMutation({
    mutationFn: api.inviteUser,
    onSuccess: (data) => {
      toast.success(t("invite_sent_success"));
      // Show link for demo
      if (data.token) {
        // Copy to clipboard
        const link = `${window.location.origin}/join?token=${data.token}`;
        navigator.clipboard.writeText(link);
        toast.info(t("link_copied"));
      }
      setInviteOpen(false);
      setInviteEmail("");
      refetchInvites();
    },
    onError: (err) => toast.error(err.message),
  });

  const revokeMutation = useMutation({
    mutationFn: (data: { id: number }) => api.revokeInvitation(data.id),
    onSuccess: () => {
      toast.success(t("invite_revoked"));
      refetchInvites();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const resendMutation = useMutation({
    mutationFn: (data: { id: number }) => api.resendInvitation(data.id),
    onSuccess: () => {
      toast.success(t("invite_resent"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (data: { userId: number }) => api.deleteUser(data.userId),
    onSuccess: () => {
      toast.success(t("user_removed"));
      queryClient.invalidateQueries({ queryKey: queryKeys.tenantUsers });
    },
    onError: (err) => toast.error(err.message),
  });

  const updateRoleMutation = useMutation({
    mutationFn: (data: { userId: number; role: string }) => api.updateUserRole(data.userId, data.role),
    onSuccess: () => {
      toast.success(t("role_updated"));
      queryClient.invalidateQueries({ queryKey: queryKeys.tenantUsers });
    },
    onError: (err) => toast.error(err.message),
  });

  const handleInvite = () => {
    inviteMutation.mutate({ email: inviteEmail, role: inviteRole });
  };

  const getRoleIcon = (role: string) => {
    switch(role) {
        case 'admin': return <Shield className="h-4 w-4 text-red-500" />;
        case 'editor': return <Edit className="h-4 w-4 text-blue-500" />;
        default: return <Eye className="h-4 w-4 text-gray-500" />;
    }
  };

  if (isLoading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <DashboardLayout>
      <div className="p-8 max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">{t("user_mgmt_title")}</h1>
                <p className="text-muted-foreground">{t("user_mgmt_desc")}</p>
            </div>
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                <DialogTrigger asChild>
                    <Button><UserPlus className="mr-2 h-4 w-4" /> {t("invite_user")}</Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t("invite_dialog_title")}</DialogTitle>
                        <DialogDescription>
                            {t("invite_dialog_desc")}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="email">{t("email")}</Label>
                            <Input id="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder={t("email_company_placeholder")} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="role">{t("role")}</Label>
                            <Select value={inviteRole} onValueChange={(v: string) => setInviteRole(v as "viewer" | "editor" | "admin")}>
                                <SelectTrigger>
                                    <SelectValue placeholder={t("select_role")} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="viewer">{t("role_viewer_desc")}</SelectItem>
                                    <SelectItem value="editor">{t("role_editor_desc")}</SelectItem>
                                    <SelectItem value="admin">{t("role_admin_desc")}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleInvite} disabled={inviteMutation.isPending}>
                            {inviteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {t("send_invite")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>

        {/* Pending Invites Section */}
        {invites && invites.length > 0 && (
            <div className="space-y-4">
                <h2 className="text-xl font-semibold tracking-tight">{t("pending_invites")}</h2>
                <div className="border rounded-lg overflow-hidden bg-card">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>{t("email")}</TableHead>
                                <TableHead>{t("role")}</TableHead>
                                <TableHead>{t("created_at")}</TableHead>
                                <TableHead className="text-right">{t("actions")}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {invites.map((invite) => (
                                <TableRow key={invite.id}>
                                    <TableCell className="font-medium text-muted-foreground">{invite.email}</TableCell>
                                    <TableCell className="flex items-center gap-2">
                                        {getRoleIcon(invite.role)}
                                        <span className="capitalize">{t(`role_${invite.role}`)}</span>
                                    </TableCell>
                                    <TableCell>{new Date(invite.createdAt).toLocaleDateString()}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => resendMutation.mutate({ id: invite.id })}
                                                title={t("resend_email")}
                                            >
                                                <Mail className="h-4 w-4 mr-2" />
                                                {t("resend_email")}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-destructive hover:bg-destructive/10"
                                                onClick={() => revokeMutation.mutate({ id: invite.id })}
                                                title={t("revoke_invite")}
                                            >
                                                <XCircle className="h-4 w-4 mr-2" />
                                                {t("revoke_invite")}
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
        )}

        <div className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight">{t("active_users_title")}</h2>
            <div className="border rounded-lg overflow-hidden bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{t("name")}</TableHead>
                            <TableHead>{t("email")}</TableHead>
                            <TableHead>{t("role")}</TableHead>
                            <TableHead className="text-right">{t("actions")}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users?.map((user) => (
                            <TableRow key={user.id}>
                                <TableCell className="font-medium">{user.name || t("unknown_user")}</TableCell>
                                <TableCell>{user.email}</TableCell>
                                <TableCell className="flex items-center gap-2">
                                    {getRoleIcon(user.role)}
                                    <Select
                                        defaultValue={user.role}
                                        onValueChange={(v: string) => updateRoleMutation.mutate({ userId: user.id, role: v })}
                                        disabled={user.id === me?.id}
                                    >
                                        <SelectTrigger className="h-8 w-[110px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="viewer">{t("role_viewer")}</SelectItem>
                                            <SelectItem value="editor">{t("role_editor")}</SelectItem>
                                            <SelectItem value="admin">{t("role_admin")}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-destructive hover:bg-destructive/10"
                                        disabled={user.id === me?.id}
                                        onClick={() => deleteMutation.mutate({ userId: user.id })}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
