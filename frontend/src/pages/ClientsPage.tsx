import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Building2, FolderOpen, Plus, Mail, Phone, ExternalLink, ShieldCheck, Loader2, X, Send, PencilLine, Trash2, Search } from "lucide-react";
import { PageHeader } from "../components/common/PageHeader";
import { EmptyState } from "../components/common/EmptyState";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/Dialog";
import { api } from "../lib/api";
import { toast } from "sonner";
import { Client, ClientContact } from "../data/types";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";

type NewContactRow = { name: string; email: string; phone: string; role: string };
const emptyContactRow = (): NewContactRow => ({ name: "", email: "", phone: "", role: "" });

export default function ClientsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [addingClient, setAddingClient] = useState(false);
  const [addingContact, setAddingContact] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);
  const [clientSearch, setClientSearch] = useState("");

  // Form states
  const [clientForm, setClientForm] = useState({ name: "", industry: "", website: "" });
  const [newClientContacts, setNewClientContacts] = useState<NewContactRow[]>([]);
  const [contactForm, setContactForm] = useState({ name: "", email: "", phone: "", role: "" });

  const loadClients = async (preferredClientId?: string) => {
    setLoading(true);
    try {
      const data = await api.get<Client[]>("/clients");
      const nextClients = data || [];
      setClients(nextClients);
      const targetId = preferredClientId || selectedClient?.id;
      if (targetId) {
        const updated = nextClients.find((c) => c.id === targetId);
        if (updated) setSelectedClient(updated);
      } else if (!selectedClient && nextClients[0]) {
        setSelectedClient(nextClients[0]);
      }
    } catch (e) {
      toast.error(t("clients.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
  }, []);

  const filteredClients = useMemo(() => {
    const query = clientSearch.trim().toLowerCase();
    if (!query) return clients;
    return clients.filter((client) => [client.name, client.industry, client.company].filter(Boolean).some((value) => String(value).toLowerCase().includes(query)));
  }, [clients, clientSearch]);
  const activeClients = clients.filter((client) => client.status === "active").length;
  const contactCount = clients.reduce((sum, client) => sum + (client.contacts?.length || 0), 0);

  const openCreateClientDialog = () => {
    setEditingClient(null);
    setClientForm({ name: "", industry: "", website: "" });
    setNewClientContacts([]);
    setAddingClient(true);
  };

  const openEditClientDialog = () => {
    if (!selectedClient) return;
    setEditingClient(selectedClient);
    setClientForm({
      name: selectedClient.name || "",
      industry: selectedClient.industry || "",
      website: selectedClient.website || "",
    });
    setNewClientContacts([]);
    setAddingClient(true);
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientForm.name) return;
    try {
      const savedClient = editingClient
        ? await api.put<Client>(`/clients/${editingClient.id}`, clientForm)
        : await api.post<Client>("/clients", clientForm);
      if (savedClient) {
        // ponytail: no bulk-create endpoint on the backend, so contacts are
        // created one-by-one against the existing per-contact route right
        // after the client. A failed contact doesn't roll back the client.
        const rows = editingClient ? [] : newClientContacts.filter((c) => c.name.trim() && c.email.trim());
        if (rows.length) {
          const results = await Promise.allSettled(
            rows.map((c) => api.post<ClientContact>(`/clients/${savedClient.id}/contacts`, c))
          );
          const failed = results.filter((r) => r.status === "rejected").length;
          if (failed) toast.error(t("clients.contactFailedCount", { count: failed }));
        }
        toast.success(editingClient ? t("clients.updatedSuccess") : t("clients.addedSuccess"));
        setAddingClient(false);
        setEditingClient(null);
        setClientForm({ name: "", industry: "", website: "" });
        setNewClientContacts([]);
        await loadClients(savedClient.id);
      }
    } catch {
      toast.error(editingClient ? t("clients.updateFailed") : t("clients.addFailed"));
    }
  };

  const addNewClientContactRow = () => setNewClientContacts((rows) => [...rows, emptyContactRow()]);
  const updateNewClientContactRow = (idx: number, field: keyof NewContactRow, value: string) =>
    setNewClientContacts((rows) => rows.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  const removeNewClientContactRow = (idx: number) =>
    setNewClientContacts((rows) => rows.filter((_, i) => i !== idx));

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient || !contactForm.name || !contactForm.email) return;
    try {
      const newContact = await api.post<ClientContact>(`/clients/${selectedClient.id}/contacts`, contactForm);
      if (newContact) {
        toast.success(t("clients.contactAddedSuccess"));
        setAddingContact(false);
        setContactForm({ name: "", email: "", phone: "", role: "" });
        loadClients();
      }
    } catch {
      toast.error(t("clients.contactAddFailed"));
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!selectedClient) return;
    try {
      await api.del(`/clients/${selectedClient.id}/contacts/${contactId}`);
      toast.success(t("clients.contactRemoved"));
      loadClients();
    } catch {
      toast.error(t("clients.contactRemoveFailed"));
    }
  };

  const handleDeleteClient = async () => {
    if (!deletingClient) return;
    try {
      await api.del(`/clients/${deletingClient.id}`);
      toast.success(t("clients.removed"));
      if (selectedClient?.id === deletingClient.id) {
        setSelectedClient(null);
      }
      setDeletingClient(null);
      loadClients();
    } catch (error: any) {
      toast.error(error?.message || t("clients.removeFailed"));
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-background px-4 py-5 md:px-6 md:py-8">
      <div className="mx-auto max-w-screen-2xl">
        <PageHeader
          title={t("clients.title")}
          action={
            <Button onClick={openCreateClientDialog} className="flex items-center gap-1">
              <Plus className="h-4 w-4" /> {t("clients.addClient")}
            </Button>
          }
        />

        {!loading && clients.length > 0 && (
          <section className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Client overview">
            <div className="rounded-xl border border-border bg-card p-4"><p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Accounts</p><p className="mt-1 text-2xl font-semibold text-foreground">{clients.length}</p></div>
            <div className="rounded-xl border border-border bg-card p-4"><p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Active</p><p className="mt-1 text-2xl font-semibold text-emerald-700 dark:text-emerald-300">{activeClients}</p></div>
            <div className="rounded-xl border border-border bg-card p-4"><p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Contacts</p><p className="mt-1 text-2xl font-semibold text-foreground">{contactCount}</p></div>
            <div className="rounded-xl border border-border bg-card p-4"><p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Linked projects</p><p className="mt-1 text-2xl font-semibold text-foreground">{clients.reduce((sum, client) => sum + (client.projectsCount || 0), 0)}</p></div>
          </section>
        )}

        {loading && clients.length === 0 ? (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-1 space-y-3">
              <div className="rounded-xl border bg-card p-4">
                <div className="skeleton h-4 w-24 mb-3" />
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-lg border border-border p-3">
                      <div className="skeleton h-9 w-9 rounded-lg" />
                      <div className="flex-1 space-y-1.5">
                        <div className="skeleton h-4 w-32" />
                        <div className="skeleton h-3 w-24" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="lg:col-span-2">
              <div className="rounded-xl border bg-card p-6 space-y-4">
                <div className="skeleton h-5 w-40" />
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 border border-border rounded-lg">
                    <div className="skeleton h-8 w-8 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <div className="skeleton h-4 w-36" />
                      <div className="skeleton h-3 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Client List */}
            <div className="lg:col-span-1 space-y-3">
              <div className="rounded-xl border bg-card p-4">
                <div className="mb-3 flex items-center justify-between gap-2"><h3 className="text-sm font-semibold text-foreground">{t("clients.allClients")}</h3><span className="text-xs text-muted-foreground">{clients.length}</span></div>
                <div className="relative mb-3"><Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={clientSearch} onChange={(event) => setClientSearch(event.target.value)} placeholder="Search clients" className="h-9 ps-9" /></div>
                <div className="space-y-2">
                  {filteredClients.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedClient(c)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors flex items-center gap-3 ${
                        selectedClient?.id === c.id
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                        <div className="flex items-center gap-2"><p className="text-xs text-muted-foreground truncate">{c.industry || t("clients.generalIndustry")}</p><span className={`h-1.5 w-1.5 rounded-full ${c.status === "active" ? "bg-emerald-500" : "bg-muted-foreground/40"}`} aria-label={c.status} /></div>
                      </div>
                    </button>
                  ))}
                  {clients.length === 0 && <EmptyState icon={<Building2 className="h-8 w-8" />} title={t("clients.noClients")} />}
                  {clients.length > 0 && filteredClients.length === 0 && <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">No matching clients</p>}
                </div>
              </div>
            </div>

            {/* Client Detail View */}
            <div className="lg:col-span-2 space-y-4">
              {selectedClient ? (
                <div className="rounded-xl border bg-card p-6 space-y-6">
                  <div className="flex justify-between items-start border-b border-border pb-4">
                    <div>
                      <div className="flex items-center gap-2"><h2 className="text-xl font-bold text-foreground">{selectedClient.name}</h2><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${selectedClient.status === "active" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}>{selectedClient.status}</span></div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                          {selectedClient.industry || t("clients.noIndustry")}
                        </span>
                        {selectedClient.website && (
                          <a
                            href={selectedClient.website}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-primary flex items-center gap-0.5 hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" /> {selectedClient.website}
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={openEditClientDialog}>
                        <PencilLine className="h-3.5 w-3.5" /> {t("clients.edit")}
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 gap-1.5 text-destructive" onClick={() => setDeletingClient(selectedClient)}>
                        <Trash2 className="h-3.5 w-3.5" /> {t("clients.delete")}
                      </Button>
                      <Button
                        onClick={() => navigate("/projects")}
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5"
                      >
                        <FolderOpen className="h-3.5 w-3.5" /> Open projects
                      </Button>
                      <Button
                        onClick={() => navigate(`/requests?clientId=${selectedClient.id}`)}
                        size="sm"
                        variant="outline"
                        className="h-8"
                      >
                        <Send className="h-3.5 w-3.5 mr-1" /> {t("clients.newRequest")}
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 border-b border-border pb-5 sm:grid-cols-4">
                    <div className="rounded-lg border border-border/70 bg-background p-3"><p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Projects</p><p className="mt-1 text-xl font-semibold text-foreground">{selectedClient.projectsCount || 0}</p></div>
                    <div className="rounded-lg border border-border/70 bg-background p-3"><p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Contacts</p><p className="mt-1 text-xl font-semibold text-foreground">{selectedClient.contacts?.length || 0}</p></div>
                    <div className="rounded-lg border border-border/70 bg-background p-3"><p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Industry</p><p className="mt-1 truncate text-sm font-semibold text-foreground">{selectedClient.industry || "—"}</p></div>
                    <div className="rounded-lg border border-border/70 bg-background p-3"><p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Website</p><p className="mt-1 text-sm font-semibold text-foreground">{selectedClient.website ? "Linked" : "—"}</p></div>
                  </div>

                  {/* Contacts Section */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-semibold text-foreground">{t("clients.clientContacts")}</h3>
                      <Button onClick={() => setAddingContact(true)} size="sm" variant="outline" className="h-8">
                        <Plus className="h-3.5 w-3.5 mr-1" /> {t("clients.addContact")}
                      </Button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {selectedClient.contacts?.map((contact) => (
                        <div key={contact.id} className="p-3 border rounded-lg bg-muted/40 relative group">
                          <p className="text-sm font-semibold text-foreground">{contact.name}</p>
                          <p className="text-xs text-muted-foreground mb-2">{contact.role || t("clients.contactPerson")}</p>
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Mail className="h-3.5 w-3.5" />
                              <span>{contact.email}</span>
                            </div>
                            {contact.phone && (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Phone className="h-3.5 w-3.5" />
                                <span>{contact.phone}</span>
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => handleDeleteContact(contact.id)}
                            className="absolute top-2 right-2 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                          >
                            {t("clients.remove")}
                          </button>
                        </div>
                      ))}
                      {(!selectedClient.contacts || selectedClient.contacts.length === 0) && (
                        <EmptyState className="col-span-2" icon={<Building2 className="h-7 w-7" />} title={t("clients.noContactInfo")} subtitle={t("clients.addContact")} />
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
                  <Building2 className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                  <p className="text-sm font-medium text-foreground">{t("clients.selectClientHint")}</p><Button size="sm" className="mt-4" onClick={openCreateClientDialog}><Plus className="mr-1 h-4 w-4" />{t("clients.addClient")}</Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Add Client Dialog */}
        <Dialog open={addingClient} onOpenChange={(open) => {
          setAddingClient(open);
          if (!open) setEditingClient(null);
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingClient ? t("clients.editAccount") : t("clients.addAccount")}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveClient} className="space-y-4 py-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">{t("clients.clientName")}</label>
                <Input
                  required
                  placeholder={t("clients.clientNamePlaceholder")}
                  value={clientForm.name}
                  onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">{t("clients.industry")}</label>
                <Input
                  placeholder={t("clients.industryPlaceholder")}
                  value={clientForm.industry}
                  onChange={(e) => setClientForm({ ...clientForm, industry: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">{t("clients.website")}</label>
                <Input
                  placeholder={t("clients.websitePlaceholder")}
                  value={clientForm.website}
                  onChange={(e) => setClientForm({ ...clientForm, website: e.target.value })}
                />
              </div>

              {!editingClient && (
                <div className="space-y-2 border-t border-border pt-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground">{t("clients.contacts")}</label>
                  <Button type="button" variant="outline" size="sm" className="h-7 px-2" onClick={addNewClientContactRow}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> {t("clients.addContact")}
                  </Button>
                </div>
                {newClientContacts.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t("clients.contactsHint")}</p>
                ) : (
                  <div className="space-y-2">
                    {newClientContacts.map((c, idx) => (
                      <div key={idx} className="relative grid grid-cols-2 gap-2 rounded-lg border border-border p-3">
                        <button
                          type="button"
                          aria-label={t("clients.removeContact")}
                          onClick={() => removeNewClientContactRow(idx)}
                          className="absolute top-2 right-2 text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                        <Input
                          className="col-span-2 sm:col-span-1"
                          placeholder={t("clients.contactName")}
                          value={c.name}
                          onChange={(e) => updateNewClientContactRow(idx, "name", e.target.value)}
                        />
                        <Input
                          className="col-span-2 sm:col-span-1"
                          type="email"
                          placeholder={t("clients.contactEmail")}
                          value={c.email}
                          onChange={(e) => updateNewClientContactRow(idx, "email", e.target.value)}
                        />
                        <Input
                          placeholder={t("clients.contactPhone")}
                          value={c.phone}
                          onChange={(e) => updateNewClientContactRow(idx, "phone", e.target.value)}
                        />
                        <Input
                          placeholder={t("clients.contactRole")}
                          value={c.role}
                          onChange={(e) => updateNewClientContactRow(idx, "role", e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                )}
                </div>
              )}

              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => setAddingClient(false)}>
                  {t("clients.cancel")}
                </Button>
                <Button type="submit">{editingClient ? t("clients.saveClient") : t("clients.createClient")}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Add Contact Dialog */}
        <Dialog open={addingContact} onOpenChange={setAddingContact}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("clients.addClientContact")}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddContact} className="space-y-4 py-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">{t("clients.fullName")}</label>
                <Input
                  required
                  placeholder={t("clients.fullNamePlaceholder")}
                  value={contactForm.name}
                  onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">{t("clients.emailAddress")}</label>
                <Input
                  required
                  type="email"
                  placeholder={t("clients.emailPlaceholder")}
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">{t("clients.phoneNumber")}</label>
                <Input
                  placeholder={t("clients.phonePlaceholder")}
                  value={contactForm.phone}
                  onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">{t("clients.roleDesignation")}</label>
                <Input
                  placeholder={t("clients.rolePlaceholder")}
                  value={contactForm.role}
                  onChange={(e) => setContactForm({ ...contactForm, role: e.target.value })}
                />
              </div>
              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => setAddingContact(false)}>
                  {t("clients.cancel")}
                </Button>
                <Button type="submit">{t("clients.saveContact")}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <ConfirmDialog
          open={deletingClient !== null}
          onOpenChange={(open) => {
            if (!open) setDeletingClient(null);
          }}
          title={t("clients.deleteTitle")}
          description={t("clients.deleteDescription", { name: deletingClient?.name })}
          onConfirm={handleDeleteClient}
          confirmLabel={t("clients.deleteConfirm")}
        />
      </div>
    </div>
  );
}
