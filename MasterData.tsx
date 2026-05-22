import React, { useState, useMemo, useEffect, useRef } from "react";
import { format } from "date-fns";
import { config as firebaseConfig } from "../lib/firebase";
import { useData } from "../lib/DataContext";
import {
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Info,
  AlertCircle,
  Clock,
  ShieldCheck,
  CheckCircle2,
  List as ListIcon,
  Download,
  Upload,
  LayoutGrid,
  LayoutList,
  Users,
  Mail,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  cn,
  formatCurrency,
  getGroupColor,
  DISTINCT_COLORS,
} from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { downloadTemplate, EXPORT_TEMPLATES } from "../lib/templates";

export default function MasterData() {
  const {
    packageTypes,
    locations,
    levels,
    pricingSchemes,
    groups,
    appUsers,
    currentUserRole,
    players,
    addMasterData,
    updateMasterData,
    deleteMasterData,
    dbError,
  } = useData();

  const [activeTab, setActiveTab] = useState<
    "packages" | "locations" | "levels" | "groups" | "pricing" | "users"
  >(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (
      tab &&
      [
        "packages",
        "locations",
        "levels",
        "groups",
        "pricing",
        "users",
      ].includes(tab)
    ) {
      return tab as any;
    }
    return "packages";
  });
  const [showRolesMatrix, setShowRolesMatrix] = useState(false);

  const tabs = [
    { id: "packages", label: "Package Types" },
    { id: "locations", label: "Locations" },
    { id: "levels", label: "Levels" },
    { id: "groups", label: "Groups" },
    { id: "pricing", label: "Global Pricing" },
    { id: "users", label: "System Users" },
  ];

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <p className="text-xs md:text-sm text-blue-500 uppercase tracking-[0.2em] mb-2">
            System Configuration
          </p>
          <h1 className="text-2xl md:text-4xl font-black text-white tracking-tighter uppercase leading-none">
            Master Data
          </h1>
          <p className="text-slate-400 mt-2 uppercase text-[10px] md:text-xs tracking-widest leading-none">
            Configure academy parameters and global pricing modules
          </p>
        </div>
        {dbError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2 flex items-center gap-2 text-red-500 text-[10px] font-black uppercase tracking-widest animate-pulse">
            <AlertCircle size={14} />
            {dbError}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2.5 bg-slate-900 p-1.5 rounded-2xl w-fit border-2 border-slate-800 shadow-bento-subtle">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "px-4 py-2 text-[10px] md:text-sm rounded-xl transition-all uppercase tracking-widest font-black",
              activeTab === tab.id
                ? "bg-white text-slate-950 shadow-bento translate-x-0"
                : "text-slate-400 hover:text-slate-200",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-slate-950 rounded-[2rem] border-2 border-slate-800 shadow-bento overflow-hidden min-h-[400px]">
        {activeTab === "packages" && (
          <GenericList
            title="Package Types"
            entityType="packageTypes"
            items={packageTypes}
            fields={[
              { key: "code", label: "Code", placeholder: "e.g. PRIV, G2" },
              { key: "name", label: "Name", placeholder: "e.g. Private, G2" },
            ]}
            onAdd={(data) => addMasterData("packageTypes", data)}
            onUpdate={(id, data) => updateMasterData("packageTypes", id, data)}
            onDelete={(id) => deleteMasterData("packageTypes", id)}
          />
        )}

        {activeTab === "locations" && (
          <GenericList
            title="Locations"
            entityType="locations"
            items={locations}
            fields={[
              {
                key: "name",
                label: "Club Name",
                placeholder: "e.g. BUE Padel Court",
              },
              {
                key: "governorate",
                label: "Governorate",
                type: "datalist",
                placeholder: "e.g. Cairo",
                options: Array.from(
                  new Set([
                    ...locations.map((l) => l.governorate).filter(Boolean),
                    "Cairo",
                    "Giza",
                    "Alexandria",
                    "Qalyubia",
                    "Port Said",
                    "Suez",
                    "Sharqia",
                    "Dakahlia",
                    "Aswan",
                    "Asyut",
                    "Beheira",
                    "Beni Suef",
                    "Faiyum",
                    "Gharbia",
                    "Ismailia",
                    "Kafr El Sheikh",
                    "Luxor",
                    "Matrouh",
                    "Minya",
                    "Monufia",
                    "New Valley",
                    "North Sinai",
                    "Red Sea",
                    "Sohag",
                    "South Sinai",
                  ]),
                ),
              },
              {
                key: "district",
                label: "District",
                type: "datalist",
                placeholder: "e.g. Al-Shorouk",
                options: Array.from(
                  new Set([
                    ...locations.map((l) => l.district).filter(Boolean),
                    "Maadi",
                    "Al-Shorouk",
                    "New Cairo",
                    "Heliopolis",
                    "Nasr City",
                    "Dokki",
                    "Mohandeseen",
                    "Zamalek",
                    "6th of October",
                    "Sheikh Zayed",
                    "Rehab City",
                    "Madinaty",
                    "10th of Ramadan",
                    "Obour City",
                    "Badr City",
                    "Tagamoa",
                  ]),
                ),
              },
              {
                key: "gps",
                label: "GPS Link",
                placeholder: "https://maps.google.com/...",
              },
            ]}
            onAdd={(data) => addMasterData("locations", data)}
            onUpdate={(id, data) => updateMasterData("locations", id, data)}
            onDelete={(id) => deleteMasterData("locations", id)}
          />
        )}

        {activeTab === "levels" && (
          <GenericList
            title="Levels"
            entityType="levels"
            items={levels}
            fields={[
              {
                key: "name",
                label: "Level Name",
                placeholder: "e.g. Beginner, Advanced",
              },
            ]}
            onAdd={(data) => addMasterData("levels", data)}
            onUpdate={(id, data) => updateMasterData("levels", id, data)}
            onDelete={(id) => deleteMasterData("levels", id)}
          />
        )}

        {activeTab === "groups" && (
          <GenericList
            title="Groups"
            entityType="groups"
            items={groups}
            fields={[
              {
                key: "code",
                label: "Group Code",
                placeholder: "e.g. G2-BUE",
                renderInList: (item: any) => (
                  <span
                    className="px-3 py-1 rounded-lg text-white font-black shadow-sm"
                    style={{ backgroundColor: item.color || "#3b82f6" }}
                  >
                    {item.code}
                  </span>
                ),
              },
              {
                key: "name",
                label: "Group Name",
                placeholder: "e.g. Group of 2 - BUE Shorouk",
              },
              {
                key: "locationId",
                label: "Location",
                type: "select",
                options: locations.map((l) => ({ id: l.id, label: l.name })),
                renderInList: (item: any) => {
                  const loc = locations.find((l) => l.id === item.locationId);
                  return (
                    <span className="text-sm font-black text-slate-400 uppercase italic">
                      {loc?.name || "Unknown"}
                    </span>
                  );
                },
              },
              {
                key: "color",
                label: "Group Color",
                type: "color",
                hideInList: true,
              },
              {
                key: "isActive",
                label: "Group Active",
                type: "boolean",
                checkboxLabel: "Is Active",
                renderInList: (item: any) => (
                  <span
                    className={cn(
                      "px-2 py-0.5 text-[10px] font-black uppercase tracking-widest rounded-lg border",
                      item.isActive !== false
                        ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                        : "bg-red-500/10 text-red-500 border-red-500/20",
                    )}
                  >
                    {item.isActive !== false ? "Active" : "Inactive"}
                  </span>
                ),
              },
            ]}
            onAdd={async (data: any) => {
              if (groups && groups.some((g) => g.color === data.color)) {
                console.warn("Color already used by another group.");
                // We allow it but warn, or we could handle it by picking another automatically
              }
              await addMasterData("groups", {
                ...data,
                isActive: data.isActive !== false,
              });
            }}
            onUpdate={async (id: string, data: any) => {
              const _deactivatePlayers = data._deactivatePlayers;
              const _specificPlayersToDeactivate =
                data._specificPlayersToDeactivate;
              const _activatePlayers = data._activatePlayers;
              const _specificPlayersToActivate =
                data._specificPlayersToActivate;
              const cleanData = { ...data };
              delete cleanData._deactivatePlayers;
              delete cleanData._specificPlayersToDeactivate;
              delete cleanData._activatePlayers;
              delete cleanData._specificPlayersToActivate;

              if (
                groups &&
                groups.some((g) => g.id !== id && g.color === cleanData.color)
              ) {
                console.warn("Color already used by another group.");
              }
              await updateMasterData("groups", id, cleanData);

              if (
                _specificPlayersToDeactivate &&
                _specificPlayersToDeactivate.length > 0
              ) {
                // Option 2: specific players are deactivated. The group remains active.
                // We don't reactivate other players, we just deactivate the specific ones.
                const specificPlayers = (players || []).filter(
                  (p) =>
                    p.groupId === id &&
                    p.isActive !== false &&
                    _specificPlayersToDeactivate.includes(p.id),
                );
                await Promise.all(
                  specificPlayers.map((p) =>
                    updateMasterData("players", String(p.id), {
                      ...p,
                      isActive: false,
                    }),
                  ),
                );
              } else if (
                _specificPlayersToActivate &&
                _specificPlayersToActivate.length > 0
              ) {
                // Option 2 (Reactivate): specific players are activated. Group is reactivated.
                const specificPlayers = (players || []).filter(
                  (p) =>
                    p.groupId === id &&
                    p.isActive === false &&
                    _specificPlayersToActivate.includes(p.id),
                );
                await Promise.all(
                  specificPlayers.map((p) =>
                    updateMasterData("players", String(p.id), {
                      ...p,
                      isActive: true,
                    }),
                  ),
                );
              } else {
                // Standard group activation/deactivation logic
                const isActive = cleanData.isActive !== false;
                const groupPlayers = (players || []).filter(
                  (p) => p.groupId === id && p.isActive !== isActive,
                );
                if (groupPlayers.length > 0) {
                  if (!isActive) {
                    if (_deactivatePlayers) {
                      await Promise.all(
                        groupPlayers.map((p) =>
                          updateMasterData("players", String(p.id), {
                            ...p,
                            isActive,
                          }),
                        ),
                      );
                    }
                  } else {
                    if (_activatePlayers !== false) {
                      await Promise.all(
                        groupPlayers.map((p) =>
                          updateMasterData("players", String(p.id), {
                            ...p,
                            isActive,
                          }),
                        ),
                      );
                    }
                  }
                }
              }
            }}
            onDelete={(id: string) => deleteMasterData("groups", id)}
          />
        )}

        {activeTab === "pricing" && <PricingSchemesList />}
        {activeTab === "users" && currentUserRole && (
          <div className="space-y-6">
            <div className="flex justify-between items-center p-6 border-b-2 border-slate-800 bg-slate-950/30">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20 text-blue-400">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-tighter">
                    Identity Management
                  </h3>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest">
                    Configure system access and role-based permissions
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowRolesMatrix(!showRolesMatrix)}
                className={cn(
                  "px-4 py-2 border-2 rounded-xl text-sm uppercase tracking-widest transition-all flex items-center gap-2",
                  showRolesMatrix
                    ? "bg-white text-slate-950 border-white"
                    : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white",
                )}
              >
                {showRolesMatrix ? (
                  <X size={14} strokeWidth={3} />
                ) : (
                  <Info size={14} strokeWidth={3} />
                )}
                {showRolesMatrix ? "Hide Matrix" : "Roles per Privileges"}
              </button>
            </div>

            <AnimatePresence>
              {showRolesMatrix && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden bg-slate-900/50 border-b-2 border-slate-800"
                >
                  <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-slate-950 border-2 border-slate-800 p-6 rounded-2xl shadow-bento relative group/matrix">
                      <div className="absolute -top-3 -right-3 h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center border-2 border-slate-900 shadow-bento group-hover/matrix:rotate-6 transition-transform">
                        <ShieldCheck size={16} className="text-white" />
                      </div>
                      <span className="text-blue-400 font-black text-xs md:text-sm uppercase tracking-widest block mb-4">
                        Level 0: Administrator
                      </span>
                      <ul className="text-[10px] md:text-xs text-slate-400 uppercase tracking-widest space-y-3 font-bold">
                        <li className="flex gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-blue-500 mt-1 flex-shrink-0" />{" "}
                          Full unrestricted system access (All locations)
                        </li>
                        <li className="flex gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-blue-500 mt-1 flex-shrink-0" />{" "}
                          Master Data configuration (Levels, Locations, Groups)
                        </li>
                        <li className="flex gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-blue-500 mt-1 flex-shrink-0" />{" "}
                          Global Pricing & Package management
                        </li>
                        <li className="flex gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-blue-500 mt-1 flex-shrink-0" />{" "}
                          User lifecycle management (Activate/Deactivate/Reset)
                        </li>
                      </ul>
                    </div>
                    <div className="bg-slate-950 border-2 border-slate-800 p-6 rounded-2xl shadow-bento relative group/matrix">
                      <div className="absolute -top-3 -right-3 h-8 w-8 bg-emerald-600 rounded-lg flex items-center justify-center border-2 border-slate-900 shadow-bento group-hover/matrix:rotate-6 transition-transform">
                        <Clock size={16} className="text-white" />
                      </div>
                      <span className="text-emerald-400 font-black text-xs md:text-sm uppercase tracking-widest block mb-4">
                        Level 1: Coach
                      </span>
                      <ul className="text-[10px] md:text-xs text-slate-400 uppercase tracking-widest space-y-3 font-bold">
                        <li className="flex gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 mt-1 flex-shrink-0" />{" "}
                          Allowed location(s) access only
                        </li>
                        <li className="flex gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 mt-1 flex-shrink-0" />{" "}
                          Player management in his locations
                        </li>
                        <li className="flex gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 mt-1 flex-shrink-0" />{" "}
                          View own results, dashboard & alarms
                        </li>
                        <li className="flex gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 mt-1 flex-shrink-0" />{" "}
                          Record payments with automated attribution
                        </li>
                        <li className="flex gap-2 text-red-400/60 font-black">
                          <div className="h-1.5 w-1.5 rounded-full bg-red-400/40 mt-1 flex-shrink-0" />{" "}
                          Restricted from Master Data
                        </li>
                      </ul>
                    </div>
                    <div className="bg-slate-950 border-2 border-slate-800 p-6 rounded-2xl shadow-bento relative group/matrix">
                      <div className="absolute -top-3 -right-3 h-8 w-8 bg-slate-600 rounded-lg flex items-center justify-center border-2 border-slate-900 shadow-bento group-hover/matrix:rotate-6 transition-transform">
                        <Info size={16} className="text-white" />
                      </div>
                      <span className="text-slate-400 font-black text-xs md:text-sm uppercase tracking-widest block mb-4">
                        Level 2: Visitor
                      </span>
                      <ul className="text-[10px] md:text-xs text-slate-400 uppercase tracking-widest space-y-3 font-bold">
                        <li className="flex gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-slate-500 mt-1 flex-shrink-0" />{" "}
                          View all menus & data (all locations)
                        </li>
                        <li className="flex gap-2 text-red-500/60 font-black">
                          <div className="h-1.5 w-1.5 rounded-full bg-red-500/40 mt-1 flex-shrink-0" />{" "}
                          NO ADD/EDIT/DELETE permissions
                        </li>
                      </ul>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <GenericList
              title="Active Directory"
              entityType="appUsers"
              items={appUsers}
              fields={[
                { key: "name", label: "Name", placeholder: "e.g. Coach Ali" },
                {
                  key: "email",
                  label: "Email",
                  placeholder: "e.g. ali@vasy.com",
                },
                {
                  key: "role",
                  label: "Role",
                  type: "select",
                  options: ["admin", "coach", "visitor"],
                },
                {
                  key: "locationIds",
                  label: "Assigned Locations",
                  type: "multiselect",
                  options: locations.map((l) => ({ id: l.id, label: l.name })),
                },
                {
                  key: "isActive",
                  label: "Account Status",
                  type: "boolean",
                  checkboxLabel: "Account Active",
                },
                {
                  key: "forcePasswordChange",
                  label: "Enforce Password Change",
                  type: "boolean",
                  checkboxLabel: "Required on Next Login",
                },
                { key: "tempPassword", label: "Temporary Password" },
                {
                  key: "password",
                  label: "Initial Password",
                  placeholder: "Required for new (min 6 chars)",
                  hideOnUpdate: true,
                },
              ]}
              onAdd={(data: any) => {
                if (data.role === "admin" || data.role === "visitor")
                  data.locationIds = [];
                data.forcePasswordChange = data.forcePasswordChange !== false; // Default to true if not specified
                return addMasterData("appUsers", data);
              }}
              onUpdate={(id: string, data: any) => {
                if (data.role === "admin" || data.role === "visitor")
                  data.locationIds = [];
                return updateMasterData("appUsers", id, data);
              }}
              onDelete={(id: string) => deleteMasterData("appUsers", id)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function GenericList({
  title,
  entityType,
  items,
  fields,
  onAdd,
  onUpdate,
  onDelete,
}: any) {
  const { currentUserRole, players, updateMasterData } = useData();
  const navigate = useNavigate();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingGroupPlayers, setViewingGroupPlayers] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [isAdding, setIsAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const [statusConfirmItem, setStatusConfirmItem] = useState<any>(null);
  const [deactivateMode, setDeactivateMode] = useState<"initial" | "specific">(
    "initial",
  );
  const [selectedPlayersToDeactivate, setSelectedPlayersToDeactivate] =
    useState<string[]>([]);
  const [reactivateMode, setReactivateMode] = useState<"initial" | "specific">(
    "initial",
  );
  const [selectedPlayersToActivate, setSelectedPlayersToActivate] = useState<
    string[]
  >([]);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("all");

  const initialLoadRef = useRef(false);

  useEffect(() => {
    if (
      !initialLoadRef.current &&
      (items || []).length > 0 &&
      entityType === "groups"
    ) {
      const gId = new URLSearchParams(window.location.search).get("groupId");
      if (gId) {
        const target = items.find((i: any) => i.id === gId);
        if (target) {
          setSearchTerm(target.name || target.code || "");
          window.history.replaceState({}, "", "/master?tab=groups");
        }
        initialLoadRef.current = true;
      } else {
        initialLoadRef.current = true;
      }
    }
  }, [items, entityType]);

  const isReadOnly = currentUserRole?.role === "visitor";

  const filteredItems = useMemo(() => {
    let list = items || [];

    if (entityType === "groups") {
      if (statusFilter === "active") {
        list = list.filter((item: any) => item.isActive !== false);
      } else if (statusFilter === "inactive") {
        list = list.filter((item: any) => item.isActive === false);
      }
    }

    if (!searchTerm) return list;
    const term = searchTerm.toLowerCase();
    return list.filter(
      (item: any) =>
        (item.code?.toLowerCase() || "").includes(term) ||
        (item.name?.toLowerCase() || "").includes(term) ||
        (item.email?.toLowerCase() || "").includes(term) ||
        (item.groupName?.toLowerCase() || "").includes(term),
    );
  }, [items, searchTerm, entityType, statusFilter]);

  const handleEdit = (item: any) => {
    setEditingId(item.id);
    setFormData({ ...item, isActive: item.isActive !== false }); // Ensure isActive is defined
    setError(null);
  };

  const handleDelete = async (id: string) => {
    setIsSaving(true);
    setError(null);
    try {
      await onDelete(id);
    } catch (e: any) {
      console.error("Delete failed", e);
      try {
        const errorData = JSON.parse(e.message);
        setError(`ERR: ${errorData.error}`);
      } catch {
        setError("DELETE DENIED");
      }
    } finally {
      setIsSaving(false);
      setConfirmDeleteId(null);
    }
  };

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleSave = async () => {
    const hasEmptyField = fields.some((f: any) => {
      // Don't check boolean fields for existence
      if (f.type === "boolean") return false;
      // Don't check hidden fields
      if (f.hideInForm || (editingId && f.hideOnUpdate)) return false;
      // Check for missing values
      return !formData[f.key];
    });

    if (hasEmptyField) {
      setError("Please fill all fields");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const savePromise = editingId
        ? onUpdate(editingId, formData)
        : onAdd(formData);

      // Create a timeout promise that rejects after 12 seconds
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                "NETWORK TIMEOUT: The database is taking too long to respond. This usually happens when the client is offline or project quotas are exceeded.",
              ),
            ),
          12000,
        ),
      );

      await Promise.race([savePromise, timeoutPromise]);

      if (editingId) {
        setEditingId(null);
      } else {
        setIsAdding(false);
      }
      setFormData({});
    } catch (e: any) {
      console.error("Save failed", e);
      let errorMsg = "SAVE FAILED";

      if (e.message?.includes("TIMEOUT")) {
        errorMsg = e.message;
      } else {
        try {
          const errorData = JSON.parse(e.message);
          errorMsg = `ERR: ${errorData.error}`;
        } catch {
          errorMsg = e.message || "SAVE FAILED";
        }
      }
      setError(errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setImportStatus(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as any[];
        let count = 0;
        let failCount = 0;
        for (const row of rows) {
          try {
            // Data cleaning/conversion
            Object.keys(row).forEach((key) => {
              if (row[key] === "true") row[key] = true;
              else if (row[key] === "false") row[key] = false;
              else if (
                row[key] !== "" &&
                !isNaN(row[key]) &&
                !key.toLowerCase().includes("phone") &&
                !key.toLowerCase().includes("id")
              ) {
                row[key] = Number(row[key]);
              }
            });

            await onAdd(row);
            count++;
          } catch (err) {
            console.error(`Failed to upload ${entityType}`, err);
            failCount++;
          }
        }
        setImportStatus({
          type: failCount === 0 ? "success" : "error",
          message: `Mass Upload finished: ${count} recorded successfully, ${failCount} failed.`,
        });
        setIsUploading(false);
      },
    });
  };

  return (
    <div className="p-10">
      <div className="flex items-center justify-between mb-10">
        <div>
          <h2 className="text-xl md:text-3xl font-black text-white uppercase tracking-tight">
            {title}
          </h2>
          <p className="text-sm md:text-base text-slate-500 uppercase tracking-widest mt-1">
            Total {(items || []).length} definitions found
          </p>
        </div>
        <div className="flex items-center gap-4">
          <input
            type="text"
            placeholder={`Search ${title}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-base w-64 bg-slate-900 border-slate-700"
          />

          {!isReadOnly && entityType && (
            <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 gap-1">
              {entityType === "groups" && (
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="bg-transparent border-none outline-none text-xs text-slate-300 font-bold uppercase tracking-widest cursor-pointer px-2"
                >
                  <option value="all">ALL GROUPS</option>
                  <option value="active">ACTIVE</option>
                  <option value="inactive">INACTIVE</option>
                </select>
              )}
              <div className="w-px h-full bg-slate-800 mx-1"></div>
              <button
                onClick={() => setViewMode("grid")}
                className={cn(
                  "p-1.5 rounded-lg transition-colors",
                  viewMode === "grid"
                    ? "bg-slate-800 text-white"
                    : "text-slate-500 hover:text-slate-300",
                )}
              >
                <LayoutGrid size={16} />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  "p-1.5 rounded-lg transition-colors",
                  viewMode === "list"
                    ? "bg-slate-800 text-white"
                    : "text-slate-500 hover:text-slate-300",
                )}
              >
                <LayoutList size={16} />
              </button>
            </div>
          )}

          {!isReadOnly && entityType && (
            <div className="flex gap-2">
              <button
                onClick={() =>
                  downloadTemplate(entityType as keyof typeof EXPORT_TEMPLATES)
                }
                className="flex items-center gap-2 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white hover:border-slate-600 transition-all"
              >
                <Download size={14} />
                Template
              </button>
              <label
                className={cn(
                  "flex items-center gap-2 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white hover:border-slate-600 transition-all cursor-pointer",
                  isUploading && "opacity-50 pointer-events-none",
                )}
              >
                {isUploading ? (
                  <Clock className="animate-spin" size={14} />
                ) : (
                  <Upload size={14} />
                )}
                Mass Upload
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleUpload}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {!isReadOnly && (
            <button
              onClick={() => {
                setIsAdding(true);
                const initialData: any = {};
                const itemList = items || [];
                fields.forEach((f: any) => {
                  if (f.type === "color") {
                    const usedColors = new Set(
                      itemList.map((it: any) => it[f.key]),
                    );
                    const availableColor =
                      DISTINCT_COLORS.find((c) => !usedColors.has(c)) ||
                      DISTINCT_COLORS[itemList.length % DISTINCT_COLORS.length];
                    initialData[f.key] = availableColor;
                  }
                });
                setFormData(initialData);
                setError(null);
              }}
              disabled={isAdding || isSaving}
              className="flex items-center gap-2 bento-button-black disabled:opacity-50 disabled:grayscale h-fit py-2"
            >
              <Plus size={16} strokeWidth={3} />
              <span className="text-base">INITIALIZE NEW</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-8 p-4 bg-red-500/10 border-2 border-red-500/50 rounded-2xl flex items-center gap-3 text-red-500 animate-in fade-in slide-in-from-top-2">
          <AlertCircle size={18} />
          <span className="text-base uppercase tracking-widest">{error}</span>
        </div>
      )}

      {importStatus && (
        <div
          className={cn(
            "mb-8 p-4 border-2 rounded-2xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2",
            importStatus.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-500"
              : "bg-red-500/10 border-red-500/50 text-red-500",
          )}
        >
          <div className="flex items-center gap-3">
            {importStatus.type === "success" ? (
              <CheckCircle2 size={18} />
            ) : (
              <AlertCircle size={18} />
            )}
            <span className="text-sm font-black uppercase tracking-widest">
              {importStatus.message}
            </span>
          </div>
          <button
            onClick={() => setImportStatus(null)}
            className="text-current opacity-50 hover:opacity-100"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div
        className={cn(
          "gap-6",
          viewMode === "grid"
            ? "grid grid-cols-1 md:grid-cols-2"
            : "flex flex-col",
        )}
      >
        <AnimatePresence>
          {isAdding && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bento-card bg-slate-950 border-blue-500/50"
            >
              <div
                className={cn(
                  "transition-all",
                  viewMode === "grid"
                    ? "space-y-3"
                    : "flex flex-wrap gap-x-8 gap-y-4 items-end",
                )}
              >
                {fields.map((f: any) => {
                  if (f.key === "locationIds" && formData.role !== "coach")
                    return null;
                  if (f.hideInForm) return null;
                  return (
                    <div key={f.key}>
                      <label className="label-base text-blue-400">
                        {f.label}
                      </label>
                      {f.type === "select" ? (
                        <select
                          disabled={isSaving}
                          value={formData[f.key] || ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              [f.key]: e.target.value,
                            })
                          }
                          className="input-base cursor-pointer"
                        >
                          <option value="">SELECT {f.label}</option>
                          {f.options.map((opt: any) =>
                            typeof opt === "object" ? (
                              <option key={opt.id} value={opt.id}>
                                {String(opt.label).toUpperCase()}
                              </option>
                            ) : (
                              <option key={opt} value={opt}>
                                {String(opt).toUpperCase()}
                              </option>
                            ),
                          )}
                        </select>
                      ) : f.type === "multiselect" ? (
                        <div className="flex flex-col gap-2 p-3 bg-slate-900 shadow-inner border border-slate-800 rounded-xl max-h-40 overflow-y-auto">
                          {f.options.map((opt: any) => {
                            const isChecked =
                              formData[f.key]?.includes(opt.id) || false;
                            return (
                              <label
                                key={opt.id}
                                className="flex items-center gap-2 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  disabled={isSaving}
                                  checked={isChecked}
                                  onChange={(e) => {
                                    const current = formData[f.key] || [];
                                    const next = e.target.checked
                                      ? [...current, opt.id]
                                      : current.filter(
                                          (id: string) => id !== opt.id,
                                        );
                                    setFormData({ ...formData, [f.key]: next });
                                  }}
                                  className="form-checkbox h-4 w-4 text-blue-500 rounded bg-slate-950 border-slate-700 disabled:opacity-50"
                                />
                                <span className="text-sm text-slate-300 font-bold tracking-widest uppercase">
                                  {opt.label}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      ) : f.type === "boolean" ? (
                        <div className="flex items-center justify-between border border-slate-800 rounded-xl p-3 bg-slate-900/50">
                          <span className="text-sm font-black text-slate-300 uppercase tracking-widest">
                            {f.checkboxLabel || "Active"}
                          </span>
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "text-[10px] font-bold uppercase tracking-widest",
                                formData[f.key] !== false
                                  ? "text-slate-300"
                                  : "text-slate-500",
                              )}
                            >
                              On
                            </span>
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() =>
                                setFormData({
                                  ...formData,
                                  [f.key]:
                                    formData[f.key] === false ? true : false,
                                })
                              }
                              className={cn(
                                "relative inline-flex items-center h-6 rounded-full w-12 transition-colors duration-200 ease-in-out px-1 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50",
                                formData[f.key] !== false
                                  ? "bg-emerald-500"
                                  : "bg-slate-600",
                              )}
                            >
                              <div
                                className={cn(
                                  "flex items-center justify-center w-4 h-4 bg-white rounded-full transition-transform duration-200 ease-in-out shadow-sm",
                                  formData[f.key] !== false
                                    ? "transform translate-x-[1.25rem]"
                                    : "transform translate-x-0",
                                )}
                              >
                                {formData[f.key] !== false ? (
                                  <CheckCircle2
                                    size={10}
                                    className="text-emerald-500"
                                  />
                                ) : (
                                  <ListIcon
                                    size={10}
                                    className="text-slate-400 rotate-90"
                                  />
                                )}
                              </div>
                            </button>
                          </div>
                        </div>
                      ) : f.type === "datalist" ? (
                        <>
                          <input
                            type="text"
                            list={`datalist_add_${f.key}`}
                            placeholder={f.placeholder}
                            disabled={isSaving}
                            value={formData[f.key] || ""}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                [f.key]: e.target.value,
                              })
                            }
                            className={cn("input-base", "")}
                          />
                          <datalist id={`datalist_add_${f.key}`}>
                            {f.options?.map((opt: string) => (
                              <option key={opt} value={opt} />
                            ))}
                          </datalist>
                        </>
                      ) : (
                        <input
                          type={f.type || "text"}
                          placeholder={f.placeholder}
                          disabled={isSaving}
                          value={formData[f.key] || ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              [f.key]: e.target.value,
                            })
                          }
                          className={cn(
                            "input-base",
                            f.type !== "color" && "",
                            f.type === "color" && "h-10 cursor-pointer p-1",
                          )}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-3 mt-5">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1 bento-button-black bg-emerald-500 text-white border-none disabled:opacity-50 h-10"
                >
                  {isSaving ? (
                    <Clock className="animate-spin mx-auto" size={18} />
                  ) : (
                    <Check size={18} strokeWidth={3} className="mx-auto" />
                  )}
                </button>
                <button
                  onClick={() => setIsAdding(false)}
                  disabled={isSaving}
                  className="flex-1 bento-button-black bg-red-500 text-white border-none disabled:opacity-50 h-10"
                >
                  <X size={18} strokeWidth={3} className="mx-auto" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {filteredItems.map((item: any) => (
          <div
            key={item.id}
            className="bento-card group hover:border-slate-600 transition-colors bg-slate-900/50"
          >
            {editingId === item.id ? (
              <div
                className={cn(
                  "transition-all",
                  viewMode === "grid"
                    ? "space-y-3"
                    : "flex flex-wrap gap-x-8 gap-y-4 items-end",
                )}
              >
                {fields.map((f: any) => {
                  if (f.key === "locationIds" && formData.role !== "coach")
                    return null;
                  if (f.hideInForm) return null;
                  if (f.hideOnUpdate) return null;
                  return (
                    <div key={f.key}>
                      <label className="label-base">{f.label}</label>
                      {f.type === "select" ? (
                        <select
                          disabled={isSaving}
                          value={formData[f.key] || ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              [f.key]: e.target.value,
                            })
                          }
                          className="input-base cursor-pointer"
                        >
                          <option value="">SELECT {f.label}</option>
                          {f.options.map((opt: any) =>
                            typeof opt === "object" ? (
                              <option key={opt.id} value={opt.id}>
                                {String(opt.label).toUpperCase()}
                              </option>
                            ) : (
                              <option key={opt} value={opt}>
                                {String(opt).toUpperCase()}
                              </option>
                            ),
                          )}
                        </select>
                      ) : f.type === "multiselect" ? (
                        <div className="flex flex-col gap-2 p-3 bg-slate-900 shadow-inner border border-slate-800 rounded-xl max-h-40 overflow-y-auto">
                          {f.options.map((opt: any) => {
                            const isChecked =
                              formData[f.key]?.includes(opt.id) || false;
                            return (
                              <label
                                key={opt.id}
                                className="flex items-center gap-2 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  disabled={isSaving}
                                  checked={isChecked}
                                  onChange={(e) => {
                                    const current = formData[f.key] || [];
                                    const next = e.target.checked
                                      ? [...current, opt.id]
                                      : current.filter(
                                          (id: string) => id !== opt.id,
                                        );
                                    setFormData({ ...formData, [f.key]: next });
                                  }}
                                  className="form-checkbox h-4 w-4 text-blue-500 rounded bg-slate-950 border-slate-700 disabled:opacity-50"
                                />
                                <span className="text-sm text-slate-300 font-bold tracking-widest uppercase">
                                  {opt.label}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      ) : f.type === "boolean" ? (
                        <div className="flex items-center justify-between border border-slate-800 rounded-xl p-3 bg-slate-900/50">
                          <span className="text-sm font-black text-slate-300 uppercase tracking-widest">
                            {f.checkboxLabel || "Active"}
                          </span>
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "text-[10px] font-bold uppercase tracking-widest",
                                formData[f.key] !== false
                                  ? "text-slate-300"
                                  : "text-slate-500",
                              )}
                            >
                              On
                            </span>
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() =>
                                setFormData({
                                  ...formData,
                                  [f.key]:
                                    formData[f.key] === false ? true : false,
                                })
                              }
                              className={cn(
                                "relative inline-flex items-center h-6 rounded-full w-12 transition-colors duration-200 ease-in-out px-1 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50",
                                formData[f.key] !== false
                                  ? "bg-emerald-500"
                                  : "bg-slate-600",
                              )}
                            >
                              <div
                                className={cn(
                                  "flex items-center justify-center w-4 h-4 bg-white rounded-full transition-transform duration-200 ease-in-out shadow-sm",
                                  formData[f.key] !== false
                                    ? "transform translate-x-[1.25rem]"
                                    : "transform translate-x-0",
                                )}
                              >
                                {formData[f.key] !== false ? (
                                  <CheckCircle2
                                    size={10}
                                    className="text-emerald-500"
                                  />
                                ) : (
                                  <ListIcon
                                    size={10}
                                    className="text-slate-400 rotate-90"
                                  />
                                )}
                              </div>
                            </button>
                          </div>
                        </div>
                      ) : f.type === "datalist" ? (
                        <>
                          <input
                            type="text"
                            list={`datalist_edit_${f.key}`}
                            placeholder={f.placeholder}
                            disabled={isSaving}
                            value={formData[f.key] || ""}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                [f.key]: e.target.value,
                              })
                            }
                            className={cn("input-base", "")}
                          />
                          <datalist id={`datalist_edit_${f.key}`}>
                            {f.options?.map((opt: string) => (
                              <option key={opt} value={opt} />
                            ))}
                          </datalist>
                        </>
                      ) : (
                        <input
                          type={f.type || "text"}
                          value={formData[f.key] || ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              [f.key]: e.target.value,
                            })
                          }
                          className={cn(
                            "input-base",
                            f.type !== "color" && "",
                            f.type === "color" && "h-10 cursor-pointer p-1",
                          )}
                        />
                      )}
                    </div>
                  );
                })}
                <div
                  className={cn("flex gap-3", viewMode === "grid" && "mt-5")}
                >
                  <button
                    onClick={handleSave}
                    className="flex-1 bento-button-black bg-white text-slate-950 border-none h-10"
                  >
                    SAVE
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="flex-1 bento-button-black bg-slate-800 text-slate-400 border-none h-10"
                  >
                    CANCEL
                  </button>
                </div>
              </div>
            ) : (
              <div
                className={cn(
                  "flex justify-between",
                  viewMode === "grid" ? "items-center" : "items-center gap-8",
                )}
              >
                <div
                  className={cn(
                    "w-full transition-all",
                    viewMode === "grid"
                      ? "space-y-4"
                      : "flex flex-wrap gap-x-12 gap-y-4 items-center",
                  )}
                >
                  {fields.map((f: any) => {
                    if (f.key === "locationIds" && item.role !== "coach")
                      return null;
                    if (f.hideOnUpdate) return null;
                    return (
                      <div key={f.key}>
                        {!(
                          f.key === "tempPassword" && !item.forcePasswordChange
                        ) &&
                          !f.hideInList && (
                            <>
                              <span className="text-sm text-slate-500 uppercase tracking-[0.2em] block mb-1">
                                {f.label}
                              </span>
                              <span
                                className={cn(
                                  "text-lg text-white tracking-tight flex items-center gap-2",
                                  f.key === "name" || f.key === "groupName"
                                    ? ""
                                    : "uppercase",
                                )}
                              >
                                {f.renderInList ? (
                                  f.renderInList(item)
                                ) : f.type === "color" ? (
                                  <div
                                    className="w-5 h-5 rounded-full border border-slate-700 shadow-sm"
                                    style={{ backgroundColor: item[f.key] }}
                                  />
                                ) : f.type === "multiselect" ? (
                                  <div className="flex gap-1 flex-wrap">
                                    {(item[f.key] || []).map((val: string) => {
                                      const opt = f.options.find(
                                        (o: any) => o.id === val,
                                      );
                                      return (
                                        <span
                                          key={val}
                                          className="px-2 py-0.5 bg-slate-800 text-sm rounded uppercase"
                                        >
                                          {opt ? opt.label : val}
                                        </span>
                                      );
                                    })}
                                  </div>
                                ) : f.type === "boolean" ? (
                                  <div className="flex gap-2 items-center">
                                    <span
                                      className={cn(
                                        "px-2 py-0.5 text-sm rounded uppercase flex items-center gap-1 w-fit",
                                        item[f.key] !== false
                                          ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                                          : "bg-red-500/10 text-red-500 border border-red-500/20",
                                      )}
                                    >
                                      {f.key === "forcePasswordChange"
                                        ? item[f.key]
                                          ? "Change Required"
                                          : "Password Set"
                                        : item[f.key] !== false
                                          ? "Active"
                                          : "Deactivated"}
                                    </span>
                                    {f.key === "forcePasswordChange" &&
                                      item[f.key] && (
                                        <span className="text-sm text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 animate-pulse">
                                          TEMP PASS ACTIVE
                                        </span>
                                      )}
                                  </div>
                                ) : (
                                  item[f.key]
                                )}
                              </span>
                            </>
                          )}
                      </div>
                    );
                  })}
                </div>

                <div
                  className={cn(
                    "relative shrink-0 flex items-center justify-end",
                    viewMode === "grid" ? "flex-col gap-2" : "flex-row gap-4",
                  )}
                >
                  <div
                    className={cn(
                      "flex items-center gap-2 bg-slate-950 p-2 rounded-lg border border-slate-800",
                      viewMode === "grid" && "mb-2",
                    )}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      STATUS
                    </span>
                    <button
                      onClick={async () => {
                        if (entityType === "groups") {
                          setDeactivateMode("initial");
                          setReactivateMode("initial");
                          setSelectedPlayersToDeactivate([]);
                          setSelectedPlayersToActivate([]);
                          setStatusConfirmItem(item);
                        } else {
                          await onUpdate(item.id, {
                            ...item,
                            isActive: item.isActive === false ? true : false,
                          });
                        }
                      }}
                      className={cn(
                        "w-10 h-6 flex items-center rounded-full p-1 transition-colors duration-200",
                        item.isActive !== false
                          ? "bg-emerald-500"
                          : "bg-red-500",
                      )}
                    >
                      <div
                        className={cn(
                          "w-4 h-4 bg-white rounded-full shadow-md transition-transform duration-200",
                          item.isActive !== false
                            ? "translate-x-4"
                            : "translate-x-0",
                        )}
                      ></div>
                    </button>
                  </div>
                  {confirmDeleteId === item.id ? (
                    <div className="absolute right-0 top-0 z-10 flex gap-1 animate-in fade-in slide-in-from-right-2">
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="h-9 px-3 flex items-center justify-center border-2 border-red-500 rounded-lg bg-red-600 text-white text-sm uppercase shadow-bento"
                      >
                        CONFIRM
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="h-9 px-3 flex items-center justify-center border-2 border-slate-800 rounded-lg bg-slate-900 text-slate-400 text-sm uppercase"
                      >
                        X
                      </button>
                    </div>
                  ) : (
                    <>
                      {!isReadOnly && (
                        <>
                          <button
                            onClick={() => handleEdit(item)}
                            className="h-9 w-9 flex items-center justify-center border-2 border-slate-800 rounded-lg bg-slate-950 text-slate-400 hover:text-white hover:border-slate-400 transition-all"
                            title="Edit"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(item.id)}
                            className="h-9 w-9 flex items-center justify-center border-2 border-slate-800 rounded-lg bg-slate-950 text-slate-600 hover:text-red-500 hover:border-red-500/50 transition-all"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                      {entityType === "groups" && (
                        <>
                          <button
                            onClick={() => setViewingGroupPlayers(item)}
                            className="h-9 w-9 flex items-center justify-center border-2 border-slate-800 rounded-lg bg-slate-950 text-slate-400 hover:text-white hover:border-slate-400 transition-all"
                            title="View Players"
                          >
                            <Users size={16} />
                          </button>
                          <button
                            onClick={() => navigate(`/team-messages?groupId=${item.id}`)}
                            className="h-9 w-9 flex items-center justify-center border-2 border-slate-800 rounded-lg bg-slate-950 text-slate-400 hover:text-blue-400 hover:border-blue-400/50 transition-all"
                            title="Send Message to Group"
                          >
                            <Mail size={16} />
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {statusConfirmItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border-2 border-slate-800 rounded-[2rem] p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            {statusConfirmItem.isActive !== false ? (
              <>
                <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-4 flex items-center gap-3">
                  <AlertCircle className="text-amber-500" size={24} />
                  Deactivate Group
                </h3>

                {deactivateMode === "initial" && (
                  <>
                    <p className="text-slate-400 mb-6 text-[10px] uppercase tracking-widest leading-loose">
                      Do you want to deactivate players in the "
                      {statusConfirmItem.name}" group along with the group?
                    </p>
                    <div className="flex flex-col gap-3">
                      <button
                        onClick={async () => {
                          setStatusConfirmItem(null);
                          await onUpdate(statusConfirmItem.id, {
                            ...statusConfirmItem,
                            isActive: false,
                            _deactivatePlayers: true,
                          });
                        }}
                        className="w-full bg-red-600 text-white p-4 rounded-xl font-black uppercase tracking-widest text-[10px] border-2 border-red-500 shadow-bento hover:bg-red-500 transition-colors flex items-center justify-between"
                      >
                        <span>Deactivate All Players</span>
                        <span className="opacity-50">
                          (Group + All Players)
                        </span>
                      </button>
                      <button
                        onClick={() => setDeactivateMode("specific")}
                        className="w-full bg-amber-600 text-white p-4 rounded-xl font-black uppercase tracking-widest text-[10px] border-2 border-amber-500 shadow-bento hover:bg-amber-500 transition-colors flex items-center justify-between"
                      >
                        <span>Specific Players</span>
                        <span className="opacity-50">
                          (Select who to deactivate, group stays active)
                        </span>
                      </button>
                      <button
                        onClick={async () => {
                          setStatusConfirmItem(null);
                          await onUpdate(statusConfirmItem.id, {
                            ...statusConfirmItem,
                            isActive: false,
                            _deactivatePlayers: false,
                          });
                        }}
                        className="w-full bg-slate-800 text-white p-4 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-700 transition-colors flex items-center justify-between"
                      >
                        <span>Only Deactivate Group</span>
                        <span className="opacity-50">
                          (Keep players active)
                        </span>
                      </button>
                      <button
                        onClick={() => {
                          setStatusConfirmItem(null);
                          setDeactivateMode("initial");
                          setSelectedPlayersToDeactivate([]);
                        }}
                        className="w-full bg-transparent text-slate-500 p-4 rounded-xl font-black uppercase tracking-widest text-[10px] hover:text-slate-300 transition-colors mt-2"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                )}

                {deactivateMode === "specific" && (
                  <>
                    <p className="text-slate-400 mb-4 text-[10px] uppercase tracking-widest leading-loose">
                      Select players to deactivate (Group will remain active):
                    </p>
                    <div className="max-h-60 overflow-y-auto pr-2 mb-6 space-y-2 custom-scrollbar">
                      {(players || [])
                        .filter(
                          (p: any) =>
                            p.groupId === statusConfirmItem.id &&
                            p.isActive !== false,
                        )
                        .map((p: any) => (
                          <label
                            key={p.id}
                            className="flex items-center gap-3 p-3 bg-slate-950 border border-slate-800 rounded-lg cursor-pointer hover:border-slate-700 transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={selectedPlayersToDeactivate.includes(
                                p.id,
                              )}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedPlayersToDeactivate([
                                    ...selectedPlayersToDeactivate,
                                    p.id,
                                  ]);
                                } else {
                                  setSelectedPlayersToDeactivate(
                                    selectedPlayersToDeactivate.filter(
                                      (id) => id !== p.id,
                                    ),
                                  );
                                }
                              }}
                              className="w-4 h-4 rounded border-slate-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-950 bg-slate-900"
                            />
                            <span className="text-sm font-bold text-slate-200">
                              {p.name}{" "}
                              {p.tag && (
                                <span className="opacity-50 text-xs ml-1">
                                  ({p.tag})
                                </span>
                              )}
                            </span>
                          </label>
                        ))}
                      {(players || []).filter(
                        (p: any) =>
                          p.groupId === statusConfirmItem.id &&
                          p.isActive !== false,
                      ).length === 0 && (
                        <p className="text-center text-slate-500 text-xs italic py-4">
                          No active players found in this group.
                        </p>
                      )}
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setDeactivateMode("initial");
                          setSelectedPlayersToDeactivate([]);
                        }}
                        className="flex-1 bg-slate-800 text-white p-4 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-700 transition-colors"
                      >
                        Back
                      </button>
                      <button
                        onClick={async () => {
                          setStatusConfirmItem(null);
                          setDeactivateMode("initial");
                          await onUpdate(statusConfirmItem.id, {
                            ...statusConfirmItem,
                            isActive: true,
                            _deactivatePlayers: false,
                            _specificPlayersToDeactivate:
                              selectedPlayersToDeactivate,
                          });
                          setSelectedPlayersToDeactivate([]);
                        }}
                        className="flex-1 bg-amber-600 text-white p-4 rounded-xl font-black uppercase tracking-widest text-[10px] border-2 border-amber-500 shadow-bento hover:bg-amber-500 transition-colors"
                      >
                        Confirm
                      </button>
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
                <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-4 flex items-center gap-3">
                  <AlertCircle className="text-emerald-500" size={24} />
                  Reactivate Group
                </h3>

                {reactivateMode === "initial" && (
                  <>
                    <p className="text-slate-400 mb-6 text-[10px] uppercase tracking-widest leading-loose">
                      Do you want to reactivate players in the "
                      {statusConfirmItem.name}" group along with the group?
                    </p>
                    <div className="flex flex-col gap-3">
                      <button
                        onClick={async () => {
                          setStatusConfirmItem(null);
                          await onUpdate(statusConfirmItem.id, {
                            ...statusConfirmItem,
                            isActive: true,
                            _activatePlayers: true,
                          });
                        }}
                        className="w-full bg-emerald-600 text-white p-4 rounded-xl font-black uppercase tracking-widest text-[10px] border-2 border-emerald-500 shadow-bento hover:bg-emerald-500 transition-colors flex items-center justify-between"
                      >
                        <span>Activate All Players</span>
                        <span className="opacity-50">
                          (Group + All Players)
                        </span>
                      </button>
                      <button
                        onClick={() => setReactivateMode("specific")}
                        className="w-full bg-blue-600 text-white p-4 rounded-xl font-black uppercase tracking-widest text-[10px] border-2 border-blue-500 shadow-bento hover:bg-blue-500 transition-colors flex items-center justify-between"
                      >
                        <span>Specific Players</span>
                        <span className="opacity-50">
                          (Select who to activate, group active)
                        </span>
                      </button>
                      <button
                        onClick={async () => {
                          setStatusConfirmItem(null);
                          await onUpdate(statusConfirmItem.id, {
                            ...statusConfirmItem,
                            isActive: true,
                            _activatePlayers: false,
                          });
                        }}
                        className="w-full bg-slate-800 text-white p-4 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-700 transition-colors flex items-center justify-between"
                      >
                        <span>Only Reactivate Group</span>
                        <span className="opacity-50">
                          (Keep players inactive)
                        </span>
                      </button>
                      <button
                        onClick={() => {
                          setStatusConfirmItem(null);
                          setReactivateMode("initial");
                          setSelectedPlayersToActivate([]);
                        }}
                        className="w-full bg-transparent text-slate-500 p-4 rounded-xl font-black uppercase tracking-widest text-[10px] hover:text-slate-300 transition-colors mt-2"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                )}

                {reactivateMode === "specific" && (
                  <>
                    <p className="text-slate-400 mb-4 text-[10px] uppercase tracking-widest leading-loose">
                      Select players to activate (Group will be reactivated):
                    </p>
                    <div className="max-h-60 overflow-y-auto pr-2 mb-6 space-y-2 custom-scrollbar">
                      {(players || [])
                        .filter(
                          (p: any) =>
                            p.groupId === statusConfirmItem.id &&
                            p.isActive === false,
                        )
                        .map((p: any) => (
                          <label
                            key={p.id}
                            className="flex items-center gap-3 p-3 bg-slate-950 border border-slate-800 rounded-lg cursor-pointer hover:border-slate-700 transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={selectedPlayersToActivate.includes(p.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedPlayersToActivate([
                                    ...selectedPlayersToActivate,
                                    p.id,
                                  ]);
                                } else {
                                  setSelectedPlayersToActivate(
                                    selectedPlayersToActivate.filter(
                                      (id) => id !== p.id,
                                    ),
                                  );
                                }
                              }}
                              className="w-4 h-4 rounded border-slate-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-950 bg-slate-900"
                            />
                            <span className="text-sm font-bold text-slate-200">
                              {p.name}{" "}
                              {p.tag && (
                                <span className="opacity-50 text-xs ml-1">
                                  ({p.tag})
                                </span>
                              )}
                            </span>
                          </label>
                        ))}
                      {(players || []).filter(
                        (p: any) =>
                          p.groupId === statusConfirmItem.id &&
                          p.isActive === false,
                      ).length === 0 && (
                        <p className="text-center text-slate-500 text-xs italic py-4">
                          No inactive players found in this group.
                        </p>
                      )}
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setReactivateMode("initial");
                          setSelectedPlayersToActivate([]);
                        }}
                        className="flex-1 bg-slate-800 text-white p-4 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-700 transition-colors"
                      >
                        Back
                      </button>
                      <button
                        onClick={async () => {
                          setStatusConfirmItem(null);
                          setReactivateMode("initial");
                          await onUpdate(statusConfirmItem.id, {
                            ...statusConfirmItem,
                            isActive: true,
                            _activatePlayers: false,
                            _specificPlayersToActivate:
                              selectedPlayersToActivate,
                          });
                          setSelectedPlayersToActivate([]);
                        }}
                        className="flex-1 bg-emerald-600 text-white p-4 rounded-xl font-black uppercase tracking-widest text-[10px] border-2 border-emerald-500 shadow-bento hover:bg-emerald-500 transition-colors"
                      >
                        Confirm
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {viewingGroupPlayers && (
        <div 
          id="group-players-modal"
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
        >
          <div className="bg-slate-900 border-2 border-slate-800 rounded-[2rem] p-8 max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-500 border border-blue-500/20">
                  <Users size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tight leading-none">
                    {viewingGroupPlayers.name}
                  </h3>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">
                    PLAYERS & ACTIVE/INACTIVE STATUS
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewingGroupPlayers(null)}
                className="p-2 text-slate-400 hover:text-white bg-slate-950 border border-slate-800 rounded-xl hover:border-slate-700 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[350px] overflow-y-auto pr-2 space-y-2.5 custom-scrollbar min-h-[100px]">
              {(() => {
                const groupPlayersList = (players || []).filter((p: any) => 
                  String(p.groupId) === String(viewingGroupPlayers.id) || 
                  (p.groupAssignments && p.groupAssignments.some((ga: any) => String(ga.groupId) === String(viewingGroupPlayers.id)))
                );

                if (groupPlayersList.length === 0) {
                  return (
                    <div className="text-center text-slate-500 text-xs py-10 border-2 border-dashed border-slate-800/80 rounded-2xl bg-slate-950/50">
                      NO PLAYERS ASSIGNED TO THIS GROUP
                    </div>
                  );
                }

                return groupPlayersList.map((p: any) => {
                  const isPlayerActive = p.isActive !== false;
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-4 bg-slate-950 border border-slate-800/80 rounded-2xl hover:border-slate-700/80 transition-all"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-slate-200 uppercase tracking-wide">
                          {p.name}
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          {p.tag && (
                            <span className="text-[10px] bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded text-blue-400 font-bold uppercase tracking-wider">
                              {p.tag}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-500 font-mono">
                            {p.email || p.phone || "No contact info"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className={cn(
                          "text-[10px] font-black uppercase tracking-widest",
                          isPlayerActive ? "text-emerald-500" : "text-slate-500"
                        )}>
                          {isPlayerActive ? "Active" : "Inactive"}
                        </span>
                        
                        <button
                          onClick={async () => {
                            try {
                              await updateMasterData('players', p.id, {
                                ...p,
                                isActive: !isPlayerActive
                              });
                            } catch (err: any) {
                              console.error("Failed to toggle player status", err);
                            }
                          }}
                          className={cn(
                            "w-10 h-6 flex items-center rounded-full p-1 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500",
                            isPlayerActive ? "bg-emerald-500" : "bg-red-500"
                          )}
                          title={`Click to ${isPlayerActive ? 'deactivate' : 'activate'} ${p.name}`}
                        >
                          <div
                            className={cn(
                              "w-4 h-4 bg-white rounded-full shadow-md transition-transform duration-200",
                              isPlayerActive ? "translate-x-4" : "translate-x-0"
                            )}
                          />
                        </button>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setViewingGroupPlayers(null)}
                className="px-6 py-2.5 bg-slate-950 text-slate-400 hover:text-white font-black uppercase tracking-widest text-[10px] border border-slate-800 hover:border-slate-600 rounded-xl transition-all"
              >
                Close Manager
              </button>
            </div>
          </div>
        </div>
      )}

      {(items || []).length === 0 && !isAdding && (
        <div className="text-center py-20 bg-slate-900/50 rounded-[2rem] border-4 border-dashed border-slate-800">
          <p className="text-slate-500 uppercase text-sm tracking-widest">
            Undefined Registry
          </p>
        </div>
      )}
    </div>
  );
}

function PricingSchemesList() {
  const {
    packageTypes,
    pricingSchemes,
    addMasterData,
    updateMasterData,
    deleteMasterData,
    currentUserRole,
  } = useData();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchYear, setSearchYear] = useState<string>("");
  const [searchMonth, setSearchMonth] = useState<string>("");
  const [formData, setFormData] = useState<any>({
    effectiveMonth: new Date().toISOString().slice(0, 7),
  });
  const [isAdding, setIsAdding] = useState(false);
  const [editYear, setEditYear] = useState(new Date().getFullYear().toString());
  const [editMonth, setEditMonth] = useState(
    (new Date().getMonth() + 1).toString().padStart(2, "0"),
  );
  const [editingMonth, setEditingMonth] = useState<string | null>(null);

  React.useEffect(() => {
    if (editingMonth) {
      const [y, m] = editingMonth.split("-");
      setEditYear(y);
      setEditMonth(m);
      setFormData({ ...formData, effectiveMonth: editingMonth });
    }
  }, [editingMonth]);

  const updateFormDataMonth = React.useCallback(() => {
    const newMonth = `${editYear}-${editMonth.padStart(2, "0")}`;
    setFormData((prev: any) => ({ ...prev, effectiveMonth: newMonth }));
    return newMonth;
  }, [editYear, editMonth]);

  React.useEffect(() => {
    updateFormDataMonth();
  }, [editYear, editMonth, updateFormDataMonth]);
  const [isBatchEditing, setIsBatchEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matrixData, setMatrixData] = useState<
    Record<number, Record<string, string>>
  >({});
  const defaultSlotCounts = [1, 4, 8];
  const [slotCounts, setSlotCounts] = useState<number[]>([1, 4, 8]);
  const [newSlotCount, setNewSlotCount] = useState<string>("");

  const isReadOnly = currentUserRole?.role === "visitor";

  const sortedPackageTypes = useMemo(() => {
    return [...(packageTypes || [])].sort((a, b) => {
      const getPriority = (code: string) => {
        const lower = code.toLowerCase();
        if (lower.includes("pvt") || lower.includes("private")) return 0;
        const match = lower.match(/\d+/);
        if (match) return parseInt(match[0], 10);
        return 999;
      };
      const pA = getPriority(a.code);
      const pB = getPriority(b.code);
      if (pA !== pB) return pA - pB;
      return a.code.localeCompare(b.code);
    });
  }, [packageTypes]);

  const groupedSchemes = useMemo(() => {
    const grouped: Record<string, Record<number, Record<string, any>>> = {};
    pricingSchemes.forEach((scheme) => {
      const month = scheme.effectiveMonth;
      const [y, m] = month.split("-");

      if (searchYear && y !== searchYear) return;
      if (searchMonth && m !== searchMonth) return;

      if (!grouped[month]) grouped[month] = {};
      if (!grouped[month][scheme.numSessions])
        grouped[month][scheme.numSessions] = {};
      grouped[month][scheme.numSessions][scheme.packageTypeCode] = scheme;
    });
    return Object.keys(grouped)
      .sort((a, b) => b.localeCompare(a))
      .map((month) => ({
        month,
        data: grouped[month],
        slotCounts: Object.keys(grouped[month])
          .map(Number)
          .sort((a, b) => a - b),
      }));
  }, [pricingSchemes, searchYear, searchMonth]);

  const handleEdit = (scheme: any) => {
    setEditingId(scheme.id);
    setIsBatchEditing(false);
    setFormData(scheme);
    setError(null);
  };

  const handleEditMatrix = (group: any) => {
    console.log("Edit matrix clicked for group:", group);
    setEditingMonth(group.month);
    // setIsBatchEditing(true); // Don't trigger batch modal
    setEditingId(null);
    setFormData({
      effectiveMonth: group.month,
      sessionCost:
        group.data[group.slotCounts[0]]?.[
          Object.keys(group.data[group.slotCounts[0]])[0]
        ]?.sessionCost || 0,
    });
    setSlotCounts(group.slotCounts);

    const newMatrixData: Record<number, Record<string, string>> = {};
    group.slotCounts.forEach((slots: number) => {
      newMatrixData[slots] = {};
      sortedPackageTypes.forEach((pt) => {
        const scheme = group.data[slots]?.[pt.code];
        if (scheme) {
          newMatrixData[slots][pt.code] = (
            scheme.sessionValue * scheme.numSessions
          ).toString();
        }
      });
    });
    setMatrixData(newMatrixData);
    setError(null);
  };

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteMatrixMonth, setConfirmDeleteMatrixMonth] = useState<
    string | null
  >(null);

  const handleDelete = async (id: string) => {
    setIsSaving(true);
    setError(null);
    try {
      await deleteMasterData("pricingSchemes", id);
    } catch (e: any) {
      setError("PRICING DELETION REJECTED");
    } finally {
      setIsSaving(false);
      setConfirmDeleteId(null);
    }
  };

  const handleDeleteMatrix = async (month: string) => {
    setIsSaving(true);
    setError(null);
    try {
      const schemesToDelete = pricingSchemes.filter(
        (s) => s.effectiveMonth === month,
      );
      for (const scheme of schemesToDelete) {
        if (scheme.id) {
          await deleteMasterData("pricingSchemes", scheme.id);
        }
      }
    } catch (e: any) {
      setError("PRICING MATRIX DELETION REJECTED");
    } finally {
      setIsSaving(false);
      setConfirmDeleteMatrixMonth(null);
    }
  };

  const handleSaveMatrix = async () => {
    setIsSaving(true);
    setError(null);
    try {
      for (const slotsCount of slotCounts) {
        for (const pt of sortedPackageTypes) {
          const rawVal = matrixData[slotsCount]?.[pt.code];
          if (rawVal) {
            const totalValue = Number(rawVal);
            const sessionValue = totalValue / slotsCount;

            // Check if already exists for this month/slots/type
            const existing = pricingSchemes.find(
              (s) =>
                s.effectiveMonth === formData.effectiveMonth &&
                s.numSessions === slotsCount &&
                s.packageTypeCode === pt.code,
            );

            const payload = {
              effectiveMonth: formData.effectiveMonth,
              packageTypeCode: pt.code,
              numSessions: slotsCount,
              sessionValue: sessionValue,
              sessionCost: Number(formData.sessionCost || 0),
            };

            if (existing) {
              await updateMasterData("pricingSchemes", existing.id, payload);
            } else {
              await addMasterData("pricingSchemes", payload);
            }
          }
        }
      }
      setIsAdding(false);
      setIsBatchEditing(false);
      setMatrixData({});
      setFormData({ effectiveMonth: new Date().toISOString().slice(0, 7) });
      setEditingMonth(null);
    } catch (e: any) {
      setError("PRICING DEPLOYMENT REJECTED");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSingle = async () => {
    if (
      !formData.packageTypeCode ||
      !formData.numSessions ||
      !formData.sessionValue
    ) {
      setError("Incomplete Pricing Module parameters");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const payload = {
        ...formData,
        numSessions: Number(formData.numSessions),
        sessionValue: Number(formData.sessionValue),
        sessionCost: Number(formData.sessionCost || 0),
      };

      await updateMasterData("pricingSchemes", editingId!, payload);
      setEditingId(null);
      setFormData({ effectiveMonth: new Date().toISOString().slice(0, 7) });
    } catch (e: any) {
      setError("PRICING DEPLOYMENT REJECTED");
    } finally {
      setIsSaving(false);
    }
  };

  const handleMatrixChange = (slots: number, code: string, val: string) => {
    setMatrixData((prev) => ({
      ...prev,
      [slots]: {
        ...(prev[slots] || {}),
        [code]: val,
      },
    }));
  };

  return (
    <div className="p-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
        <div>
          <h2 className="text-lg font-black text-white uppercase tracking-tighter">
            Global Valuation Scheme
          </h2>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-2 bg-slate-900/50 border border-slate-800 px-3 py-1.5 rounded-lg w-fit">
            Set session values for economic reporting
          </p>
        </div>
        {!isAdding && !editingId && !isReadOnly && (
          <div className="flex items-center gap-3">
            <div className="flex bg-slate-900/50 border border-slate-800 rounded-xl p-1 gap-1">
              <select
                value={searchYear}
                onChange={(e) => setSearchYear(e.target.value)}
                className="bg-transparent text-slate-400 text-[10px] uppercase font-black tracking-widest px-2 py-1 focus:outline-none border-none cursor-pointer hover:text-white transition-colors"
              >
                <option value="" className="bg-slate-950">
                  ALL YEARS
                </option>
                {[
                  ...new Set(
                    pricingSchemes.map((s) => s.effectiveMonth.split("-")[0]),
                  ),
                ]
                  .sort()
                  .reverse()
                  .map((y) => (
                    <option key={y} value={y} className="bg-slate-950">
                      {y}
                    </option>
                  ))}
              </select>
              <div className="w-px h-4 bg-slate-800 self-center" />
              <select
                value={searchMonth}
                onChange={(e) => setSearchMonth(e.target.value)}
                className="bg-transparent text-slate-400 text-[10px] uppercase font-black tracking-widest px-2 py-1 focus:outline-none border-none cursor-pointer hover:text-white transition-colors"
              >
                <option value="" className="bg-slate-950">
                  ALL MONTHS
                </option>
                {[
                  "January",
                  "February",
                  "March",
                  "April",
                  "May",
                  "June",
                  "July",
                  "August",
                  "September",
                  "October",
                  "November",
                  "December",
                ].map((monthName, idx) => {
                  const m = String(idx + 1).padStart(2, "0");
                  return (
                    <option key={m} value={m} className="bg-slate-950">
                      {monthName.toUpperCase()}
                    </option>
                  );
                })}
              </select>
            </div>

            <button
              onClick={() => {
                setIsAdding(true);
                setEditingId(null);
                setIsBatchEditing(false);
                setFormData({
                  effectiveMonth: new Date().toISOString().slice(0, 7),
                });
                setMatrixData({});
              }}
              className="bento-button-black flex items-center gap-3 py-2"
            >
              <Plus size={18} strokeWidth={3} />
              <span className="text-sm">DEFINE PRICE MATRIX</span>
            </button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {(isAdding || editingId) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="p-8 bento-card border-blue-500/30 mb-10 overflow-x-auto"
          >
            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border-2 border-red-500/50 rounded-2xl flex items-center gap-3 text-red-500 animate-in fade-in slide-in-from-top-2">
                <AlertCircle size={18} />
                <span className="text-sm uppercase tracking-widest">
                  {error}
                </span>
              </div>
            )}

            <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-8 flex items-center gap-4">
              <div className="h-10 w-10 bg-blue-600 rounded-xl flex items-center justify-center text-white border-2 border-slate-900 shadow-bento">
                <Edit2 size={20} />
              </div>
              {editingId
                ? "Edit Pricing Entry"
                : isBatchEditing
                  ? "Adjust Pricing Matrix"
                  : "Define New Pricing Matrix"}
            </h3>

            {editingId ? (
              <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
                <div>
                  <label className="label-base text-blue-400">
                    Effective Timeline
                  </label>
                  <input
                    type="month"
                    disabled={isSaving}
                    value={formData.effectiveMonth}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        effectiveMonth: e.target.value,
                      })
                    }
                    className="input-base"
                  />
                </div>
                <div>
                  <label className="label-base text-blue-400">
                    Module Type
                  </label>
                  <select
                    disabled={isSaving}
                    value={formData.packageTypeCode}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        packageTypeCode: e.target.value,
                      })
                    }
                    className="input-base cursor-pointer"
                  >
                    <option value="">SELECT TYPE</option>
                    {packageTypes.map((pt) => (
                      <option key={pt.id} value={pt.code}>
                        {pt.name} ({pt.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label-base text-blue-400">Slot Count</label>
                  <input
                    type="number"
                    disabled={isSaving}
                    value={formData.numSessions || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, numSessions: e.target.value })
                    }
                    className="input-base"
                    placeholder="1, 4, 8..."
                  />
                </div>
                <div>
                  <label className="label-base text-blue-400">Unit Value</label>
                  <input
                    type="number"
                    disabled={isSaving}
                    value={formData.sessionValue || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, sessionValue: e.target.value })
                    }
                    className="input-base"
                    placeholder="500"
                  />
                </div>
                <div>
                  <label className="label-base text-blue-400">
                    Average Cost / Hour
                  </label>
                  <input
                    type="number"
                    disabled={isSaving}
                    value={formData.sessionCost || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, sessionCost: e.target.value })
                    }
                    className="input-base border-red-500/20 focus:border-red-500"
                    placeholder="200"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-6 min-w-max">
                <div className="flex gap-4 items-end">
                  <div className="w-64">
                    <label className="label-base text-blue-400">
                      Effective Timeline (YYYY-MM)
                    </label>
                    <input
                      type="month"
                      disabled={isSaving || (editingId && isBatchEditing)}
                      value={formData.effectiveMonth || ""}
                      onChange={(e) => {
                        const newMonth = e.target.value;
                        setFormData((prev) => ({
                          ...prev,
                          effectiveMonth: newMonth,
                        }));

                        // Dynamically load data for the new month if it exists
                        const schemesForMonth = pricingSchemes.filter(
                          (s) => s.effectiveMonth === newMonth,
                        );
                        const existingGroup =
                          schemesForMonth.length > 0
                            ? {
                                month: newMonth,
                                data: schemesForMonth.reduce(
                                  (acc: any, s: any) => {
                                    if (!acc[s.numSessions])
                                      acc[s.numSessions] = {};
                                    acc[s.numSessions][s.packageTypeCode] = s;
                                    return acc;
                                  },
                                  {},
                                ),
                                slotCounts: Array.from(
                                  new Set(
                                    schemesForMonth.map((s) =>
                                      Number(s.numSessions),
                                    ),
                                  ),
                                ).sort((a: any, b: any) => a - b),
                              }
                            : null;
                        if (existingGroup) {
                          const newMatrixData: Record<
                            number,
                            Record<string, string>
                          > = {};
                          existingGroup.slotCounts.forEach((slots: number) => {
                            newMatrixData[slots] = {};
                            sortedPackageTypes.forEach((pt) => {
                              const scheme =
                                existingGroup.data[slots]?.[pt.code];
                              if (scheme) {
                                newMatrixData[slots][pt.code] = (
                                  scheme.sessionValue * scheme.numSessions
                                ).toString();
                              }
                            });
                          });
                          setMatrixData(newMatrixData);
                          setSlotCounts(existingGroup.slotCounts);
                        } else {
                          setMatrixData({});
                          setSlotCounts(defaultSlotCounts);
                        }
                      }}
                      className={cn(
                        "input-base",
                        editingId &&
                          isBatchEditing &&
                          "opacity-50 cursor-not-allowed",
                      )}
                    />
                  </div>
                  <div className="w-64">
                    <label className="label-base text-blue-400">
                      Average Cost / Hour
                    </label>
                    <input
                      type="number"
                      disabled={isSaving}
                      value={formData.sessionCost || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          sessionCost: e.target.value,
                        })
                      }
                      className="input-base border-red-500/20 focus:border-red-500"
                      placeholder="200"
                    />
                  </div>
                </div>
                <table className="w-full text-left border-collapse border border-slate-800">
                  <thead>
                    <tr className="bg-slate-900/80">
                      <th className="p-4 border border-slate-800 text-sm uppercase text-slate-400 tracking-widest font-black">
                        Slot Count
                      </th>
                      {sortedPackageTypes.map((pt) => (
                        <th
                          key={pt.id}
                          className="p-4 border border-slate-800 text-sm uppercase text-white tracking-widest font-black text-center"
                        >
                          {pt.name} ({pt.code})
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {slotCounts.map((slots) => (
                      <tr key={slots}>
                        <td className="p-4 border border-slate-800 bg-slate-900/30">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-yellow-500 font-bold text-lg md:text-xl uppercase">
                                {slots === 1 ? "Drop In" : `${slots} `}
                              </span>
                              {slots !== 1 && (
                                <span className="text-slate-400 text-xs md:text-sm tracking-widest lowercase ml-2">
                                  sessions/month
                                </span>
                              )}
                            </div>
                            {!defaultSlotCounts.includes(slots) && (
                              <button
                                onClick={() =>
                                  setSlotCounts((prev) =>
                                    prev.filter((s) => s !== slots),
                                  )
                                }
                                className="text-red-500 hover:text-red-400 transition-colors"
                              >
                                <X size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                        {sortedPackageTypes.map((pt) => {
                          const rawValStr = matrixData[slots]?.[pt.code];
                          const rawVal = parseFloat(rawValStr || "");
                          const unitPrice =
                            rawVal && !isNaN(rawVal) ? rawVal / slots : null;
                          return (
                            <td
                              key={pt.id}
                              className="p-2 border border-slate-800 bg-slate-950/50 relative"
                            >
                              <input
                                type="number"
                                className={cn(
                                  "w-full bg-transparent border-none text-center text-white font-mono text-lg md:text-xl focus:ring-0 focus:outline-none placeholder-slate-700",
                                  unitPrice !== null ? "pb-4 md:pb-5 pt-1" : "",
                                )}
                                placeholder="0"
                                value={matrixData[slots]?.[pt.code] || ""}
                                onChange={(e) =>
                                  handleMatrixChange(
                                    slots,
                                    pt.code,
                                    e.target.value,
                                  )
                                }
                                disabled={isSaving}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    <tr className="bg-slate-950/50">
                      <td
                        colSpan={sortedPackageTypes.length + 1}
                        className="p-4 border border-slate-800"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={newSlotCount}
                            onChange={(e) => setNewSlotCount(e.target.value)}
                            placeholder="Custom Sessions count..."
                            className="input-base max-w-[200px]"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                const val = parseInt(newSlotCount);
                                if (val && !slotCounts.includes(val)) {
                                  setSlotCounts((prev) =>
                                    [...prev, val].sort((a, b) => a - b),
                                  );
                                  setNewSlotCount("");
                                }
                              }
                            }}
                          />
                          <button
                            onClick={() => {
                              const val = parseInt(newSlotCount);
                              if (val && !slotCounts.includes(val)) {
                                setSlotCounts((prev) =>
                                  [...prev, val].sort((a, b) => a - b),
                                );
                                setNewSlotCount("");
                              }
                            }}
                            className="h-10 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl uppercase font-bold tracking-widest text-sm transition-colors"
                          >
                            Add Row
                          </button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end gap-3 mt-8">
              <button
                onClick={() => {
                  setIsAdding(false);
                  setEditingId(null);
                  setIsBatchEditing(false);
                  setMatrixData({});
                }}
                disabled={isSaving}
                className="px-6 py-3 text-sm text-slate-500 uppercase tracking-widest hover:text-white transition-colors disabled:opacity-50"
              >
                Abort
              </button>
              <button
                onClick={editingId ? handleSaveSingle : handleSaveMatrix}
                disabled={isSaving}
                className="bento-button-black bg-blue-600 text-white border-none min-w-[200px] disabled:opacity-50"
              >
                {isSaving ? (
                  <Clock className="animate-spin mx-auto" size={18} />
                ) : editingId ? (
                  "COMMIT CHANGES"
                ) : isBatchEditing ? (
                  "UPDATE PRICING MATRIX"
                ) : (
                  "EXECUTE PRICING BATCH"
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-12">
        {groupedSchemes.map((group) => (
          <div
            key={group.month}
            className="bg-slate-900 border-2 border-slate-800 rounded-3xl overflow-hidden shadow-bento"
          >
            <div className="bg-slate-950 p-6 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h3 className="text-xl md:text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                <span className="text-blue-500">Timeline /</span>
                {group.month === editingMonth ? (
                  <div className="flex gap-2">
                    <select
                      value={editMonth}
                      onChange={(e) => setEditMonth(e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded p-1 text-white"
                    >
                      {[
                        "01",
                        "02",
                        "03",
                        "04",
                        "05",
                        "06",
                        "07",
                        "08",
                        "09",
                        "10",
                        "11",
                        "12",
                      ].map((m) => (
                        <option key={m} value={m}>
                          {new Date(2000, parseInt(m) - 1)
                            .toLocaleString("default", { month: "short" })
                            .toUpperCase()}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={editYear}
                      onChange={(e) => setEditYear(e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded p-1 text-white w-20"
                    />
                  </div>
                ) : (
                  (() => {
                    const [y, m] = group.month.split("-");
                    return `${new Date(parseInt(y), parseInt(m) - 1).toLocaleString("default", { month: "short" }).toUpperCase()}-${y}`;
                  })()
                )}
              </h3>

              <div className="flex-1 flex justify-center">
                {(() => {
                  const sampleScheme = Object.values(
                    group.data[group.slotCounts[0]] || {},
                  )[0] as any;
                  const avgCost = sampleScheme?.sessionCost || 0;
                  return avgCost > 0 ? (
                    <div className="px-4 py-2 rounded-xl bg-red-500/5 border border-red-500/20 flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                      <p className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em]">
                        Avg. Cost / Hour: {formatCurrency(avgCost)}
                      </p>
                    </div>
                  ) : null;
                })()}
              </div>

              <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
                {!isReadOnly && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (editingMonth === group.month) {
                          handleSaveMatrix();
                        } else {
                          handleEditMatrix(group);
                        }
                      }}
                      className="relative text-[10px] md:text-xs text-blue-400 border border-blue-500/30 px-4 py-2 rounded-xl uppercase font-black tracking-widest hover:bg-blue-600 hover:text-white transition-all flex items-center gap-2 cursor-pointer z-[99] pointer-events-auto"
                    >
                      <Edit2 size={14} />
                      {editingMonth === group.month
                        ? "Save Matrix"
                        : "Edit Matrix"}
                    </button>
                    {confirmDeleteMatrixMonth === group.month ? (
                      <div className="flex bg-red-500/10 border border-red-500/30 rounded-xl overflow-hidden p-0.5">
                        <button
                          onClick={() => handleDeleteMatrix(group.month)}
                          disabled={isSaving}
                          className="px-3 py-1.5 text-[10px] font-black text-red-500 hover:bg-red-500 hover:text-white transition-all uppercase tracking-widest"
                        >
                          {isSaving ? (
                            <Clock size={10} className="animate-spin" />
                          ) : (
                            "Confirm"
                          )}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteMatrixMonth(null)}
                          className="px-2 py-1.5 text-slate-500 hover:text-slate-300 border-l border-red-500/20"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteMatrixMonth(group.month)}
                        className="text-[10px] md:text-xs text-red-500/60 border border-red-500/20 px-3 py-2 rounded-xl uppercase font-black tracking-widest hover:bg-red-500 hover:text-white transition-all flex items-center gap-2"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900/80">
                    <th className="p-4 border-b border-r border-slate-800 text-sm uppercase text-slate-400 tracking-widest font-black">
                      Slot Count
                    </th>
                    {sortedPackageTypes.map((pt) => (
                      <th
                        key={pt.id}
                        className="p-4 border-b border-slate-800 text-sm uppercase text-white tracking-widest font-black text-center"
                      >
                        {pt.name} ({pt.code})
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {group.slotCounts.map((slots, idx) => (
                    <tr
                      key={slots}
                      className={cn(
                        "hover:bg-slate-800/30 transition-colors",
                        idx !== group.slotCounts.length - 1
                          ? "border-b border-slate-800/50"
                          : "",
                      )}
                    >
                      <td className="p-4 border-r border-slate-800 bg-slate-900/30">
                        <span className="text-yellow-500 font-bold text-lg uppercase">
                          {slots === 1 ? "Drop In" : `${slots} `}
                        </span>
                        {slots !== 1 && (
                          <span className="text-slate-400 text-xs tracking-widest lowercase ml-2">
                            sess/mo
                          </span>
                        )}
                      </td>
                      {sortedPackageTypes.map((pt) => {
                        const scheme = group.data[slots]?.[pt.code];
                        return (
                          <td
                            key={pt.id}
                            className="p-4 border-slate-800 text-center relative group/cell"
                          >
                            {editingMonth === group.month ? (
                              <input
                                type="number"
                                value={
                                  matrixData[slots]?.[pt.code] ||
                                  (scheme
                                    ? scheme.sessionValue * scheme.numSessions
                                    : "")
                                }
                                onChange={(e) =>
                                  handleMatrixChange(
                                    slots,
                                    pt.code,
                                    e.target.value,
                                  )
                                }
                                className="w-full bg-slate-800 border border-slate-700 p-2 text-white text-center rounded"
                              />
                            ) : scheme ? (
                              <div>
                                <p className="text-xl font-mono font-bold text-white leading-none">
                                  {formatCurrency(
                                    scheme.sessionValue * scheme.numSessions,
                                  )}
                                </p>
                                <p className="text-[14px] font-black text-blue-400 uppercase tracking-tighter mt-1">
                                  {formatCurrency(scheme.sessionValue)} / sess
                                </p>
                                <div className="absolute inset-0 bg-slate-900/90 flex items-center justify-center gap-3 opacity-0 group-hover/cell:opacity-100 transition-opacity backdrop-blur-sm z-10">
                                  <button
                                    onClick={() => handleEdit(scheme)}
                                    className="text-slate-300 hover:text-white transition-colors bg-slate-800 p-2 rounded-lg"
                                  >
                                    <Edit2 size={16} />
                                  </button>
                                  {confirmDeleteId === scheme.id ? (
                                    <div className="flex bg-red-500/20 rounded-lg p-1">
                                      <button
                                        onClick={() => handleDelete(scheme.id!)}
                                        className="text-red-500 hover:text-red-400 px-2 font-bold text-xs uppercase"
                                      >
                                        Del
                                      </button>
                                      <button
                                        onClick={() => setConfirmDeleteId(null)}
                                        className="text-slate-400 hover:text-slate-300 px-2 border-l border-red-500/30"
                                      >
                                        <X size={14} />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() =>
                                        setConfirmDeleteId(scheme.id!)
                                      }
                                      className="text-red-500 hover:text-red-400 transition-colors bg-red-500/10 p-2 rounded-lg border border-red-500/20"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-600 font-mono">
                                -
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {(pricingSchemes || []).length === 0 && !isAdding && !editingId && (
        <div className="text-center py-20 bg-slate-900/50 rounded-[2.5rem] border-4 border-dashed border-slate-800 mt-6">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-[1rem] bg-slate-950 text-slate-700 border-2 border-slate-800 mb-4">
            <Info size={24} />
          </div>
          <p className="text-slate-500 font-black uppercase text-[10px] tracking-widest max-w-sm mx-auto leading-relaxed italic">
            VALUATION TABLE EMPTY. DEFINE SESSION VALUES TO ACTIVATE ECONOMIC
            FORECASTING.
          </p>
        </div>
      )}
    </div>
  );
}
