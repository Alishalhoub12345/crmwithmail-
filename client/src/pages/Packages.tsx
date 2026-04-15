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
  branchId: "",
  dietitianHours: "0",
  totalClasses: "",
  includedPtSessions: "0",
  allowsFreeze: false,
  freezeDaysAllowed: "0",
  autoRenew: false,
  includesGymAccess: true,
  includesClasses: true,
  allowsAllBranches: false,
  selectedClassTitles: [] as string[],
  status: "active",
};

const cycleDays: Record<string, number> = {
  "1_month": 30,
  "3_months": 90,
  "6_months": 180,
  "1_year": 365,
};

export default function Packages() {
  const { toast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [didInitSelectedClasses, setDidInitSelectedClasses] = useState(false);

  const { data: packages = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/packages"] });
  const { data: branches = [] } = useQuery<any[]>({ queryKey: ["/api/branches"] });
  const { data: classes = [] } = useQuery<any[]>({ queryKey: ["/api/classes"] });

  const getVisibleBranchClasses = (branchId: string) =>
    (classes as any[]).filter((gymClass: any) => {
      if (gymClass.status !== "scheduled") {
        return false;
      }

      if (!branchId) {
        return true;
      }

      return String(gymClass.branchId) === String(branchId) || gymClass.branchId == null;
    });

  const getWindowEndDate = (billingCycle: string) => {
    const days = cycleDays[billingCycle] || 30;
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + Math.max(days - 1, 0));
    return date;
  };

  const getScheduledClassesInCycle = (branchId: string, billingCycle: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = getWindowEndDate(billingCycle);

    return getVisibleBranchClasses(branchId).filter((gymClass: any) => {
      if (!gymClass.classDate) {
        return false;
      }

      const classDate = new Date(`${gymClass.classDate}T00:00:00`);
      return !Number.isNaN(classDate.getTime()) && classDate >= today && classDate <= endDate;
    });
  };

  const getVisibleClassTypes = (branchId: string) => {
    const grouped = new Map<string, {
      title: string;
      count: number;
      description: string;
      price: number;
      priceType: string;
    }>();

    for (const gymClass of getScheduledClassesInCycle(branchId, form.billingCycle)) {
      const title = String(gymClass.title || "").trim();
      if (!title) {
        continue;
      }

      const key = title.toLowerCase();
      const existing = grouped.get(key);
      if (existing) {
        existing.count += 1;
        if (!existing.description && gymClass.description) {
          existing.description = gymClass.description;
        }

        if ((!existing.price || Number(existing.price) === 0) && Number(gymClass.price) > 0) {
          existing.price = Number(gymClass.price);
          existing.priceType = gymClass.priceType || "per_class";
        }
        continue;
      }

      grouped.set(key, {
        title,
        count: 1,
        description: gymClass.description || "",
        price: Number(gymClass.price || 0),
        priceType: gymClass.priceType || "per_class",
      });
    }

    return Array.from(grouped.values()).sort((a, b) => a.title.localeCompare(b.title));
  };

  const formatClassPrice = (classType: { price?: number; priceType?: string }) => {
    const amount = Number(classType.price ?? 0);
    const suffix = classType.priceType === "monthly" ? "/ month" : "/ class";

    if (!Number.isFinite(amount) || amount <= 0) {
      return classType.priceType === "monthly" ? "Monthly price not set" : "Class price not set";
    }

    return `$${amount.toFixed(2)} ${suffix}`;
  };

  const getPackageSelectedClassTitles = (pkg: any) => {
    const selectedTitles = (pkg.selectedClassTitles ?? pkg.selected_class_titles ?? []) as Array<string>;
    if (selectedTitles.length > 0) {
      return selectedTitles.map((title) => String(title));
    }

    const selectedIds = (pkg.selectedClassIds ?? pkg.selected_class_ids ?? []) as Array<number | string>;
    if (selectedIds.length === 0) {
      return [];
    }

    const classTitleById = new Map((classes as any[]).map((gymClass: any) => [String(gymClass.id), String(gymClass.title || "").trim()]));

    return Array.from(
      new Set(
        selectedIds
          .map((id) => classTitleById.get(String(id)) || "")
          .filter(Boolean),
      ),
    );
  };

  const getSelectedClassCredits = (selectedTitles: string[], classTypes: Array<{ title: string; count: number }>) => {
    const selected = new Set(selectedTitles.map((title) => title.trim().toLowerCase()));
    const credits: Record<string, number> = {};

    for (const classType of classTypes) {
      if (selected.has(classType.title.trim().toLowerCase())) {
        credits[classType.title] = classType.count;
      }
    }

    return credits;
  };

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
      toast({ title: "Package deleted" });
    },
    onError: () => toast({ title: "Error", description: "Failed to delete", variant: "destructive" }),
  });

  const openCreate = () => {
    setEditing(null);
    setDidInitSelectedClasses(false);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (pkg: any) => {
    setEditing(pkg);
    setDidInitSelectedClasses(true);
    setForm({
      name: pkg.name,
      billingCycle: pkg.billingCycle,
      description: pkg.description || "",
      price: pkg.price,
      durationDays: pkg.durationDays,
      freeMonths: String(pkg.freeMonths ?? pkg.free_months ?? "0"),
      branchId: pkg.branchId || "",
      dietitianHours: pkg.dietitianHours ?? "0",
      totalClasses: pkg.totalClasses || "",
      includedPtSessions: pkg.includedPtSessions ?? "0",
      allowsFreeze: Boolean(pkg.allowsFreeze),
      freezeDaysAllowed: pkg.freezeDaysAllowed ?? "0",
      autoRenew: Boolean(pkg.autoRenew),
      includesGymAccess: Boolean(pkg.includesGymAccess),
      includesClasses: Boolean(pkg.includesClasses),
      allowsAllBranches: Boolean(pkg.allowsAllBranches),
      selectedClassTitles: getPackageSelectedClassTitles(pkg),
      status: pkg.status,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setDidInitSelectedClasses(false);
    setForm(emptyForm);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const data = {
      ...form,
      packageType: "membership",
      tier: "bronze",
      durationDays: (cycleDays[form.billingCycle] || parseInt(form.durationDays, 10)) + ((parseInt(form.freeMonths, 10) || 0) * 30),
      price: parseFloat(form.price),
      branchId: form.branchId ? parseInt(form.branchId, 10) : null,
      gymAccessHours: null,
      coachHours: 0,
      dietitianHours: form.dietitianHours ? parseInt(form.dietitianHours, 10) : 0,
      sessionsPerWeek: null,
      totalClasses: form.totalClasses ? parseInt(form.totalClasses, 10) : null,
      freeMonths: parseInt(form.freeMonths, 10) || 0,
      includedPtSessions: form.includedPtSessions ? parseInt(form.includedPtSessions, 10) : 0,
      freezeDaysAllowed: form.freezeDaysAllowed ? parseInt(form.freezeDaysAllowed, 10) : 0,
      selectedClassTitles: form.includesClasses
        ? (form.selectedClassTitles || []).map((title: string) => title.trim()).filter(Boolean)
        : [],
      selectedClassCredits: form.includesClasses
        ? getSelectedClassCredits(form.selectedClassTitles || [], visibleClassTypes)
        : {},
    };

    if (editing) {
      updateMutation.mutate({ id: editing.id, data });
      return;
    }

    createMutation.mutate(data);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const visibleClassTypes = getVisibleClassTypes(form.branchId);
  const scheduledClassesInCycle = getScheduledClassesInCycle(form.branchId, form.billingCycle);
  const selectedClassTypeDetails = visibleClassTypes
    .filter((classType) => (form.selectedClassTitles || []).includes(classType.title))
    .sort((a, b) => a.title.localeCompare(b.title));

  useEffect(() => {
    if (!form.includesClasses) {
      if (form.totalClasses !== "") {
        setForm((current: any) => ({
          ...current,
          totalClasses: "",
        }));
      }
      return;
    }

    const selectedTitles = new Set(
      ((form.selectedClassTitles || []) as string[]).map((title) => String(title).trim().toLowerCase()),
    );

    const matchingClasses = scheduledClassesInCycle.filter((gymClass: any) => {
      return selectedTitles.has(String(gymClass.title || "").trim().toLowerCase());
    });

    const nextCredits = String(matchingClasses.length);
    if (form.totalClasses !== nextCredits) {
      setForm((current: any) => ({
        ...current,
        totalClasses: nextCredits,
      }));
    }
  }, [form.billingCycle, form.branchId, form.includesClasses, form.selectedClassTitles, form.totalClasses, scheduledClassesInCycle]);

  useEffect(() => {
    if (!showModal || !form.includesClasses) {
      return;
    }

    if (editing || didInitSelectedClasses) {
      return;
    }

    if ((form.selectedClassTitles || []).length > 0 || visibleClassTypes.length === 0) {
      return;
    }

    setForm((current: any) => ({
      ...current,
      selectedClassTitles: visibleClassTypes.map((classType) => classType.title),
    }));
    setDidInitSelectedClasses(true);
  }, [didInitSelectedClasses, editing, form.includesClasses, form.selectedClassTitles, showModal, visibleClassTypes]);

  const handleBranchChange = (branchId: string) => {
    const nextVisibleClassTitles = new Set(getVisibleClassTypes(branchId).map((classType) => classType.title));

    setForm((current: any) => ({
      ...current,
      branchId,
      selectedClassTitles: (current.selectedClassTitles || []).filter((title: string) => nextVisibleClassTitles.has(String(title))),
    }));
  };

  const toggleSelectedClassType = (title: string, checked: boolean) => {
    setForm((current: any) => ({
      ...current,
      selectedClassTitles: checked
        ? Array.from(new Set([...(current.selectedClassTitles || []), title]))
        : (current.selectedClassTitles || []).filter((item: string) => item !== title),
    }));
  };

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
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#8a6b00]">
                  {pkg.packageType || "membership"} · {(pkg.tier || "bronze")} · {String(pkg.billingCycle || "1_month").replace(/_/g, " ")}
                </div>
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
                  <div className="text-xs text-gray-500">{pkg.coachHours || 0} coach hours</div>
                  <div className="text-xs text-gray-500">{pkg.includedPtSessions || 0} PT sessions</div>
                  <div className="text-xs text-gray-500">{pkg.totalClasses || 0} class credits</div>
                  <div className="text-xs text-gray-500">{pkg.allowsFreeze ? `${pkg.freezeDaysAllowed || 0} freeze days allowed` : "No freeze support"}</div>
                  <div className="text-xs text-gray-500">{pkg.autoRenew ? "Auto renewal enabled" : "Manual renewal"}</div>
                  <div className="text-xs text-gray-500">{pkg.allowsAllBranches ? "All branches access" : "Single branch access"}</div>
                </div>

                <div className="flex gap-2 border-t border-border pt-3">
                  <button onClick={() => openEdit(pkg)} data-testid={`button-edit-package-${pkg.id}`} className="flex items-center gap-1.5 text-xs text-gray-600 transition-colors hover:text-primary">
                    <Edit2 className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button onClick={() => deleteMutation.mutate(pkg.id)} data-testid={`button-delete-package-${pkg.id}`} className="ml-auto flex items-center gap-1.5 text-xs text-red-500 transition-colors hover:text-red-700">
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
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Branch</label>
                <select
                  value={form.branchId}
                  onChange={(e) => handleBranchChange(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">Global (all branches)</option>
                  {(branches as any[]).map((branch: any) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Billing Cycle</label>
                <select
                  value={form.billingCycle}
                  onChange={(e) => setForm({ ...form, billingCycle: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="1_month">1 month</option>
                  <option value="3_months">3 months</option>
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
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Class Credits</label>
                <input
                  type="number"
                  step="1"
                  value={form.totalClasses}
                  readOnly
                  className="w-full rounded-lg border border-gray-200 bg-gray-100 px-3.5 py-2.5 text-sm text-gray-600 focus:outline-none"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Auto-calculated from scheduled classes inside the selected billing cycle.
                </p>
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
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Free Months</label>
                <select
                  value={form.freeMonths}
                  onChange={(e) => setForm({ ...form, freeMonths: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {[0, 1, 2, 3, 4, 5, 6].map((value) => (
                    <option key={value} value={String(value)}>
                      {value} {value === 1 ? "month" : "months"}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">Added on top of the selected package duration.</p>
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

              {form.includesClasses && (
                <div className="sm:col-span-2 lg:col-span-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="mb-2 text-sm font-medium text-gray-700">Available Class Types In This Branch</div>
                  <p className="mb-3 text-xs text-gray-500">
                    {form.branchId
                      ? "Check only the class types this package should allow, like boxing or yoga. Credits use only scheduled sessions inside the selected billing cycle."
                      : "Check only the class types this global package should allow. Repeated sessions are grouped under one class type and counted only inside the selected billing cycle."}
                  </p>
                  {visibleClassTypes.length > 0 && (
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setForm((current: any) => ({
                            ...current,
                            selectedClassTitles: visibleClassTypes.map((classType) => classType.title),
                          }))
                        }
                        className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm((current: any) => ({ ...current, selectedClassTitles: [] }))}
                        className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
                      >
                        Clear All
                      </button>
                      <span className="text-xs text-gray-500">
                        {(form.selectedClassTitles || []).length} selected
                      </span>
                    </div>
                  )}
                  <div className="max-h-[180px] space-y-2 overflow-y-auto rounded-lg border border-gray-200 bg-white p-3">
                    {visibleClassTypes.length === 0 ? (
                      <div className="text-sm text-gray-400">No class types available in this billing cycle.</div>
                    ) : (
                      visibleClassTypes.map((classType) => (
                        <label key={classType.title} className="flex cursor-pointer items-start gap-3 rounded-lg border border-transparent px-3 py-3 text-sm text-gray-700 transition-colors hover:border-gray-100 hover:bg-gray-50">
                          <input
                            type="checkbox"
                            checked={(form.selectedClassTitles || []).includes(classType.title)}
                            onChange={(e) => toggleSelectedClassType(classType.title, e.target.checked)}
                            className="mt-1 rounded"
                          />
                          <span className="min-w-0">
                            <span className="block font-medium text-gray-900">{classType.title}</span>
                            <span className="block text-xs text-primary">{formatClassPrice(classType)}</span>
                            <span className="block text-xs text-gray-500">{classType.count} credits in this billing cycle</span>
                            {classType.description && (
                              <span className="mt-1 block text-xs text-gray-500">{classType.description}</span>
                            )}
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                  <p className="mt-3 text-xs text-gray-500">
                    {`There are ${scheduledClassesInCycle.length} scheduled class sessions in this package period.`} Members will use credits only for the checked class types during this cycle. If nothing is checked, class credits stay at 0.
                  </p>
                  <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Credits Per Class Type</div>
                    <div className="space-y-1.5">
                      {selectedClassTypeDetails.map((classType) => (
                        <div key={classType.title} className="rounded-lg border border-transparent px-3 py-3 text-sm text-gray-700">
                          <div className="font-medium text-gray-900">{classType.title}</div>
                          <div className="text-xs text-primary">{formatClassPrice(classType)}</div>
                          <div className="text-xs text-gray-500">{classType.count} credits in this billing cycle</div>
                          {classType.description && (
                            <div className="mt-1 text-xs text-gray-500">{classType.description}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

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
                      onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
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
    </DashboardLayout>
  );
}
