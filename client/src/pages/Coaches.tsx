import { ChangeEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Edit2,
  Loader2,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { EmailLink, PhoneActions } from "@/components/ContactLinks";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useToast } from "@/hooks/use-toast";
import { getPasswordChecks, isStrongPassword } from "@/lib/password";
import { apiRequest, getToken, queryClient } from "@/lib/queryClient";

const HR_ROLES = [
  "Owner",
  "Club Manager",
  "L&D Coach",
  "HR Supervisor",
  "FD Supervisor",
  "FD Officier",
  "Gym Supervisor",
  "Floor Trainer",
  "Personal Trainer",
  "Other",
] as const;

const emptyForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  address: "",
  password: "",
  confirmPassword: "",
  branchId: "",
  branchIds: [] as string[],
  allBranches: false,
  roleTitle: "Owner",
  birthDate: "",
  gender: "",
  startDate: "",
  endDate: "",
  status: "active",
  salary: "",
  commissionRate: "",
  bonus: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  emergencyContactEmail: "",
  bio: "",
  certificationExpiryDate: "",
  vacationDaysAllowed: "0",
  vacationDaysTaken: "0",
  picture: null as File | null,
  certificationFiles: [] as File[],
  documentFiles: [] as File[],
  legalFiles: [] as File[],
};

type HrForm = typeof emptyForm;

const fieldClassName =
  "w-full rounded-xl border border-[#d8d1bf] bg-[#f7f3e8] px-3.5 py-3 text-sm text-[#1f2937] shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] transition focus:border-[#c49b2c] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#f4b516]/15";

const fileClassName =
  "w-full rounded-xl border border-[#d8d1bf] bg-[#f7f3e8] px-3 py-2.5 text-sm text-[#1f2937] transition file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-[#3f3a2f] hover:file:bg-[#f3ead1] focus-within:border-[#c49b2c] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#f4b516]/15";

function buildHrFormData(form: HrForm): FormData {
  const data = new FormData();
  const fullName = [form.firstName, form.lastName].filter(Boolean).join(" ").trim();

  [
    ["name", fullName],
    ["firstName", form.firstName],
    ["lastName", form.lastName],
    ["email", form.email],
    ["phone", form.phone],
    ["address", form.address],
    ["password", form.password],
    ["roleTitle", form.roleTitle],
    ["birthDate", form.birthDate],
    ["gender", form.gender],
    ["startDate", form.startDate],
    ["endDate", form.endDate],
    ["status", form.status],
    ["salary", form.salary],
    ["commissionRate", form.commissionRate],
    ["bonus", form.bonus],
    ["emergencyContactName", form.emergencyContactName],
    ["emergencyContactPhone", form.emergencyContactPhone],
    ["emergencyContactEmail", form.emergencyContactEmail],
    ["bio", form.bio],
    ["certificationExpiryDate", form.certificationExpiryDate],
    ["vacationDaysAllowed", form.vacationDaysAllowed],
    ["vacationDaysTaken", form.vacationDaysTaken],
  ].forEach(([key, value]) => {
    if (value !== "") {
      data.append(key, value);
    }
  });

  const selectedBranchIds = Array.from(
    new Set([...(form.branchIds || []), form.branchId].filter((value) => value !== "")),
  );

  if (!form.allBranches && selectedBranchIds.length > 0) {
    data.append("branchId", selectedBranchIds[0]);
    selectedBranchIds.forEach((branchId) => data.append("branchIds[]", branchId));
  }

  data.append("allBranches", form.allBranches ? "1" : "0");

  if (form.picture) {
    data.append("picture", form.picture);
  }

  form.certificationFiles.forEach((file) => data.append("certificationFiles[]", file));
  form.documentFiles.forEach((file) => data.append("documentFiles[]", file));
  form.legalFiles.forEach((file) => data.append("legalFiles[]", file));

  return data;
}

async function openProtectedFile(url?: string | null) {
  if (!url) {
    return;
  }

  const token = getToken();
  const previewWindow = window.open("", "_blank");

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "*/*",
        "X-Requested-With": "XMLHttpRequest",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      throw new Error("Unable to open document");
    }

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    if (previewWindow) {
      previewWindow.location.href = blobUrl;
    } else {
      window.open(blobUrl, "_blank");
    }
  } catch (error) {
    if (previewWindow) {
      previewWindow.close();
    }

    throw error;
  }
}

function existingFilesList(files?: Array<{ name?: string; path?: string; url?: string }>) {
  if (!files || files.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 space-y-1">
      {files.map((file, index) => (
        <div
          key={`${file.path || file.name || "file"}-${index}`}
          className="flex items-center justify-between gap-3 rounded-lg border border-[#ece3d1] bg-[#faf7f0] px-3 py-2"
        >
          <div className="truncate text-xs text-gray-500">{file.name || file.path || "Uploaded file"}</div>
          {file.url ? (
            <button
              type="button"
              onClick={() => void openProtectedFile(file.url)}
              className="shrink-0 rounded-md border border-[#d8cfbc] bg-white px-2 py-1 text-[11px] font-medium text-[#5a523f] transition hover:bg-[#f7f2e7]"
            >
              Open document
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export default function Coaches() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [branchSearch, setBranchSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<HrForm>(emptyForm);
  const editorRef = useRef<HTMLDivElement | null>(null);

  const { data: staff = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/coaches"] });
  const { data: branches = [] } = useQuery<any[]>({ queryKey: ["/api/branches"] });

  const createMutation = useMutation({
    mutationFn: (data: FormData) => apiRequest("POST", "/api/coaches", data).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coaches"] });
      closeModal();
      toast({ title: "HR staff created" });
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message || "Failed to create HR staff", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: FormData }) =>
      apiRequest("POST", `/api/coaches/${id}?_method=PUT`, data).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coaches"] });
      closeModal();
      toast({ title: "HR staff updated" });
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message || "Failed to update HR staff", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/coaches/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coaches"] });
      toast({ title: "HR staff deleted" });
    },
    onError: () => toast({ title: "Error", description: "Failed to delete HR staff", variant: "destructive" }),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (staffMember: any) => {
    const staffBranchIds = Array.isArray(staffMember.branchIds) && staffMember.branchIds.length > 0
      ? staffMember.branchIds.map((branchId: number | string) => String(branchId))
      : staffMember.branchId
        ? [String(staffMember.branchId)]
        : [];

    setEditing(staffMember);
    setForm({
      ...emptyForm,
      firstName: staffMember.firstName || "",
      lastName: staffMember.lastName || "",
      email: staffMember.userEmail || "",
      phone: staffMember.userPhone || "",
      address: staffMember.address || "",
      branchId: staffBranchIds[0] || "",
      branchIds: staffBranchIds,
      allBranches: (staffMember.roleTitle || staffMember.specialization) === "Owner" && staffBranchIds.length === 0,
      roleTitle: staffMember.roleTitle || staffMember.specialization || "Owner",
      birthDate: staffMember.birthDate || "",
      gender: staffMember.gender || "",
      startDate: staffMember.hireDate || staffMember.startDate || "",
      endDate: staffMember.endDate || "",
      status: staffMember.status || "active",
      salary: staffMember.salary ? String(staffMember.salary) : "",
      commissionRate: staffMember.commissionRate ? String(staffMember.commissionRate) : "",
      bonus: staffMember.bonus ? String(staffMember.bonus) : "",
      emergencyContactName: staffMember.emergencyContactName || "",
      emergencyContactPhone: staffMember.emergencyContactPhone || "",
      emergencyContactEmail: staffMember.emergencyContactEmail || "",
      bio: staffMember.bio || "",
      certificationExpiryDate: staffMember.certificationExpiryDate || "",
      vacationDaysAllowed: String(staffMember.vacationDaysAllowed ?? 0),
      vacationDaysTaken: String(staffMember.vacationDaysTaken ?? 0),
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const passwordChecks = getPasswordChecks(form.password || "");
  const canUseAllBranches = form.roleTitle === "Owner";
  const canUseMultipleBranches = form.roleTitle === "Personal Trainer";

  const filtered = useMemo(
    () =>
      (staff as any[]).filter((member) => {
        const matchesSearch = `${member.userName || ""} ${member.roleTitle || member.specialization || ""} ${member.userEmail || ""}`
          .toLowerCase()
          .includes(search.toLowerCase());

        const matchesBranch =
          !branchSearch ||
          String(member.branchName || "")
            .split(",")
            .map((value) => value.trim())
            .includes(branchSearch);

        return matchesSearch && matchesBranch;
      }),
    [branchSearch, search, staff],
  );

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!editing && !isStrongPassword(form.password || "Staff@2024")) {
      toast({
        title: "Weak password",
        description: "Password must include one capital letter, one number, and one special character.",
        variant: "destructive",
      });
      return;
    }

    if (editing && form.password) {
      if (!isStrongPassword(form.password)) {
        toast({
          title: "Weak password",
          description: "Password must include one capital letter, one number, and one special character.",
          variant: "destructive",
        });
        return;
      }

      if (form.password !== form.confirmPassword) {
        toast({
          title: "Password mismatch",
          description: "Confirm password must match the new password.",
          variant: "destructive",
        });
        return;
      }
    }

    if (!form.allBranches && form.branchIds.length === 0 && !form.branchId) {
      toast({
        title: "Branch required",
        description: "Select at least one branch, or use All branches for owners.",
        variant: "destructive",
      });
      return;
    }

    const data = buildHrFormData(form);
    if (editing) {
      updateMutation.mutate({ id: editing.id, data });
      return;
    }

    createMutation.mutate(data);
  };

  const updateFileList = (field: "certificationFiles" | "documentFiles" | "legalFiles") =>
    (e: ChangeEvent<HTMLInputElement>) => {
      setForm({ ...form, [field]: Array.from(e.target.files || []) });
    };

  const leaveBalance = Math.max(Number(form.vacationDaysAllowed || 0) - Number(form.vacationDaysTaken || 0), 0);

  useEffect(() => {
    if (showModal) {
      editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [showModal]);

  useEffect(() => {
    if (form.status === "active" && form.endDate !== "") {
      setForm((current) => ({
        ...current,
        endDate: "",
      }));
    }
  }, [form.endDate, form.status]);

  useEffect(() => {
    if (!canUseAllBranches && form.allBranches) {
      setForm((current) => ({
        ...current,
        allBranches: false,
      }));
    }
  }, [canUseAllBranches, form.allBranches]);

  useEffect(() => {
    if (!canUseMultipleBranches && form.branchIds.length > 1) {
      setForm((current) => {
        const primaryBranchId = current.branchIds[0] || current.branchId;

        return {
          ...current,
          branchId: primaryBranchId || "",
          branchIds: primaryBranchId ? [primaryBranchId] : [],
        };
      });
    }
  }, [canUseMultipleBranches, form.branchIds]);

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Human Resources</h1>
          <p className="mt-1 text-sm text-gray-500">{staff.length} staff records</p>
        </div>
        <button
          onClick={openCreate}
          data-testid="button-add-hr"
          className="mt-0.5 flex w-full items-center justify-center gap-2 self-start rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 sm:w-auto"
        >
          <Plus className="h-4 w-4" /> Add Staff
        </button>
      </div>

      <div className="rounded-xl border border-border bg-white shadow-sm">
        <div className="border-b border-border p-4">
          <div className="grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search HR staff..."
                className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <select
              value={branchSearch}
              onChange={(e) => setBranchSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">All branches</option>
              {(branches as any[]).map((branch: any) => (
                <option key={branch.id} value={branch.name}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-gray-50">
                  {["Staff", "Role", "Branch", "Start Date", "Certification", "Status", "Actions"].map((heading) => (
                    <th key={heading} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                      No HR staff found
                    </td>
                  </tr>
                ) : (
                  filtered.map((member: any) => (
                    <tr key={member.id} className="transition-colors hover:bg-gray-50">
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-gray-900">
                          {member.userName || [member.firstName, member.lastName].filter(Boolean).join(" ")}
                        </div>
                        <div className="mt-1 flex flex-col gap-1 text-xs text-gray-500">
                          <EmailLink email={member.userEmail} className="text-gray-500" />
                          <PhoneActions phone={member.userPhone} className="text-gray-500" phoneClassName="text-gray-500" />
                          {!member.userEmail && !member.userPhone && <span>-</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-gray-600">{member.roleTitle || "-"}</td>
                      <td className="px-4 py-3.5 text-gray-600">{member.branchName || "-"}</td>
                      <td className="px-4 py-3.5 text-gray-600">{member.hireDate || "-"}</td>
                      <td className="px-4 py-3.5">
                        {member.certificationExpiryDate ? (
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              member.certificationReminderStatus === "expired"
                                ? "bg-red-100 text-red-700"
                                : member.certificationReminderStatus === "expiring_soon"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-emerald-100 text-emerald-700"
                            }`}
                          >
                            {member.certificationReminderStatus === "expired"
                              ? "Expired"
                              : member.certificationReminderStatus === "expiring_soon"
                                ? "Expiring soon"
                                : "Valid"}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            member.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {member.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEdit(member)}
                            className="rounded p-1.5 text-gray-400 hover:bg-primary/10 hover:text-primary"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => deleteMutation.mutate(member.id)}
                            className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div ref={editorRef} className="mt-6 scroll-mt-6">
          <div className="w-full overflow-hidden rounded-[28px] border border-white bg-white shadow-[0_24px_80px_rgba(35,28,16,0.08)]">
            <div className="flex items-start justify-between border-b border-white bg-white px-4 py-5">
              <div>
                <h2 className="text-xl font-semibold text-[#1b1b18]">{editing ? "Edit HR Staff" : "Add HR Staff"}</h2>
                <p className="mt-1 text-sm text-[#6b665c]">
                  Manage employee records, legal documents, certification tracking, and leave balances.
                </p>
              </div>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 p-6">
              <Section title="Personal Information" description="Basic profile and employment identity details.">
                <Field label="First Name">
                <input
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  required
                  className={fieldClassName}
                />
              </Field>

              <Field label="Last Name">
                <input
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  className={fieldClassName}
                />
              </Field>

              <Field label="Role">
                <select
                  value={form.roleTitle}
                  onChange={(e) => {
                    const nextRole = e.target.value;
                    setForm((current) => {
                      const currentBranchIds = current.branchIds.length > 0
                        ? current.branchIds
                        : current.branchId
                          ? [current.branchId]
                          : [];
                      const nextBranchIds = nextRole === "Personal Trainer"
                        ? currentBranchIds
                        : currentBranchIds.slice(0, 1);

                      return {
                        ...current,
                        roleTitle: nextRole,
                        allBranches: nextRole === "Owner" ? current.allBranches : false,
                        branchId: nextBranchIds[0] || "",
                        branchIds: nextBranchIds,
                        commissionRate: nextRole === "Personal Trainer" && !current.commissionRate ? "15" : current.commissionRate,
                      };
                    });
                  }}
                  className={fieldClassName}
                >
                  {HR_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Email">
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  className={fieldClassName}
                />
              </Field>

              <Field label="Phone Number">
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className={fieldClassName}
                />
              </Field>

              {editing ? (
                <Field label="New Password">
                  <input
                    type="password"
                    value={form.password}
                    placeholder="Leave blank to keep current password"
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className={fieldClassName}
                  />
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                    <span className={`rounded-full px-2 py-0.5 ${passwordChecks.hasUppercase || !form.password ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                      A-Z
                    </span>
                    <span className={`rounded-full px-2 py-0.5 ${passwordChecks.hasDigit || !form.password ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                      0-9
                    </span>
                    <span className={`rounded-full px-2 py-0.5 ${passwordChecks.hasSpecial || !form.password ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                      Special
                    </span>
                  </div>
                </Field>
              ) : null}

              {!editing ? (
                <Field label="Password">
                  <input
                    type="password"
                    value={form.password}
                    placeholder="default: Staff@2024"
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className={fieldClassName}
                  />
                  <div className="mt-2 space-y-1 text-xs">
                    <div className={passwordChecks.hasUppercase || !form.password ? "text-green-600" : "text-gray-500"}>
                      One capital letter
                    </div>
                    <div className={passwordChecks.hasDigit || !form.password ? "text-green-600" : "text-gray-500"}>
                      One digit
                    </div>
                    <div className={passwordChecks.hasSpecial || !form.password ? "text-green-600" : "text-gray-500"}>
                      One special character
                    </div>
                  </div>
                </Field>
              ) : (
                <div />
              )}

              {editing ? (
                <Field label="Confirm Password" className="lg:col-start-1">
                  <input
                    type="password"
                    value={form.confirmPassword}
                    placeholder="Repeat new password"
                    onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                    className={fieldClassName}
                  />
                </Field>
              ) : null}

              <Field label="DOB" className={editing ? "lg:col-start-2" : undefined}>
                <input
                  type="date"
                  value={form.birthDate}
                  onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
                  className={fieldClassName}
                />
              </Field>

              <Field label="Gender" className={editing ? "lg:col-start-3" : undefined}>
                <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} className={fieldClassName}>
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </Field>

              <Field label="Branch" className="sm:col-span-2 lg:col-span-3">
                <div className="rounded-xl border border-[#e1d7bf] bg-[#f7f3e8] p-3">
                  <div className="mb-2 text-xs text-[#7a7362]">
                    {canUseAllBranches
                      ? "Choose one branch or give this owner access to all branches."
                      : canUseMultipleBranches
                        ? "Choose every branch where this personal trainer can accept PT sessions."
                        : "Choose one branch for this HR staff member."}
                  </div>
                  <div className="grid gap-2">
                    {canUseAllBranches ? (
                      <label className="flex items-center gap-2 rounded-lg border border-[#e7dcc4] bg-white px-3 py-2 text-sm text-[#3f3a2f]">
                        <input
                          type="checkbox"
                          checked={form.allBranches}
                          onChange={(e) =>
                            setForm((current) => ({
                              ...current,
                              allBranches: e.target.checked,
                              branchId: e.target.checked ? "" : current.branchId,
                              branchIds: e.target.checked ? [] : current.branchIds,
                            }))
                          }
                          className="rounded"
                        />
                        <span>All branches</span>
                      </label>
                    ) : null}

                    {(branches as any[]).map((branch) => (
                      <label key={branch.id} className="flex items-center gap-2 rounded-lg border border-[#e7dcc4] bg-white px-3 py-2 text-sm text-[#3f3a2f]">
                        <input
                          type="checkbox"
                          checked={!form.allBranches && (form.branchIds.length > 0 ? form.branchIds : [form.branchId]).includes(String(branch.id))}
                          onChange={(e) => {
                            const branchId = String(branch.id);
                            setForm((current) => {
                              if (canUseMultipleBranches) {
                                const nextBranchIds = e.target.checked
                                  ? Array.from(new Set([...current.branchIds, branchId]))
                                  : current.branchIds.filter((value) => value !== branchId);

                                return {
                                  ...current,
                                  allBranches: false,
                                  branchId: nextBranchIds[0] || "",
                                  branchIds: nextBranchIds,
                                };
                              }

                              return {
                                ...current,
                                allBranches: false,
                                branchId: e.target.checked ? branchId : "",
                                branchIds: e.target.checked ? [branchId] : [],
                              };
                            });
                          }}
                          className="rounded"
                        />
                        <span>{branch.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </Field>

              <Field label="Address" className="sm:col-span-2 lg:col-span-3">
                <textarea
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  rows={2}
                  className={`${fieldClassName} min-h-[96px] resize-none`}
                />
              </Field>
              </Section>

              <Section title="Emergency Contacts" description="Primary person to reach and related contact details.">
              <Field label="Emergency Contact Name">
                <input
                  value={form.emergencyContactName}
                  onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })}
                  className={fieldClassName}
                />
              </Field>

              <Field label="Emergency Contact Phone">
                <input
                  type="tel"
                  value={form.emergencyContactPhone}
                  onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })}
                  className={fieldClassName}
                />
              </Field>

              <Field label="Emergency Contact Email">
                <input
                  type="email"
                  value={form.emergencyContactEmail}
                  onChange={(e) => setForm({ ...form, emergencyContactEmail: e.target.value })}
                  className={fieldClassName}
                />
              </Field>
              </Section>

              <Section title="Employment Details" description="Dates, compensation, and annual leave tracking.">
              <Field label="Start Date">
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className={fieldClassName}
                />
              </Field>

              <Field label="End Date">
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  disabled={form.status === "active"}
                  className={`${fieldClassName} ${form.status === "active" ? "cursor-not-allowed opacity-60" : ""}`}
                />
                <p className="mt-1 text-xs text-[#8b8372]">
                  {form.status === "inactive"
                    ? "Optional: set the date this staff member stopped working."
                    : "Available only when staff status is inactive."}
                </p>
              </Field>

              <Field label="Status">
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      status: e.target.value,
                      endDate: e.target.value === "active" ? "" : current.endDate,
                    }))
                  }
                  className={fieldClassName}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </Field>

              <Field label="Salary">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.salary}
                  onChange={(e) => setForm({ ...form, salary: e.target.value })}
                  className={fieldClassName}
                />
              </Field>

              <Field label="Commission Rate ($)">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.commissionRate}
                  onChange={(e) => setForm({ ...form, commissionRate: e.target.value })}
                  className={fieldClassName}
                />
              </Field>

              <Field label="Bonus">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.bonus}
                  onChange={(e) => setForm({ ...form, bonus: e.target.value })}
                  className={fieldClassName}
                />
              </Field>

              <Field label="Vacation Days Allowed">
                <input
                  type="number"
                  min="0"
                  value={form.vacationDaysAllowed}
                  onChange={(e) => setForm({ ...form, vacationDaysAllowed: e.target.value })}
                  className={fieldClassName}
                />
              </Field>

              <Field label="Vacation Days Taken">
                <input
                  type="number"
                  min="0"
                  value={form.vacationDaysTaken}
                  onChange={(e) => setForm({ ...form, vacationDaysTaken: e.target.value })}
                  className={fieldClassName}
                />
              </Field>

              <Field label="Vacation Balance">
                <div className="rounded-xl border border-[#e1d7bf] bg-[#f1ece0] px-3.5 py-3 text-sm font-medium text-[#3d392f]">
                  {leaveBalance}
                </div>
              </Field>
              </Section>

              <Section title="Compliance & Files" description="Upload staff media, certifications, documents, and legal records.">
              <Field label="Picture">
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp,.gif,.pdf,.doc,.docx"
                  onChange={(e) => setForm({ ...form, picture: e.target.files?.[0] || null })}
                  className={fileClassName}
                />
                {editing?.pictureUrl ? (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => void openProtectedFile(editing.pictureUrl)}
                      className="inline-flex rounded-md border border-[#d8cfbc] bg-white px-2 py-1 text-[11px] font-medium text-[#5a523f] transition hover:bg-[#f7f2e7]"
                    >
                      Open document
                    </button>
                  </div>
                ) : null}
              </Field>

              <Field label="Certification Expiry Date">
                <input
                  type="date"
                  value={form.certificationExpiryDate}
                  onChange={(e) => setForm({ ...form, certificationExpiryDate: e.target.value })}
                  className={fieldClassName}
                />
              </Field>

              <Field label="Certifications">
                <input
                  type="file"
                  multiple
                  accept=".png,.jpg,.jpeg,.webp,.gif,.pdf,.doc,.docx"
                  onChange={updateFileList("certificationFiles")}
                  className={fileClassName}
                />
                {existingFilesList(editing?.certificationFiles)}
              </Field>

              <Field label="Documents">
                <input
                  type="file"
                  multiple
                  accept=".png,.jpg,.jpeg,.webp,.gif,.pdf,.doc,.docx"
                  onChange={updateFileList("documentFiles")}
                  className={fileClassName}
                />
                {existingFilesList(editing?.documentFiles)}
              </Field>

              <Field label="Legal Documents">
                <input
                  type="file"
                  multiple
                  accept=".png,.jpg,.jpeg,.webp,.gif,.pdf,.doc,.docx"
                  onChange={updateFileList("legalFiles")}
                  className={fileClassName}
                />
                {existingFilesList(editing?.legalFiles)}
              </Field>
              </Section>

              <Section title="Profile Summary" description="Short biography or notes about the employee.">
              <Field label="Bio" className="sm:col-span-2 lg:col-span-3">
                <textarea
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  rows={4}
                  className={`${fieldClassName} min-h-[140px] resize-none`}
                />
              </Field>
              </Section>

              <div className="flex gap-3 border-t border-[#ebe2cf] pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 rounded-xl border border-[#d7cfbe] bg-white px-4 py-3 text-sm font-medium text-[#4d473c] transition hover:bg-[#f7f2e7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-primary/90 disabled:opacity-50"
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

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-sm font-medium text-[#4f5665]">{label}</label>
      {children}
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-[#e8deca] bg-white p-5 shadow-[0_10px_30px_rgba(67,54,26,0.05)]">
      <div className="mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[#8a7b54]">{title}</h3>
        <p className="mt-1 text-sm text-[#6f695c]">{description}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}
