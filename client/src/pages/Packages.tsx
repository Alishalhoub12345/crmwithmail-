import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Package, Plus, Edit2, Trash2, Loader2, X, CheckCircle } from "lucide-react";

const emptyForm = {
  name: "",
  billingCycle: "1_month",
  description: "",
  price: "",
  durationDays: "30",
  freeMonths: "0",
  freeTrialDays: "0",
  branchId: "",
  branchIds: [] as string[],
  dietitianHours: "0",
  includedPtSessions: "0",
  allowsFreeze: false,
  freezeDaysAllowed: "0",
  autoRenew: false,
  includesGymAccess: true,
  includesClasses: true,
  allowsAllBranches: false,
  status: "active",
};

const cycleDays: Record<string, number> = {
  "1_day": 1,
  "1_week": 7,
  "2_weeks": 14,
  "1_month": 30,
  "2_months": 60,
  "3_months": 90,
  "4_months": 120,
  "5_months": 150,
  "6_months": 180,
  "1_year": 365,
};

const freeTrialOptions = [
  { value: "0", label: "No extra days" },
  { value: "7", label: "1 week extra" },
  { value: "14", label: "2 weeks extra" },
  { value: "30", label: "1 month extra" },
  { value: "60", label: "2 months extra" },
  { value: "90", label: "3 months extra" },
  { value: "120", label: "4 months extra" },
  { value: "150", label: "5 months extra" },
  { value: "180", label: "6 months extra" },
];

export default function Packages() {
  const { toast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [packageToDelete, setPackageToDelete] = useState<any>(null);
  const { data: packages = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/packages"] });
  const { data: branches = [] } = useQuery<any[]>({ queryKey: ["/api/branches"] });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/packages", data).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/packages"] });
      closeModal();
      toast({ title: "Package created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => apiRequest("PUT", `/api/packages/${id}`, data).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/packages"] });
      closeModal();
      toast({ title: "Package updated" });
    },
    onError: () => toast({ title: "Error", description: "Failed to update", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/packages/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/packages"] });
      setPackageToDelete(null);
      toast({ title: "Package deleted" });
    },
    onError: () => toast({ title: "Error", description: "Failed to delete", variant: "destructive" }),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (pkg: any) => {
    setEditing(pkg);
    setForm({
      name: pkg.name,
      billingCycle: pkg.billingCycle,
      description: pkg.description || "",
      price: pkg.price,
      durationDays: pkg.durationDays,
      freeMonths: String(pkg.freeMonths ?? pkg.free_months ?? "0"),
      freeTrialDays: String(pkg.freeTrialDays ?? pkg.free_trial_days ?? ((Number(pkg.freeMonths ?? pkg.free_months ?? 0) || 0) * 30)),
      branchId: pkg.branchId || "",
      branchIds: (pkg.branchIds || []).map((id: number | string) => String(id)),
      dietitianHours: pkg.dietitianHours ?? "0",
      includedPtSessions: pkg.includedPtSessions ?? "0",
      allowsFreeze: Boolean(pkg.allowsFreeze),
      freezeDaysAllowed: pkg.freezeDaysAllowed ?? "0",
      autoRenew: Boolean(pkg.autoRenew),
      includesGymAccess: Boolean(pkg.includesGymAccess),
      includesClasses: Boolean(pkg.includesClasses),
      allowsAllBranches: Boolean(pkg.allowsAllBranches),
      status: pkg.status,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedBranchIds = (form.branchIds || []).map((id: string) => parseInt(id, 10)).filter(Boolean);

    const data = {
      ...form,
      packageType: "membership",
      tier: "bronze",
      durationDays: (cycleDays[form.billingCycle] || parseInt(form.durationDays, 10)) + (parseInt(form.freeTrialDays, 10) || 0),
      price: parseFloat(form.price),
      branchId: form.allowsAllBranches ? null : (selectedBranchIds[0] ?? null),
      branchIds: form.allowsAllBranches ? [] : selectedBranchIds,
      gymAccessHours: null,
      coachHours: 0,
      dietitianHours: form.dietitianHours ? parseInt(form.dietitianHours, 10) : 0,
      sessionsPerWeek: null,
      totalClasses: null,
      freeMonths: 0,
      freeTrialDays: parseInt(form.freeTrialDays, 10) || 0,
      includedPtSessions: form.includedPtSessions ? parseInt(form.includedPtSessions, 10) : 0,
      freezeDaysAllowed: form.freezeDaysAllowed ? parseInt(form.freezeDaysAllowed, 10) : 0,
      selectedClassTitles: [],
      selectedClassCredits: {},
      selectedClassIds: [],
    };

    if (editing) {
      updateMutation.mutate({ id: editing.id, data });
      return;
    }

    createMutation.mutate(data);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Packages</h1>
          <p className="mt-1 text-sm text-gray-500">Membership, PT, and hybrid plans with freeze and renewal controls</p>
        </div>
        <button
          onClick={openCreate}
          data-testid="button-add-package"
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 sm:w-auto"
        >
          <Plus className="h-4 w-4" /> Add Package
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(packages as any[]).length === 0 ? (
            <div className="col-span-3 py-16 text-center text-gray-400">No packages yet</div>
          ) : (
            (packages as any[]).map((pkg: any) => (
              <div key={pkg.id} data-testid={`package-card-${pkg.id}`} className="rounded-xl border border-border bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Package className="h-5 w-5 text-primary" />
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${pkg.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {pkg.status}
                  </span>
                </div>
                <h3 className="mb-1 font-semibold text-gray-900">{pkg.name}</h3>
                <div className="mb-1 text-2xl font-bold text-primary">${parseFloat(pkg.price).toFixed(2)}</div>
                <div className="mb-3 text-sm text-gray-500">{pkg.durationDays} days</div>
                {pkg.description && <p className="mb-3 line-clamp-2 text-xs text-gray-400">{pkg.description}</p>}

                <div className="mb-4 space-y-1.5">
                  <div className={`flex items-center gap-1.5 text-xs ${pkg.includesGymAccess ? "text-green-600" : "text-gray-300"}`}>
                    <CheckCircle className="h-3.5 w-3.5" /> Gym Access
                  </div>
                  <div className={`flex items-center gap-1.5 text-xs ${pkg.includesClasses ? "text-green-600" : "text-gray-300"}`}>
                    <CheckCircle className="h-3.5 w-3.5" /> Classes Included
                  </div>
                  <div className="text-xs text-gray-500">{pkg.includedPtSessions || 0} PT sessions</div>
                  <div className="text-xs text-gray-500">{pkg.allowsFreeze ? `${pkg.freezeDaysAllowed || 0} freeze days allowed` : "No freeze support"}</div>
                  <div className="text-xs text-gray-500">{pkg.autoRenew ? "Auto renewal enabled" : "Manual renewal"}</div>
                  <div className="text-xs text-gray-500">
                    {pkg.allowsAllBranches
                      ? "All branches access"
                      : Array.isArray(pkg.branchNames) && pkg.branchNames.length > 0
                        ? pkg.branchNames.join(", ")
                        : "Selected branches access"}
                  </div>
                </div>

                <div className="flex gap-2 border-t border-border pt-3">
                  <button onClick={() => openEdit(pkg)} data-testid={`button-edit-package-${pkg.id}`} className="flex items-center gap-1.5 text-xs text-gray-600 transition-colors hover:text-primary">
                    <Edit2 className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button onClick={() => setPackageToDelete(pkg)} data-testid={`button-delete-package-${pkg.id}`} className="ml-auto flex items-center gap-1.5 text-xs text-red-500 transition-colors hover:text-red-700">
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-border bg-white p-5">
              <h2 className="font-semibold text-gray-900">{editing ? "Edit Package" : "Add Package"}</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Package Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  placeholder="e.g. PT Hybrid Gold"
                  className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Billing Cycle</label>
                <select
                  value={form.billingCycle}
                  onChange={(e) => setForm({ ...form, billingCycle: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="1_day">1 day</option>
                  <option value="1_week">1 week</option>
                  <option value="2_weeks">2 weeks</option>
                  <option value="1_month">1 month</option>
                  <option value="2_months">2 months</option>
                  <option value="3_months">3 months</option>
                  <option value="4_months">4 months</option>
                  <option value="5_months">5 months</option>
                  <option value="6_months">6 months</option>
                  <option value="1_year">1 year</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Price ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  required
                  className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">PT Sessions</label>
                <input
                  type="number"
                  step="1"
                  value={form.includedPtSessions}
                  onChange={(e) => setForm({ ...form, includedPtSessions: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Freeze Days Allowed</label>
                <input
                  type="number"
                  step="1"
                  value={form.freezeDaysAllowed}
                  onChange={(e) => setForm({ ...form, freezeDaysAllowed: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Dietitian Hours</label>
                <input
                  type="number"
                  step="1"
                  value={form.dietitianHours}
                  onChange={(e) => setForm({ ...form, dietitianHours: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Bonus Duration</label>
                <select
                  value={form.freeTrialDays}
                  onChange={(e) => setForm({ ...form, freeTrialDays: e.target.value, freeMonths: "0" })}
                  className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {freeTrialOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">Added on top of the selected billing cycle.</p>
              </div>

              <div className="sm:col-span-2 lg:col-span-3">
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Branches</label>
                <div className="mb-2 text-xs text-gray-500">
                  {form.allowsAllBranches ? "This package is available in all branches." : "You can select more than one branch."}
                </div>
                <div className={`grid grid-cols-1 gap-2 rounded-lg border border-gray-200 bg-white p-3 sm:grid-cols-2 ${form.allowsAllBranches ? "opacity-60" : ""}`}>
                  {(branches as any[]).map((branch: any) => (
                    <label key={branch.id} className="flex items-center gap-2 rounded-lg border border-gray-100 px-3 py-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={(form.branchIds || []).includes(String(branch.id))}
                        disabled={form.allowsAllBranches}
                        onChange={(e) =>
                          setForm((current: any) => ({
                            ...current,
                            branchIds: e.target.checked
                              ? [...(current.branchIds || []), String(branch.id)]
                              : (current.branchIds || []).filter((id: string) => id !== String(branch.id)),
                          }))
                        }
                        className="rounded"
                      />
                      <span>{branch.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="sm:col-span-2 lg:col-span-3">
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full resize-none rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-3 flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6">
                {[
                  ["includesGymAccess", "Includes Gym Access"],
                  ["includesClasses", "Includes Classes"],
                  ["allowsAllBranches", "Access All Branches"],
                  ["allowsFreeze", "Allows Freeze"],
                  ["autoRenew", "Auto Renew"],
                ].map(([key, label]) => (
                  <label key={key} className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={form[key]}
                      onChange={(e) =>
                        setForm((current: any) => ({
                          ...current,
                          [key]: e.target.checked,
                          ...(key === "allowsAllBranches" && e.target.checked ? { branchIds: [], branchId: "" } : {}),
                        }))
                      }
                      className="rounded"
                    />
                    {label}
                  </label>
                ))}
              </div>

              <div className="sm:col-span-2 lg:col-span-3 flex gap-3 pt-2">
                <button type="button" onClick={closeModal} className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editing ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {packageToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-border p-5">
              <h2 className="font-semibold text-gray-900">Delete Package</h2>
              <button onClick={() => setPackageToDelete(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm text-gray-600">
                Are you sure you want to delete <span className="font-semibold text-gray-900">{packageToDelete.name}</span>?
              </p>
              <p className="mt-2 text-xs text-gray-400">This action cannot be undone.</p>
              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={() => setPackageToDelete(null)}
                  className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-700 transition-colors hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(packageToDelete.id)}
                  disabled={deleteMutation.isPending}
                  className="flex-1 rounded-lg bg-red-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50"
                >
                  {deleteMutation.isPending ? "Deleting..." : "Delete Package"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
