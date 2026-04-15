import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { nationalityOptions } from "@/lib/nationalities";
import { getPasswordChecks, isStrongPassword } from "@/lib/password";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Edit2, Loader2, X, Calendar } from "lucide-react";

const emptyForm = {
  createFor: "member",
  membershipType: "membership",
  name: "",
  firstName: "",
  middleName: "",
  lastName: "",
  email: "",
  phone: "",
  password: "",
  packageId: "",
  classId: "",
  packageIds: [] as string[],
  classIds: [] as string[],
  branchId: "",
  gender: "",
  birthDate: "",
  joinDate: new Date().toISOString().split("T")[0],
  membershipEndDate: "",
  autoCalculateEndDate: true,
  uniqueId: "",
  nationality: "",
  status: "active",
  emergencyContactName: "",
  emergencyContactPhone: "",
  isFrozen: false,
  freezeStartDate: "",
  freezeEndDate: "",
  freezeNotes: "",
  notes: "",
  height: "",
  weight: "",
  fitnessGoal: "",
  trainerStartDate: new Date().toISOString().split("T")[0],
  trainerEndDate: "",
};

const normalizeClassTitle = (value: string) => value.trim().toLowerCase();

const formatClassPrice = (gymClass: any) => {
  const amount = Number(gymClass?.price ?? 0);
  const suffix = gymClass?.priceType === "monthly" ? "/ month" : "/ class";

  if (!Number.isFinite(amount) || amount <= 0) {
    return gymClass?.priceType === "monthly" ? "Monthly price not set" : "Class price not set";
  }

  return `$${amount.toFixed(2)} ${suffix}`;
};

const getMonthlyCycleEndDate = (startDate: string) => {
  const date = new Date(startDate);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  date.setMonth(date.getMonth() + 1);
  date.setDate(date.getDate() - 1);
  return date.toISOString().split("T")[0];
};

const isDateInMonthlyCycle = (dateValue: string, cycleStart: string, cycleEnd: string) => {
  if (!dateValue || !cycleStart || !cycleEnd) {
    return false;
  }

  const target = new Date(`${dateValue}T00:00:00`);
  const start = new Date(`${cycleStart}T00:00:00`);
  const end = new Date(`${cycleEnd}T00:00:00`);

  if (Number.isNaN(target.getTime()) || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return false;
  }

  return target >= start && target <= end;
};

const formatDateForDisplay = (value?: string) => {
  if (!value) {
    return "";
  }

  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return String(value);
  }

  const [, year, month, day] = match;
  return `${day}-${month}-${year}`;
};

export default function Members() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [phoneSearch, setPhoneSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const dateInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const { data: members = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/members"] });
  const { data: coaches = [] } = useQuery<any[]>({ queryKey: ["/api/coaches"] });
  const { data: leads = [] } = useQuery<any[]>({ queryKey: ["/api/leads"] });
  const { data: users = [] } = useQuery<any[]>({ queryKey: ["/api/users"] });
  const { data: branches = [] } = useQuery<any[]>({ queryKey: ["/api/branches"] });
  const { data: packages = [] } = useQuery<any[]>({ queryKey: ["/api/packages"] });
  const { data: classes = [] } = useQuery<any[]>({ queryKey: ["/api/classes"] });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const createdMember = await apiRequest("POST", "/api/members", data).then((r) => r.json());

      const bookingWarnings: string[] = [];

      const extraPackageIds = (data.packageIds || []).filter((id: number) => id && id !== data.packageId);
      for (const packageId of extraPackageIds) {
        const selectedPackage = normalizedPackages.find((pkg: any) => Number(pkg.id) === Number(packageId));
        if (!selectedPackage) {
          continue;
        }

        const startDate = data.joinDate || new Date().toISOString().split("T")[0];
        const durationDays = Math.max(Number(selectedPackage.durationDays || 0) - 1, 0);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + durationDays);

        try {
          await apiRequest("POST", "/api/subscriptions", {
            memberId: createdMember.id,
            packageId,
            startDate,
            endDate: endDate.toISOString().split("T")[0],
            remainingClasses: selectedPackage.totalClasses ?? null,
            ptSessionsTotal: selectedPackage.includedPtSessions ?? 0,
            ptSessionsUsed: 0,
            isFrozen: Boolean(data.isFrozen),
            freezeStartDate: data.freezeStartDate || null,
            freezeEndDate: data.freezeEndDate || null,
            status: data.isFrozen ? "frozen" : "active",
          });
        } catch (error: any) {
          bookingWarnings.push(error?.message || `Extra package ${selectedPackage.name} could not be added.`);
        }
      }

      for (const classId of data.classIds || []) {
        try {
          await apiRequest("POST", "/api/bookings", {
            classId,
            memberId: createdMember.id,
            bookingType: "extra_payment",
          });
        } catch (error: any) {
          bookingWarnings.push(error?.message || `Class booking ${classId} could not be completed.`);
        }
      }

      return {
        ...createdMember,
        bookingWarning: bookingWarnings.length ? bookingWarnings.join(" ") : undefined,
      };
    },
    onSuccess: (created: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      closeModal();
      toast({
        title: "Member created",
        description: created?.bookingWarning || undefined,
      });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message || "Failed to create member", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => apiRequest("PUT", `/api/members/${id}`, data).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      closeModal();
      toast({ title: "Member updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message || "Failed to update member", variant: "destructive" }),
  });

  const createCoachMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/coaches", data).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coaches"] });
      closeModal();
      toast({ title: "Trainer created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message || "Failed to create trainer", variant: "destructive" }),
  });

  const createDietitianMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/users", data).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      closeModal();
      toast({ title: "Dietitian created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message || "Failed to create dietitian", variant: "destructive" }),
  });

  const createLeadMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/leads", data).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      closeModal();
      toast({ title: "Lead created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message || "Failed to create lead", variant: "destructive" }),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (member: any) => {
    setEditing(member);
    setForm({
      createFor: "member",
      membershipType: "membership",
      name: member.userName || "",
      firstName: member.firstName || "",
      middleName: member.middleName || "",
      lastName: member.lastName || "",
      email: member.userEmail || "",
      phone: member.userPhone || "",
      password: "",
      packageId: member.primaryPackageId || "",
      classId: "",
      packageIds: member.primaryPackageId ? [String(member.primaryPackageId)] : [],
      classIds: [],
      branchId: member.branchId || "",
      gender: member.gender || "",
      birthDate: member.birthDate || "",
      joinDate: member.joinDate || "",
      membershipEndDate: member.membershipEndDate || "",
      autoCalculateEndDate: false,
      uniqueId: member.uniqueId || "",
      nationality: member.nationality || "",
      status: member.status || "active",
      emergencyContactName: member.emergencyContactName || "",
      emergencyContactPhone: member.emergencyContactPhone || "",
      isFrozen: Boolean(member.isFrozen),
      freezeStartDate: member.freezeStartDate || "",
      freezeEndDate: member.freezeEndDate || "",
      freezeNotes: member.freezeNotes || "",
      notes: member.notes || "",
      height: member.height || "",
      weight: member.weight || "",
      fitnessGoal: member.fitnessGoal || "",
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const passwordChecks = getPasswordChecks(form.password || "");

  const createForOptions = [
    { value: "member", label: "Member" },
    { value: "coach", label: "Personal Trainer" },
    { value: "lead", label: "Lead" },
    { value: "dietitian", label: "Dietitian" },
  ];

  const selectedCreateFor = createForOptions.find((option) => option.value === form.createFor) ?? createForOptions[0];
  const composedName = [form.firstName, form.middleName, form.lastName].filter(Boolean).join(" ").trim() || form.name;
  const activeRole = editing ? "member" : form.createFor;
  const behavesLikeMember = activeRole === "member" || activeRole === "coach";
  const showsMemberExtras = activeRole === "member";
  const supportsServiceSelection = activeRole === "member" || activeRole === "coach";
  const showsFreezeFields = activeRole === "member" || activeRole === "coach" || activeRole === "lead" || activeRole === "dietitian";
  const passwordDefaultLabel =
    activeRole === "coach"
      ? "Member@2024"
      : activeRole === "lead"
        ? ""
        : activeRole === "dietitian"
          ? "GymCRM@2024"
          : "Member@2024";
  const modalTitle = editing ? "Edit Member" : `Add ${selectedCreateFor.label}`;
  const normalizedPackages = (packages as any[]).map((pkg: any) => ({
    ...pkg,
    packageType: pkg.packageType ?? pkg.package_type ?? "membership",
    includedPtSessions: pkg.includedPtSessions ?? pkg.included_pt_sessions ?? 0,
    coachHours: pkg.coachHours ?? pkg.coach_hours ?? 0,
    durationDays: pkg.durationDays ?? pkg.duration_days ?? 0,
    includesClasses: pkg.includesClasses ?? pkg.includes_classes ?? false,
  }));
  const availablePackages = normalizedPackages.filter((pkg: any) => pkg.status === "active");
  const classCycleStartDate = form.joinDate || new Date().toISOString().split("T")[0];
  const classCycleEndDate = getMonthlyCycleEndDate(classCycleStartDate);
  const availableClassTypes = (classes as any[])
    .filter((gymClass: any) => {
      if (gymClass.status !== "scheduled") {
        return false;
      }

      if (!form.branchId) {
        return true;
      }

      return String(gymClass.branchId) === String(form.branchId) || gymClass.branchId == null;
    })
    .reduce((carry: any[], gymClass: any) => {
      const title = String(gymClass.title || "").trim();
      if (!title) {
        return carry;
      }

      const key = normalizeClassTitle(title);
      const existing = carry.find((item: any) => item.key === key);
      const isInMonthlyCycle = isDateInMonthlyCycle(String(gymClass.classDate || ""), classCycleStartDate, classCycleEndDate);

      if (existing) {
        if (isInMonthlyCycle) {
          existing.sessionCount += 1;
        }

        if (!existing.description && gymClass.description) {
          existing.description = gymClass.description;
        }

        if ((!existing.price || Number(existing.price) === 0) && Number(gymClass.price) > 0) {
          existing.price = gymClass.price;
          existing.priceType = gymClass.priceType || "per_class";
        }

        return carry;
      }

      carry.push({
        key,
        id: gymClass.id,
        title,
        description: gymClass.description || "",
        price: gymClass.price,
        priceType: gymClass.priceType || "per_class",
        sessionCount: isInMonthlyCycle ? 1 : 0,
      });

      return carry;
    }, [])
    .sort((a: any, b: any) => a.title.localeCompare(b.title));
  const selectedPrimaryPackage = availablePackages.find((pkg: any) => String(pkg.id) === String((form.packageIds || [])[0] || form.packageId));
  const selectedPrimaryClassType = availableClassTypes.find((gymClass: any) => String(gymClass.id) === String((form.classIds || [])[0] || form.classId));
  const selectedPackages = availablePackages.filter((pkg: any) => (form.packageIds || []).includes(String(pkg.id)));
  const selectedClassTypes = availableClassTypes.filter((gymClass: any) => (form.classIds || []).includes(String(gymClass.id)));
  const nextUniqueId = (() => {
    const allUniqueIdRecords = [
      ...(members as any[]),
      ...(coaches as any[]),
      ...(leads as any[]),
      ...(users as any[]),
    ];

    const maxId = allUniqueIdRecords.reduce((carry: number, item: any) => {
      const value = String(item?.uniqueId || item?.unique_id || "");
      const match = value.match(/^SLR-(\d{1,})$/i);
      return match ? Math.max(carry, Number(match[1])) : carry;
    }, 0);

    return `SLR-${String(maxId + 1).padStart(4, "0")}`;
  })();

  useEffect(() => {
    if (editing || !behavesLikeMember || !form.autoCalculateEndDate) {
      return;
    }

    const startDate = form.joinDate;
    const selectedPackage = normalizedPackages.find((pkg: any) => String(pkg.id) === String(form.packageId));
    const selectedClassType = availableClassTypes.find((gymClass: any) => String(gymClass.id) === String(form.classId));
    const durationDays = Number(selectedPackage?.durationDays ?? 0);

    if (!startDate) {
      if (form.membershipEndDate) {
        setForm((current: any) => ({
          ...current,
          membershipEndDate: "",
        }));
      }
      return;
    }

    let computedEndDate = "";
    if (selectedPackage && durationDays) {
      const date = new Date(startDate);
      if (Number.isNaN(date.getTime())) {
        return;
      }

      date.setDate(date.getDate() + Math.max(durationDays - 1, 0));
      computedEndDate = date.toISOString().split("T")[0];
    } else if (selectedClassType) {
      computedEndDate = getMonthlyCycleEndDate(startDate);
    }

    if (computedEndDate !== form.membershipEndDate) {
      setForm((current: any) => ({
        ...current,
        membershipEndDate: computedEndDate,
      }));
    }
  }, [
    behavesLikeMember,
    editing,
    form.autoCalculateEndDate,
    form.classId,
    form.classIds,
    form.joinDate,
    form.membershipEndDate,
    form.packageId,
    availableClassTypes,
    normalizedPackages,
  ]);

  useEffect(() => {
    const selectedPackageId = (form.packageIds || [])[0] || form.packageId;
    if (!selectedPackageId) {
      if ((form.classIds || []).length > 0 && form.membershipType !== "classes") {
        setForm((current: any) => ({
          ...current,
          membershipType: "classes",
        }));
      }
      return;
    }

    const selectedPackage = availablePackages.find((pkg: any) => String(pkg.id) === String(selectedPackageId));
    if (!selectedPackage) {
      return;
    }

    const nextMembershipType = selectedPackage.includesClasses ? "classes" : selectedPackage.packageType || "membership";
    if (nextMembershipType !== form.membershipType) {
      setForm((current: any) => ({
        ...current,
        membershipType: nextMembershipType,
      }));
    }
  }, [availablePackages, form.membershipType, form.packageId, form.packageIds]);

  useEffect(() => {
    if (editing) {
      return;
    }

    if (form.uniqueId !== nextUniqueId) {
      setForm((current: any) => ({
        ...current,
        uniqueId: nextUniqueId,
      }));
    }
  }, [editing, form.uniqueId, nextUniqueId]);

  useEffect(() => {
    if (!supportsServiceSelection) {
      return;
    }

    const primaryPackageId = (form.packageIds || [])[0] || "";
    const primaryClassId = (form.classIds || [])[0] || "";

    if (primaryPackageId !== (form.packageId || "") || primaryClassId !== (form.classId || "")) {
      setForm((current: any) => ({
        ...current,
        packageId: primaryPackageId,
        classId: primaryClassId,
      }));
    }
  }, [form.classId, form.classIds, form.packageId, form.packageIds, supportsServiceSelection]);

  useEffect(() => {
    if (!supportsServiceSelection) {
      return;
    }

    const visibleIds = new Set(availableClassTypes.map((gymClass: any) => String(gymClass.id)));
    const currentIds = (form.classIds || []).map((id: string) => String(id));
    const nextIds = currentIds.filter((id: string) => visibleIds.has(id));

    if (nextIds.length !== currentIds.length) {
      setForm((current: any) => ({
        ...current,
        classIds: (current.classIds || []).filter((id: string) => visibleIds.has(String(id))),
      }));
    }
  }, [availableClassTypes, form.classIds, supportsServiceSelection]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!editing && activeRole !== "lead" && !isStrongPassword(form.password || passwordDefaultLabel)) {
      toast({
        title: "Weak password",
        description: "Password must include one capital letter, one number, and one special character.",
        variant: "destructive",
      });
      return;
    }

    if (supportsServiceSelection && (form.packageIds || []).length === 0 && (form.classIds || []).length === 0) {
      toast({
        title: "Selection required",
        description: "Select at least one package or one class.",
        variant: "destructive",
      });
      return;
    }

    if (!form.branchId) {
      toast({
        title: "Branch required",
        description: `${selectedCreateFor.label} must be assigned to a branch.`,
        variant: "destructive",
      });
      return;
    }

    const data = {
      ...form,
      status: form.isFrozen ? "frozen" : form.status === "frozen" ? "active" : form.status,
      serviceType:
        (form.classIds || []).length > 0 && (form.packageIds || []).length === 0
          ? "class"
          : normalizedPackages.find((pkg: any) => String(pkg.id) === String((form.packageIds || [])[0] || form.packageId))?.packageType === "personal_training"
            ? "personal_training"
            : "package",
      name: composedName,
      branchId: parseInt(form.branchId, 10) || 1,
      primaryPackageId: (form.packageIds || [])[0] ? parseInt((form.packageIds || [])[0], 10) : form.packageId ? parseInt(form.packageId, 10) : undefined,
      packageId: (form.packageIds || [])[0] ? parseInt((form.packageIds || [])[0], 10) : form.packageId ? parseInt(form.packageId, 10) : undefined,
      packageIds: (form.packageIds || []).map((id: string) => parseInt(id, 10)).filter(Boolean),
      classId: (form.classIds || [])[0] ? parseInt((form.classIds || [])[0], 10) : form.classId ? parseInt(form.classId, 10) : undefined,
      classIds: (form.classIds || []).map((id: string) => parseInt(id, 10)).filter(Boolean),
      isFrozen: Boolean(form.isFrozen),
      height: form.height ? parseFloat(form.height) : null,
      weight: form.weight ? parseFloat(form.weight) : null,
    };

    if (editing) {
      updateMutation.mutate({ id: editing.id, data });
      return;
    }

    if (activeRole === "coach") {
      createMutation.mutate({
        ...data,
        joinDate: form.joinDate || new Date().toISOString().split("T")[0],
        membershipEndDate: form.membershipEndDate || undefined,
        notes: [form.notes, "Personal trainer member"]
          .filter(Boolean)
          .join("\n"),
      });
      return;
    }

    if (activeRole === "dietitian") {
      createDietitianMutation.mutate({
        name: composedName,
        firstName: form.firstName || null,
        middleName: form.middleName || null,
        lastName: form.lastName || null,
        email: form.email,
        phone: form.phone || null,
        password: form.password || undefined,
        role: "dietitian",
        branchId: data.branchId,
        uniqueId: form.uniqueId || null,
        birthDate: form.birthDate || null,
        gender: form.gender || null,
        nationality: form.nationality || null,
        emergencyContactName: form.emergencyContactName || null,
        emergencyContactPhone: form.emergencyContactPhone || null,
        isFrozen: Boolean(form.isFrozen),
        freezeStartDate: form.freezeStartDate || null,
        freezeEndDate: form.freezeEndDate || null,
        freezeNotes: form.freezeNotes || null,
        status: form.status === "active" ? "active" : "inactive",
      });
      return;
    }

    if (activeRole === "lead") {
      const selectedServiceLabel = form.classId
        ? availableClassTypes.find((gymClass: any) => String(gymClass.id) === String(form.classId))?.title
        : availablePackages.find((pkg: any) => String(pkg.id) === String(form.packageId))?.name;

      createLeadMutation.mutate({
        name: composedName,
        firstName: form.firstName || null,
        middleName: form.middleName || null,
        lastName: form.lastName || null,
        branchId: data.branchId,
        phone: form.phone || null,
        email: form.email || null,
        uniqueId: form.uniqueId || null,
        birthDate: form.birthDate || null,
        gender: form.gender || null,
        nationality: form.nationality || null,
        emergencyContactName: form.emergencyContactName || null,
        emergencyContactPhone: form.emergencyContactPhone || null,
        isFrozen: Boolean(form.isFrozen),
        freezeStartDate: form.freezeStartDate || null,
        freezeEndDate: form.freezeEndDate || null,
        freezeNotes: form.freezeNotes || null,
        status: form.status === "active" ? "new" : "contacted",
        source: "other",
        notes:
          form.classId || form.packageId
            ? [form.notes, `Interested in: ${form.classId ? "Class" : "Package"}${selectedServiceLabel ? ` - ${selectedServiceLabel}` : ""}`]
                .filter(Boolean)
                .join("\n")
            : form.notes || null,
      });
      return;
    }

      createMutation.mutate(data);
  };

  const renderInput = (key: string, label: string, type = "text", placeholder = "") => (
    <div key={key}>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">{label}</label>
      <input
        type={type}
        value={form[key]}
        placeholder={placeholder}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
    </div>
  );

  const renderDateInput = (key: string, label: string, disabled = false) => (
    <div key={key}>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">{label}</label>
      <div className="relative">
        <input
          type="text"
          value={formatDateForDisplay(form[key])}
          placeholder="DD-MM-YYYY"
          readOnly
          disabled={disabled}
          onClick={() => {
            if (disabled) {
              return;
            }

            const input = dateInputRefs.current[key];
            if (input?.showPicker) {
              input.showPicker();
            } else {
              input?.click();
            }
          }}
          className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 pr-10 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:bg-gray-100 disabled:text-gray-500"
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            const input = dateInputRefs.current[key];
            if (input?.showPicker) {
              input.showPicker();
            } else {
              input?.click();
            }
          }}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 disabled:cursor-not-allowed disabled:text-gray-400"
        >
          <Calendar className="h-4 w-4" />
        </button>
        <input
          ref={(element) => {
            dateInputRefs.current[key] = element;
          }}
          type="date"
          tabIndex={-1}
          value={form[key] || ""}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          disabled={disabled}
          className="pointer-events-none absolute inset-0 opacity-0"
          aria-hidden="true"
        />
      </div>
    </div>
  );

  const formatServiceDateRange = (start?: string, end?: string) => {
    if (start && end) {
      return `${formatDateForDisplay(start)} to ${formatDateForDisplay(end)}`;
    }

    if (start) {
      return `${formatDateForDisplay(start)} to -`;
    }

    return end ? formatDateForDisplay(end) : "-";
  };

  const formatClassCreditSummary = (credits: Record<string, number> | null | undefined) => {
    if (!credits || typeof credits !== "object") {
      return [];
    }

    return Object.entries(credits)
      .filter(([, count]) => Number(count) > 0)
      .sort(([left], [right]) => left.localeCompare(right));
  };

  const filtered = members.filter((member) => {
    const matchesGeneralSearch =
      !search.trim() ||
      [member.userName, member.userEmail, member.membershipNumber, member.uniqueId]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search.toLowerCase()));

    const matchesPhoneSearch =
      !phoneSearch.trim() ||
      String(member.userPhone || "")
        .toLowerCase()
        .includes(phoneSearch.toLowerCase());

    return matchesGeneralSearch && matchesPhoneSearch;
  });

  const isPending =
    createMutation.isPending ||
    updateMutation.isPending ||
    createCoachMutation.isPending ||
    createDietitianMutation.isPending ||
    createLeadMutation.isPending;

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Members</h1>
          <p className="mt-1 text-sm text-gray-500">{members.length} total members</p>
        </div>
        <button
          onClick={openCreate}
          data-testid="button-add-member"
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 sm:w-auto"
        >
          <Plus className="h-4 w-4" /> Add Member
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
                placeholder="Search members..."
                className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <input
              value={phoneSearch}
              onChange={(e) => setPhoneSearch(e.target.value)}
              placeholder="Search by phone number..."
              className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
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
                  {["Member", "Membership", "PT / Attendance", "Status", "Actions"].map((header) => (
                    <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                      No members found
                    </td>
                  </tr>
                ) : (
                  filtered.map((member) => (
                    <tr key={member.id} data-testid={`member-row-${member.id}`} className="transition-colors hover:bg-gray-50">
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-gray-900">{member.userName}</div>
                        <div className="text-xs text-gray-500">{member.userEmail}</div>
                        <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-gray-500">
                          {member.uniqueId && <span>{member.uniqueId}</span>}
                          {member.age !== null && member.age !== undefined && <span>Age: {member.age}</span>}
                          {member.nationality && <span>{member.nationality}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-gray-600">
                        {member.primaryPackageName ? (
                          <div>
                            <div className="font-medium text-gray-800">Package: {member.primaryPackageName}</div>
                            <div className="text-xs text-gray-400">
                              {formatServiceDateRange(member.membershipStartDate || member.joinDate, member.membershipEndDate)}
                            </div>
                          </div>
                        ) : (
                          <div className="text-gray-400">No package</div>
                        )}
                        {member.classTitles ? (
                          <div className="mt-1">
                            <div className="font-medium text-gray-800">Classes: {member.classTitles}</div>
                            <div className="text-xs text-gray-400">
                              {formatServiceDateRange(member.joinDate, member.classMembershipEndDate)}
                            </div>
                          </div>
                        ) : (
                          <div className="mt-1 text-xs text-gray-400">No classes</div>
                        )}
                        <div className="text-xs text-gray-400">{member.branchName || "-"}</div>
                      </td>
                      <td className="px-4 py-3.5 text-gray-600">
                        <div className="text-xs">PT remaining: {member.ptSessionsRemaining ?? 0}</div>
                        {formatClassCreditSummary(member.remainingClassCredits).map(([title, count]) => (
                          <div key={`${member.id}-${title}`} className="text-xs">
                            {title}: {count} credits
                          </div>
                        ))}
                        <div className="text-xs">Attendance total: {member.attendanceCount ?? 0}</div>
                        <div className="text-xs">Today: {member.attendanceToday ?? 0}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        {(() => {
                          const displayStatus = member.isFrozen ? "frozen" : member.status;
                          return (
                        <div className="flex flex-col gap-1">
                          <span
                            className={`inline-flex w-fit rounded-full px-2 py-0.5 text-xs font-medium ${
                              displayStatus === "active"
                                ? "bg-green-100 text-green-700"
                                : displayStatus === "expired"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {displayStatus}
                          </span>
                        </div>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEdit(member)}
                            data-testid={`button-edit-member-${member.id}`}
                            className="rounded p-1.5 text-gray-400 transition-colors hover:bg-primary/10 hover:text-primary"
                          >
                            <Edit2 className="h-4 w-4" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-white shadow-xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-border bg-white p-5">
              <h2 className="font-semibold text-gray-900">{modalTitle}</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 sm:col-span-2 lg:col-span-3">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:items-end">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-700">Membership Type</label>
                        <select
                          value={form.createFor}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              createFor: e.target.value,
                              autoCalculateEndDate: true,
                            })
                          }
                          disabled={Boolean(editing)}
                          className="w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        >
                          {createForOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {form.createFor !== "member" && (
                      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                        {form.createFor === "coach"
                          ? (
                            <>
                              This popup creates <span className="font-semibold">Personal Trainer</span> as a member profile with packages and classes.
                            </>
                          )
                          : (
                            <>
                              This popup now creates <span className="font-semibold">{selectedCreateFor.label}</span> directly with personal details.
                            </>
                          )}
                      </div>
                    )}
                  </div>

                <>
                  <>
                    {renderInput("firstName", showsMemberExtras ? "First Name" : "Name", "text", "John")}
                    {renderInput("middleName", "Middle Name", "text", "Michael")}
                    {renderInput("lastName", "Last Name", "text", "Doe")}
                    {renderInput("email", "Email", "email", "john@example.com")}
                    {renderInput("phone", "Mobile Number", "tel", "+961...")}
                    {activeRole !== "lead" && (
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-700">Password (default: {passwordDefaultLabel})</label>
                        <input
                          type="password"
                          value={form.password}
                          placeholder="Leave blank for default"
                          onChange={(e) => setForm({ ...form, password: e.target.value })}
                          className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                        <div className="mt-2 space-y-1 text-xs">
                          <div className={passwordChecks.hasUppercase || !form.password ? "text-green-600" : "text-gray-500"}>One capital letter</div>
                          <div className={passwordChecks.hasDigit || !form.password ? "text-green-600" : "text-gray-500"}>One digit</div>
                          <div className={passwordChecks.hasSpecial || !form.password ? "text-green-600" : "text-gray-500"}>One special character</div>
                        </div>
                      </div>
                    )}
                  </>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Gender</label>
                  <select
                    value={form.gender}
                    onChange={(e) => setForm({ ...form, gender: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>

                {renderDateInput("birthDate", "Birth Date (Age auto)")}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Nationality</label>
                  <select
                    value={form.nationality}
                    onChange={(e) => setForm({ ...form, nationality: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">Select nationality</option>
                    {nationalityOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.flag} {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                {behavesLikeMember && renderDateInput("joinDate", activeRole === "coach" ? "Package Start" : "Membership Start")}
                {behavesLikeMember && (
                  <div>
                    {renderDateInput("membershipEndDate", activeRole === "coach" ? "Package End" : "Membership End", form.autoCalculateEndDate)}
                    <label className="mt-2 flex items-center gap-2 text-xs text-gray-600">
                      <input
                        type="checkbox"
                        checked={form.autoCalculateEndDate}
                        onChange={(e) => setForm({ ...form, autoCalculateEndDate: e.target.checked })}
                        className="rounded"
                      />
                      Auto-calculate from selected package or monthly class
                    </label>
                  </div>
                )}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Unique ID</label>
                  <input
                    type="text"
                    value={form.uniqueId}
                    readOnly
                    className="w-full rounded-lg border border-gray-200 bg-gray-100 px-3.5 py-2.5 text-sm text-gray-500 focus:outline-none"
                  />
                </div>

                {renderInput("emergencyContactName", "Emergency Contact Name", "text")}
                {renderInput("emergencyContactPhone", "Emergency Contact Phone", "tel")}
                {showsMemberExtras && renderInput("fitnessGoal", "Fitness Goal", "text", "Weight loss / muscle gain")}

                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 sm:col-span-2 lg:col-span-3">
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-700">Branch</label>
                        <select
                          value={form.branchId}
                          onChange={(e) => setForm({ ...form, branchId: e.target.value })}
                          className="w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                          required
                        >
                          <option value="">Select branch</option>
                          {(branches as any[]).map((branch: any) => (
                            <option key={branch.id} value={branch.id}>
                              {branch.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-700">Status</label>
                        <select
                          value={form.status}
                          onChange={(e) => setForm({ ...form, status: e.target.value })}
                          className="w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        >
                          <option value="active">Active</option>
                          {showsMemberExtras && <option value="expired">Expired</option>}
                          {showsMemberExtras && <option value="frozen">Frozen</option>}
                          {!showsMemberExtras && <option value="inactive">Inactive</option>}
                          {activeRole === "lead" && <option value="contacted">Contacted</option>}
                        </select>
                      </div>
                    </div>

                    {supportsServiceSelection && (
                      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-700">Packages</label>
                        <div className="mb-2 text-xs text-gray-500">You can select more than one package.</div>
                        <div className="min-h-[180px] max-h-[220px] space-y-2 overflow-y-auto rounded-lg border border-gray-200 bg-white p-3">
                          {availablePackages.map((pkg: any) => (
                            <label key={pkg.id} className="flex items-start gap-3 rounded-lg border border-transparent px-2 py-2 text-sm text-gray-700 hover:border-gray-100 hover:bg-gray-50">
                              <input
                                type="checkbox"
                                checked={(form.packageIds || []).includes(String(pkg.id))}
                                onChange={(e) =>
                                  setForm((current: any) => ({
                                    ...current,
                                    packageIds: e.target.checked
                                      ? [...(current.packageIds || []), String(pkg.id)]
                                      : (current.packageIds || []).filter((id: string) => id !== String(pkg.id)),
                                  }))
                                }
                                className="mt-0.5 rounded"
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block font-medium text-gray-900">
                                  {pkg.name}{" "}
                                  {pkg.packageType === "personal_training"
                                  ? "• Personal Training"
                                  : pkg.packageType === "hybrid"
                                    ? "• Hybrid"
                                    : pkg.includesClasses
                                      ? "• Membership + Class"
                                      : "• Membership"}
                              </span>
                              <span className="min-w-0">
                                <span className="block text-xs text-primary">${Number(pkg.price || 0).toFixed(2)}</span>
                                {pkg.description && (
                                  <span className="mt-1 block text-xs text-gray-500">{pkg.description}</span>
                                )}
                                <span className="mt-1 block text-xs text-gray-500">
                                  {String(pkg.billingCycle || "1_month").replace(/_/g, " ")} • {Number(pkg.durationDays || 0)} days
                                </span>
                                <span className="mt-2 block text-xs text-gray-600">
                                  Gym access: {pkg.includesGymAccess ? "Included" : "Not included"}
                                </span>
                                <span className="block text-xs text-gray-600">
                                  Classes: {pkg.includesClasses ? `${Number(pkg.totalClasses || 0)} credits` : "Not included"}
                                </span>
                                <span className="block text-xs text-gray-600">
                                  PT sessions: {Number(pkg.includedPtSessions || 0)}
                                </span>
                                <span className="block text-xs text-gray-600">
                                  Coach hours: {Number(pkg.coachHours || 0)}
                                </span>
                                <span className="block text-xs text-gray-600">
                                  Dietitian hours: {Number(pkg.dietitianHours || 0)}
                                </span>
                                <span className="block text-xs text-gray-600">
                                  Freeze: {pkg.allowsFreeze ? `${Number(pkg.freezeDaysAllowed || 0)} days allowed` : "Not allowed"}
                                </span>
                                <span className="block text-xs text-gray-600">
                                  Branch access: {pkg.allowsAllBranches ? "All branches" : "Single branch"}
                                </span>
                                <span className="block text-xs text-gray-600">
                                  Renewal: {pkg.autoRenew ? "Auto renew" : "Manual renew"}
                                </span>
                              </span>
                              </span>
                            </label>
                          ))}
                        </div>
                        {selectedPackages.length > 0 && (
                          <div className="mt-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600">
                            <div className="mb-1 font-medium text-gray-800">Selected packages</div>
                            {selectedPackages.map((pkg: any) => (
                              <div key={pkg.id} className="mt-1">
                                <div>{pkg.name}</div>
                                <div className="text-primary">${Number(pkg.price || 0).toFixed(2)}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-700">Class Types</label>
                        <div className="mb-2 text-xs text-gray-500">You can select more than one class type.</div>
                        <div className="min-h-[180px] max-h-[220px] space-y-2 overflow-y-auto rounded-lg border border-gray-200 bg-white p-3">
                          {availableClassTypes.length === 0 ? (
                            <div className="text-sm text-gray-400">No class types available for this branch.</div>
                          ) : (
                            availableClassTypes.map((gymClass: any) => (
                              <label key={gymClass.id} className="flex items-start gap-3 rounded-lg border border-transparent px-2 py-2 text-sm text-gray-700 hover:border-gray-100 hover:bg-gray-50">
                                <input
                                  type="checkbox"
                                checked={(form.classIds || []).includes(String(gymClass.id))}
                                onChange={(e) =>
                                  setForm((current: any) => ({
                                    ...current,
                                    classIds: e.target.checked
                                        ? [...(current.classIds || []), String(gymClass.id)]
                                        : (current.classIds || []).filter((id: string) => id !== String(gymClass.id)),
                                  }))
                                }
                                className="mt-1 rounded"
                                />
                                <span className="min-w-0">
                                  <span className="block font-medium text-gray-900">{gymClass.title}</span>
                                  <span className="block text-xs text-primary">{formatClassPrice(gymClass)}</span>
                                  <span className="block text-xs text-gray-500">{gymClass.sessionCount} credits in this monthly cycle</span>
                                  {gymClass.description && (
                                    <span className="mt-1 block text-xs text-gray-500">{gymClass.description}</span>
                                  )}
                                </span>
                              </label>
                            ))
                          )}
                        </div>
                        {selectedClassTypes.length > 0 && (
                          <div className="mt-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600">
                            <div className="mb-1 font-medium text-gray-800">Selected class types</div>
                            {selectedClassTypes.map((gymClass: any) => (
                              <div key={gymClass.id} className="mt-1">
                                <div>{gymClass.title}</div>
                                <div className="text-primary">{formatClassPrice(gymClass)}</div>
                                <div>{gymClass.sessionCount} credits in this monthly cycle</div>
                              </div>
                            ))}
                            <div>{classCycleStartDate} to {classCycleEndDate || "-"}</div>
                          </div>
                        )}
                      </div>
                    </div>
                    )}
                  </div>

                {showsFreezeFields && (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 sm:col-span-2 lg:col-span-3">
                    <div className="mb-3 flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={form.isFrozen}
                        onChange={(e) =>
                          setForm((current: any) => ({
                            ...current,
                            isFrozen: e.target.checked,
                            status: e.target.checked ? "frozen" : current.status === "frozen" ? "active" : current.status,
                            freezeStartDate: e.target.checked ? current.freezeStartDate : "",
                            freezeEndDate: e.target.checked ? current.freezeEndDate : "",
                            freezeNotes: e.target.checked ? current.freezeNotes : "",
                          }))
                        }
                        className="rounded"
                      />
                      <span className="text-sm font-medium text-gray-700">Freeze {selectedCreateFor.label.toLowerCase()}</span>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {renderInput("freezeStartDate", "Freeze Start", "date")}
                      {renderInput("freezeEndDate", "Freeze End", "date")}
                    </div>
                    {showsMemberExtras && (
                      <p className="mt-2 text-xs text-gray-500">
                        Member freeze dates stay available here so the owner can match the package period manually.
                      </p>
                    )}
                  </div>
                )}

                </>
              </div>

              <div className="mt-5 flex gap-3 border-t border-border pt-4">
                <button type="button" onClick={closeModal} className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editing ? "Update Member" : `Create ${selectedCreateFor.label}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
