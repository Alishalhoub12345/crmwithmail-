import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { EmailLink, PhoneActions } from "@/components/ContactLinks";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { nationalityOptions } from "@/lib/nationalities";
import { flagUrlForNationality, flagUrlFromEmoji } from "@/lib/flags";
import { getPasswordChecks, isStrongPassword } from "@/lib/password";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Edit2, Loader2, X, Calendar, ChevronDown } from "lucide-react";

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
  branchIds: [] as string[],
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

const dateKeyForComparison = (value?: string | Date | null) => {
  if (!value) {
    return "";
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${value.getFullYear()}-${month}-${day}`;
  }

  const text = String(value).trim();
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${year}-${month}-${day}`;
  }

  const displayMatch = text.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (displayMatch) {
    const [, day, month, year] = displayMatch;
    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${parsed.getFullYear()}-${month}-${day}`;
};

const todayDateKey = () => dateKeyForComparison(new Date());

const normalizeStatus = (value: unknown) => String(value ?? "").toLowerCase().trim();

const normalizeSearchText = (value: unknown) =>
  String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");

const matchesSearchSequence = (value: unknown, query: string) => {
  const normalizedValue = normalizeSearchText(value);
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return true;
  }

  const valueParts = normalizedValue.split(/[\s-]+/).filter(Boolean);
  const queryParts = normalizedQuery.split(/[\s-]+/).filter(Boolean);

  return valueParts.some((_, startIndex) =>
    queryParts.every((queryPart, queryIndex) =>
      valueParts[startIndex + queryIndex]?.startsWith(queryPart),
    ),
  );
};

const normalizePhoneSearch = (value: unknown) => String(value ?? "").replace(/\D/g, "");

const phoneSearchVariants = (value: unknown) => {
  const normalizedValue = normalizePhoneSearch(value);
  const variants = new Set<string>([normalizedValue]);

  if (normalizedValue.startsWith("00")) {
    variants.add(normalizedValue.slice(2));
  }

  if (normalizedValue.startsWith("961")) {
    variants.add(normalizedValue.slice(3));
  }

  return Array.from(variants).filter(Boolean);
};

const matchesPhoneSearchSequence = (value: unknown, query: string) => {
  const normalizedQuery = normalizePhoneSearch(query);

  if (!normalizedQuery) {
    return true;
  }

  return phoneSearchVariants(value).some((phoneValue) => phoneValue.startsWith(normalizedQuery));
};

const memberNameSearchValues = (member: any) => {
  const fullName = [member.firstName, member.middleName, member.lastName].filter(Boolean).join(" ");
  return [fullName || member.userName].filter(Boolean);
};

const memberDisplayName = (member: any) => String(memberNameSearchValues(member)[0] ?? "");

const memberPackageItems = (member: any) => {
  const packages = Array.isArray(member.packages) ? member.packages : [];

  if (packages.length > 0) {
    return packages
      .map((pkg: any) => ({
        id: pkg.id ?? pkg.packageId,
        subscriptionId: pkg.subscriptionId,
        name: pkg.name ?? pkg.packageName,
        packageType: pkg.packageType ?? pkg.package_type,
        startDate: pkg.startDate ?? member.membershipStartDate ?? member.joinDate,
        endDate: pkg.endDate ?? member.membershipEndDate,
      }))
      .filter((pkg: any) => pkg.id || pkg.name);
  }

  if (!member.primaryPackageName) {
    return [];
  }

  return [{
    id: member.primaryPackageId,
    subscriptionId: member.activeSubscriptionId,
    name: member.primaryPackageName,
    packageType: member.primaryPackageType,
    startDate: member.membershipStartDate || member.joinDate,
    endDate: member.membershipEndDate,
  }];
};

const memberRowKey = (member: any, index: number) =>
  [
    "member",
    member.id ?? "no-id",
    member.activeSubscriptionId ?? "no-subscription",
    member.membershipStartDate ?? "no-start",
    member.membershipEndDate ?? "no-end",
    member.classMembershipEndDate ?? "no-class-end",
    index,
  ]
    .map((value) => String(value).replace(/[^a-zA-Z0-9_-]+/g, "_"))
    .join("-");

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const HighlightMatch = ({ value, query }: { value?: string | number | null; query: string }) => {
  const text = String(value ?? "");
  const queryParts = normalizeSearchText(query).split(/[\s-]+/).filter(Boolean);

  if (!text || queryParts.length === 0) {
    return <>{text}</>;
  }

  const pattern = new RegExp(`(${queryParts.map(escapeRegExp).join("|")})`, "gi");
  const parts = text.split(pattern);

  return (
    <>
      {parts.map((part, index) =>
        queryParts.some((queryPart) => part.toLowerCase() === queryPart) ? (
          <mark key={`${part}-${index}`} className="rounded bg-yellow-200 px-0.5 text-gray-950">
            {part}
          </mark>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        ),
      )}
    </>
  );
};

const HighlightPhoneMatch = ({ value, query }: { value?: string | number | null; query: string }) => {
  const text = String(value ?? "");
  const normalizedQuery = normalizePhoneSearch(query);

  if (!text || !normalizedQuery) {
    return <>{text}</>;
  }

  const normalizedText = normalizePhoneSearch(text);
  const exactIndex = normalizedText.indexOf(normalizedQuery);
  const matchingDigitPositions = new Set<number>();

  if (exactIndex >= 0) {
    let normalizedIndex = 0;
    for (let textIndex = 0; textIndex < text.length; textIndex += 1) {
      if (!/[a-z0-9]/i.test(text[textIndex])) {
        continue;
      }

      if (normalizedIndex >= exactIndex && normalizedIndex < exactIndex + normalizedQuery.length) {
        matchingDigitPositions.add(textIndex);
      }
      normalizedIndex += 1;
    }
  } else {
    let queryIndex = 0;
    for (let textIndex = 0; textIndex < text.length && queryIndex < normalizedQuery.length; textIndex += 1) {
      const character = text[textIndex].toLowerCase();
      if (!/[a-z0-9]/.test(character)) {
        continue;
      }

      if (character === normalizedQuery[queryIndex]) {
        matchingDigitPositions.add(textIndex);
        queryIndex += 1;
      }
    }
  }

  if (matchingDigitPositions.size === 0) {
    return <>{text}</>;
  }

  return (
    <>
      {Array.from(text).map((character, index) =>
        matchingDigitPositions.has(index) ? (
          <mark key={`${character}-${index}`} className="rounded bg-yellow-200 px-0.5 text-gray-950">
            {character}
          </mark>
        ) : (
          <span key={`${character}-${index}`}>{character}</span>
        ),
      )}
    </>
  );
};

function NationalitySelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredOptions = nationalityOptions.filter((option) =>
    option.label.toLowerCase().includes(search.toLowerCase()),
  );
  const selectedOption = nationalityOptions.find((option) => option.value === value);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-left text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
      >
        <span className="flex min-w-0 items-center gap-2">
          {selectedOption ? (
            <>
              {flagUrlFromEmoji(selectedOption.flag) ? (
                <img
                  src={flagUrlFromEmoji(selectedOption.flag)}
                  alt=""
                  className="h-[18px] w-6 rounded-sm border border-gray-200 object-cover"
                />
              ) : null}
              <span className="truncate">{selectedOption.label}</span>
            </>
          ) : (
            <span className="text-gray-500">Select nationality</span>
          )}
        </span>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-full rounded-xl border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 p-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search nationality..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setSearch("");
                setOpen(false);
              }}
              className="flex w-full items-center px-3 py-2 text-left text-sm text-gray-500 transition-colors hover:bg-gray-50"
            >
              Select nationality
            </button>
            {filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setSearch("");
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50"
              >
                {flagUrlFromEmoji(option.flag) ? (
                  <img
                    src={flagUrlFromEmoji(option.flag)}
                    alt=""
                    className="h-[18px] w-6 rounded-sm border border-gray-200 object-cover"
                  />
                ) : null}
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Members() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [phoneSearch, setPhoneSearch] = useState("");
  const [branchSearch, setBranchSearch] = useState("");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
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
        description: created?.bookingWarning || "A password setup link was sent to the member.",
      });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message || "Failed to create member", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => apiRequest("PUT", `/api/members/${id}`, data).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/coaches"] });
      closeModal();
      toast({ title: "Member updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message || "Failed to update member", variant: "destructive" }),
  });

  const resendPasswordSetupMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/members/${id}/send-password-setup`).then((r) => r.json()),
    onSuccess: () => {
      toast({ title: "Password setup link sent" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message || "Failed to send password setup link", variant: "destructive" }),
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
    const selectedPackageItems = memberPackageItems(member);
    const selectedPackageIds = selectedPackageItems
      .map((pkg: any) => pkg.id)
      .filter((id: number | string | null | undefined) => id !== null && id !== undefined && id !== "")
      .map((id: number | string) => String(id));
    const selectedPackageTypes = selectedPackageItems.map((pkg: any) => pkg.packageType).filter(Boolean);
    const onlyPersonalTrainingPackages =
      selectedPackageTypes.length > 0 &&
      selectedPackageTypes.every((packageType: string) => packageType === "personal_training");
    const nextProfileType =
      selectedPackageItems.length > 0
        ? (onlyPersonalTrainingPackages ? "coach" : "member")
        : member.primaryPackageType === "personal_training"
          ? "coach"
          : "member";
    const nextMembershipType =
      nextProfileType === "coach"
        ? "personal_training"
        : selectedPackageIds.length > 0
          ? "membership"
          : member.classTitles
            ? "classes"
            : "membership";

    setEditing(member);
    setForm({
      createFor: nextProfileType,
      membershipType: nextMembershipType,
      name: member.userName || "",
      firstName: member.firstName || "",
      middleName: member.middleName || "",
      lastName: member.lastName || "",
      email: member.userEmail || "",
      phone: member.userPhone || "",
      password: "",
      packageId: selectedPackageIds[0] || "",
      classId: "",
      packageIds: selectedPackageIds,
      classIds: [],
      branchId: member.branchId || "",
      branchIds: (member.branchIds || (member.branchId ? [member.branchId] : [])).map((id: number | string) => String(id)),
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
    { value: "coach", label: "Personal Training" },
    { value: "lead", label: "Lead" },
  ];

  const selectedCreateFor = createForOptions.find((option) => option.value === form.createFor) ?? createForOptions[0];
  const composedName = [form.firstName, form.middleName, form.lastName].filter(Boolean).join(" ").trim() || form.name;
  const activeRole = form.createFor;
  const behavesLikeMember = activeRole === "member" || activeRole === "coach";
  const showsMemberExtras = activeRole === "member";
  const supportsServiceSelection = activeRole === "member" || activeRole === "coach";
  const showsFreezeFields = activeRole === "member" || activeRole === "coach" || activeRole === "lead" || activeRole === "dietitian";
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
  const selectedPrimaryPackage = availablePackages.find((pkg: any) => String(pkg.id) === String((form.packageIds || [])[0] || form.packageId));
  const selectedPackages = availablePackages.filter((pkg: any) => (form.packageIds || []).includes(String(pkg.id)));
  const visiblePackages = availablePackages;
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
    form.joinDate,
    form.membershipEndDate,
    form.packageId,
    normalizedPackages,
  ]);

  useEffect(() => {
    const selectedPackageId = (form.packageIds || [])[0] || form.packageId;
    if (!selectedPackageId) {
      return;
    }

    const selectedPackage = availablePackages.find((pkg: any) => String(pkg.id) === String(selectedPackageId));
    if (!selectedPackage) {
      return;
    }

    const nextMembershipType = selectedPackage.packageType || "membership";
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

    if (primaryPackageId !== (form.packageId || "")) {
      setForm((current: any) => ({
        ...current,
        packageId: primaryPackageId,
      }));
    }
  }, [form.packageId, form.packageIds, supportsServiceSelection]);

  const handleProfileTypeChange = (nextType: string) => {
    setForm((current: any) => {
      if (nextType === "coach") {
        return {
          ...current,
          createFor: nextType,
          membershipType: "personal_training",
          autoCalculateEndDate: true,
        };
      }

      if (nextType === "member") {
        return {
          ...current,
          createFor: nextType,
          membershipType: current.membershipType === "personal_training" ? "membership" : current.membershipType || "membership",
          autoCalculateEndDate: true,
        };
      }

      return {
        ...current,
        createFor: nextType,
        autoCalculateEndDate: true,
        packageId: "",
        packageIds: [],
      };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedBranchIds = (form.branchIds || []).map((id: string) => parseInt(id, 10)).filter(Boolean);
    const primaryBranchId = selectedBranchIds[0] ?? (form.branchId ? parseInt(form.branchId, 10) : null);

    if (editing && activeRole !== "lead" && form.password && !isStrongPassword(form.password)) {
      toast({
        title: "Weak password",
        description: "Password must include one capital letter, one number, and one special character.",
        variant: "destructive",
      });
      return;
    }

    if (!primaryBranchId) {
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
        normalizedPackages.find((pkg: any) => String(pkg.id) === String((form.packageIds || [])[0] || form.packageId))?.packageType === "personal_training"
          ? "personal_training"
          : "package",
      name: composedName,
      branchId: primaryBranchId,
      branchIds: selectedBranchIds,
      primaryPackageId: (form.packageIds || [])[0] ? parseInt((form.packageIds || [])[0], 10) : form.packageId ? parseInt(form.packageId, 10) : undefined,
      packageId: (form.packageIds || [])[0] ? parseInt((form.packageIds || [])[0], 10) : form.packageId ? parseInt(form.packageId, 10) : undefined,
      packageIds: (form.packageIds || []).map((id: string) => parseInt(id, 10)).filter(Boolean),
      classId: undefined,
      classIds: [],
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
        role: "dietitian",
        branchId: primaryBranchId,
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
      const selectedServiceLabel = availablePackages.find((pkg: any) => String(pkg.id) === String(form.packageId))?.name;

      createLeadMutation.mutate({
        name: composedName,
        firstName: form.firstName || null,
        middleName: form.middleName || null,
        lastName: form.lastName || null,
        branchId: primaryBranchId,
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
          form.packageId
            ? [form.notes, `Interested in: Package${selectedServiceLabel ? ` - ${selectedServiceLabel}` : ""}`]
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

  const resolveMemberStatus = (member: any) => {
    const storedStatus = normalizeStatus(member.status) || "active";

    if (member.isFrozen || storedStatus === "frozen") {
      return "frozen";
    }

    if (storedStatus === "expired") {
      return "expired";
    }

    const endDate = dateKeyForComparison(member.membershipEndDate || member.classMembershipEndDate);
    if (endDate && endDate < todayDateKey()) {
      return "expired";
    }

    return storedStatus;
  };

  const filtered = members.map((member) => ({
    ...member,
    resolvedStatus: resolveMemberStatus(member),
  })).filter((member) => {
    const matchesGeneralSearch = (() => {
      if (!search.trim()) return true;
      return memberNameSearchValues(member).some((nameToCheck) => matchesSearchSequence(nameToCheck, search));
    })();

    const matchesPhoneSearch =
      !phoneSearch.trim() ||
      matchesPhoneSearchSequence(member.userPhone, phoneSearch);

    const matchesBranchSearch =
      !branchSearch ||
      String(member.branchName || "") === branchSearch;

    const memberStartDate = dateKeyForComparison(member.membershipStartDate || member.joinDate);
    const memberEndDate = dateKeyForComparison(member.membershipEndDate || member.classMembershipEndDate);
    const resolvedStatus = normalizeStatus(member.resolvedStatus);
    const selectedStatus = normalizeStatus(statusFilter);

    const matchesStartDate = !startDateFilter || (memberStartDate && memberStartDate >= startDateFilter);
    const matchesEndDate = !endDateFilter || (memberEndDate && memberEndDate <= endDateFilter);
    const matchesStatus = !selectedStatus || resolvedStatus === selectedStatus;

    return (
      matchesGeneralSearch &&
      matchesPhoneSearch &&
      matchesBranchSearch &&
      matchesStartDate &&
      matchesEndDate &&
      matchesStatus
    );
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
          <p className="mt-1 text-sm text-gray-500">{filtered.length} of {members.length} members</p>
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search member names..."
                className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <input
              value={phoneSearch}
              onChange={(e) => setPhoneSearch(e.target.value)}
              placeholder="Search by phone number..."
              className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <input
              type="date"
              value={startDateFilter}
              onChange={(e) => setStartDateFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <input
              type="date"
              value={endDateFilter}
              onChange={(e) => setEndDateFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
              <option value="frozen">Frozen</option>
            </select>
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
                  {["Member", "Branch", "Membership", "PT / Attendance", "Status", "Actions"].map((header) => (
                    <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                      No members found
                    </td>
                  </tr>
                ) : (
                  filtered.map((member, index) => {
                    const rowKey = memberRowKey(member, index);
                    const packageItems = memberPackageItems(member);
                    const memberNationalityFlagUrl = flagUrlForNationality(member.nationality);

                    return (
                      <tr key={rowKey} data-testid={`member-row-${rowKey}`} className="transition-colors hover:bg-gray-50">
                        <td className="px-4 py-3.5">
                          <div className="font-medium text-gray-900">
                            <HighlightMatch value={memberDisplayName(member)} query={search} />
                          </div>
                          <div className="mt-1 text-xs text-gray-500">
                            <EmailLink email={member.userEmail} className="text-gray-500" />
                          </div>
                          <div className="mt-1 text-xs text-gray-500">
                            <PhoneActions
                              phone={member.userPhone}
                              phoneContent={<HighlightPhoneMatch value={member.userPhone} query={phoneSearch || search} />}
                              className="text-gray-500"
                              phoneClassName="text-gray-500"
                            />
                          </div>
                          <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-gray-500">
                            {member.uniqueId && <span>{member.uniqueId}</span>}
                            {member.age !== null && member.age !== undefined && <span>Age: {member.age}</span>}
                            {member.nationality && (
                              <span className="inline-flex items-center gap-1.5">
                                {memberNationalityFlagUrl ? (
                                  <img
                                    src={memberNationalityFlagUrl}
                                    alt=""
                                    className="h-3.5 w-5 rounded-[2px] border border-gray-200 object-cover"
                                  />
                                ) : null}
                                {member.nationality}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-gray-600">
                          <div className="font-medium text-gray-800">{member.branchName || "-"}</div>
                        </td>
                        <td className="px-4 py-3.5 text-gray-600">
                          {packageItems.length > 0 ? (
                            <div className="space-y-1">
                              {packageItems.length > 1 && (
                                <div className="font-medium text-gray-800">Packages</div>
                              )}
                              {packageItems.map((pkg: any, packageIndex: number) => (
                                <div key={`${pkg.subscriptionId ?? pkg.id ?? "package"}-${packageIndex}`}>
                                  <div className="font-medium text-gray-800">
                                    {packageItems.length === 1 ? "Package: " : ""}
                                    {pkg.name}
                                  </div>
                                  <div className="text-xs text-gray-400">
                                    {formatServiceDateRange(pkg.startDate || member.joinDate, pkg.endDate)}
                                  </div>
                                </div>
                              ))}
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
                            const displayStatus = member.resolvedStatus || resolveMemberStatus(member);
                            return (
                              <div className="flex flex-col gap-1">
                                <span
                                  className={`inline-flex w-fit rounded-full px-2 py-0.5 text-xs font-medium ${displayStatus === "active"
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
                    );
                  })
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
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">Profile Type</label>
                      <select
                        value={form.createFor}
                        onChange={(e) => handleProfileTypeChange(e.target.value)}
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
                            This popup creates <span className="font-semibold">Personal Training</span> as a member profile with packages and classes.
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
                    {activeRole !== "lead" && !editing && (
                      <div className="sm:col-span-2 lg:col-span-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                        A temporary password will be generated automatically and a password setup link will be sent to the member. They cannot log in until they choose their password from that email.
                      </div>
                    )}

                    {activeRole !== "lead" && editing && (
                      <>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-gray-700">New Password</label>
                          <input
                            type="password"
                            value={form.password}
                            placeholder="Leave blank to keep current login state"
                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                            className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                          />
                          <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                            <span className={`rounded-full px-2 py-0.5 ${passwordChecks.hasUppercase || !form.password ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>A-Z</span>
                            <span className={`rounded-full px-2 py-0.5 ${passwordChecks.hasDigit || !form.password ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>0-9</span>
                            <span className={`rounded-full px-2 py-0.5 ${passwordChecks.hasSpecial || !form.password ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>Special</span>
                          </div>
                        </div>
                        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                          <div className="font-medium text-gray-900">Password email</div>
                          <p className="mt-1 text-xs text-gray-500">For security, the current password is never shown. If you type a new password and save, that password is emailed to the member. You can also send a setup link instead.</p>
                          <button
                            type="button"
                            disabled={resendPasswordSetupMutation.isPending || !editing?.id}
                            onClick={() => editing?.id && resendPasswordSetupMutation.mutate(editing.id)}
                            className="mt-3 inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                          >
                            Send Password Setup Link
                          </button>
                        </div>
                      </>
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
                    <NationalitySelect
                      value={form.nationality}
                      onChange={(value) => setForm({ ...form, nationality: value })}
                    />
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
                        Auto-calculate from selected package
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
                        <label className="mb-1.5 block text-sm font-medium text-gray-700">
                          {behavesLikeMember ? "Branches" : "Branch"}
                        </label>
                        {behavesLikeMember ? (
                          <>
                            <div className="mb-2 text-xs text-gray-500">You can select more than one branch.</div>
                            <div className="grid max-h-[220px] grid-cols-1 gap-2 overflow-y-auto rounded-lg border border-gray-200 bg-white p-3">
                              {(branches as any[]).map((branch: any) => (
                                <label key={branch.id} className="flex items-center gap-2 rounded-lg border border-gray-100 px-3 py-2 text-sm text-gray-700">
                                  <input
                                    type="checkbox"
                                    checked={(form.branchIds || []).includes(String(branch.id))}
                                    onChange={(e) =>
                                      setForm((current: any) => {
                                        const branchIds = e.target.checked
                                          ? [...(current.branchIds || []), String(branch.id)]
                                          : (current.branchIds || []).filter((id: string) => id !== String(branch.id));

                                        return {
                                          ...current,
                                          branchIds,
                                          branchId: branchIds[0] || "",
                                        };
                                      })
                                    }
                                    className="rounded"
                                  />
                                  <span>{branch.name}</span>
                                </label>
                              ))}
                            </div>
                          </>
                        ) : (
                          <select
                            value={form.branchId}
                            onChange={(e) => setForm({ ...form, branchId: e.target.value, branchIds: e.target.value ? [e.target.value] : [] })}
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
                        )}
                      </div>

                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-700">
                          {supportsServiceSelection ? "Packages" : "Status"}
                        </label>
                        {supportsServiceSelection ? (
                          <>
                            <div className="mb-2 text-xs text-gray-500">You can select more than one package.</div>
                            <div className="min-h-[220px] max-h-[220px] space-y-2 overflow-y-auto rounded-lg border border-gray-200 bg-white p-3">
                              {visiblePackages.map((pkg: any) => (
                                <label key={pkg.id} className="flex items-start gap-3 rounded-xl border border-gray-100 px-3 py-3 text-sm text-gray-700 transition-colors hover:border-primary/20 hover:bg-amber-50/30">
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
                                    className="mt-1 rounded"
                                  />
                                  <span className="min-w-0 flex-1">
                                    <span className="block font-medium text-gray-900">{pkg.name}</span>
                                    <span className="mt-1 block text-xs font-medium text-primary">${Number(pkg.price || 0).toFixed(2)}</span>
                                    <span className="mt-1 block text-xs text-gray-500">
                                      {String(pkg.billingCycle || "1_month").replace(/_/g, " ")} • {Number(pkg.durationDays || 0)} days
                                    </span>
                                    <span className="mt-2 grid grid-cols-3 gap-x-3 gap-y-1 text-xs text-gray-600">
                                      <span>Gym: {pkg.includesGymAccess ? "Included" : "Not included"}</span>
                                      <span>PT: {Number(pkg.includedPtSessions || 0)}</span>
                                      <span>Freeze: {pkg.allowsFreeze ? `${Number(pkg.freezeDaysAllowed || 0)} days` : "No"}</span>
                                    </span>
                                  </span>
                                </label>
                              ))}
                            </div>
                          </>
                        ) : (
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
                        )}
                      </div>
                    </div>

                    {false && supportsServiceSelection && (
                      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-gray-700">Packages</label>
                          <div className="mb-2 text-xs text-gray-500">You can select more than one package.</div>
                          <div className="min-h-[180px] max-h-[220px] space-y-2 overflow-y-auto rounded-lg border border-gray-200 bg-white p-3">
                            {visiblePackages.map((pkg: any) => (
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

                      </div>
                    )}

                    {supportsServiceSelection && (
                      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <div className="flex flex-col">
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

                        {supportsServiceSelection && (
                          <div className="flex flex-col rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs text-gray-600">
                            <div className="mb-2 font-medium text-gray-800">Selected packages</div>
                            {selectedPackages.length > 0 ? (
                              selectedPackages.map((pkg: any) => (
                                <div key={pkg.id} className="mt-2 flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2">
                                  <span className="truncate text-gray-700">{pkg.name}</span>
                                  <span className="shrink-0 font-medium text-primary">${Number(pkg.price || 0).toFixed(2)}</span>
                                </div>
                              ))
                            ) : (
                              <div className="rounded-lg bg-gray-50 px-3 py-2 text-gray-500">No package selected yet.</div>
                            )}
                          </div>
                        )}
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
