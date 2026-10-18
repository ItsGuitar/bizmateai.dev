"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/app/components/AppHeader";
import { SearchableSelect } from "@/app/components/SearchableSelect";
import { Toast } from "@/app/components/Toast";
import { getSession, updateSessionUser, AuthUser } from "@/lib/auth-client";
import { BUSINESS_TYPES } from "@/app/data/business-types";
import { COUNTRIES } from "@/app/data/countries";
import { SALES_CHANNELS } from "@/app/data/sales-channels";

const MONTHLY_SALES_RANGES = [
  "Under ฿50,000",
  "฿50,000 - ฿100,000",
  "฿100,000 - ฿500,000",
  "฿500,000 - ฿1,000,000",
  "Over ฿1,000,000",
];
const CURRENT_YEAR = new Date().getFullYear();
const TRADING_SINCE_YEARS = Array.from({ length: CURRENT_YEAR - 1949 }, (_, i) => CURRENT_YEAR - i);

export default function AccountPage() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);

  // Business profile form state
  const [businessName, setBusinessName] = useState("");
  const [juristicId, setJuristicId] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [tradingSince, setTradingSince] = useState("");
  const [whatYouSell, setWhatYouSell] = useState("");
  const [whereYouSell, setWhereYouSell] = useState<string[]>([]);
  const [mainSupplierCountry, setMainSupplierCountry] = useState("");
  const [monthlySalesRange, setMonthlySalesRange] = useState("");

  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Password form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Toast popup state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Developer reset state
  const [isResetArmed, setIsResetArmed] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  useEffect(() => {
    const session = getSession();
    if (!session?.user) {
      router.replace("/login");
      return;
    }
    setUser(session.user);
    setBusinessName(session.user.businessName || "");

    (async () => {
      try {
        const res = await fetch("/api/business-profile", {
          headers: { Authorization: `Bearer ${session.token}` },
        });
        const data = await res.json();
        const profile = data?.profile;
        if (profile) {
          setBusinessName(profile.businessName || "");
          setJuristicId(profile.juristicId || "");
          setBusinessType(profile.businessType || "");
          setTradingSince(profile.tradingSince ? String(profile.tradingSince) : "");
          setWhatYouSell(profile.whatYouSell || "");
          setWhereYouSell(profile.whereYouSell || []);
          setMainSupplierCountry(profile.mainSupplierCountry || "");
          setMonthlySalesRange(profile.monthlySalesRange || "");
        }
      } catch (err) {
        console.error("Failed to load business profile:", err);
      } finally {
        setIsChecking(false);
      }
    })();
  }, [router]);

  const toggleChannel = (channel: string) => {
    setWhereYouSell((prev) =>
      prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel]
    );
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);

    const cleanName = businessName.trim();
    if (!cleanName) {
      setProfileError("Please enter your business name.");
      return;
    }

    if (juristicId && !/^\d{13}$/.test(juristicId.trim())) {
      setProfileError("Juristic ID must be exactly 13 digits.");
      return;
    }

    if (!businessType) {
      setProfileError("Please select the type of business.");
      return;
    }

    if (!whatYouSell.trim()) {
      setProfileError("Please tell us what you sell.");
      return;
    }

    if (whereYouSell.length === 0) {
      setProfileError("Please select at least one place where you sell.");
      return;
    }

    if (!monthlySalesRange) {
      setProfileError("Please select your approximate monthly sales.");
      return;
    }

    setIsProfileLoading(true);

    try {
      const session = getSession();
      const res = await fetch("/api/business-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.token}`,
        },
        body: JSON.stringify({
          businessName: cleanName,
          juristicId: juristicId.trim() || null,
          businessType,
          tradingSince: tradingSince ? parseInt(tradingSince, 10) : null,
          whatYouSell: whatYouSell.trim(),
          whereYouSell,
          mainSupplierCountry: mainSupplierCountry.trim() || null,
          monthlySalesRange,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setProfileError(data.error || "Failed to save your business details. Please try again.");
        setIsProfileLoading(false);
        return;
      }

      // The API keeps User.businessName in sync server-side, but the cached session in
      // localStorage from login does not auto-refresh. Patch it here so the header, the
      // dashboard greeting, and the profile menu show the new name immediately.
      updateSessionUser({ businessName: cleanName });
      setUser((prev) => (prev ? { ...prev, businessName: cleanName } : prev));

      setToastMessage("Business details saved.");
      setIsProfileLoading(false);
    } catch (err) {
      console.error("Business profile save error:", err);
      setProfileError("Failed to reach the server. Please check your network.");
      setIsProfileLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (!currentPassword) {
      setPasswordError("Please enter your current password.");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }

    setIsPasswordLoading(true);

    try {
      const session = getSession();
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setPasswordError(data.error || "Failed to change password. Please try again.");
        setIsPasswordLoading(false);
        return;
      }

      setToastMessage("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setIsPasswordLoading(false);
    } catch (err) {
      console.error("Change password error:", err);
      setPasswordError("Failed to reach the server. Please check your network.");
      setIsPasswordLoading(false);
    }
  };

  const handleDevReset = async () => {
    if (!isResetArmed) {
      setIsResetArmed(true);
      return;
    }

    setResetError(null);
    setIsResetting(true);

    try {
      const session = getSession();
      const res = await fetch("/api/business-profile", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session?.token}` },
      });

      if (!res.ok) {
        const data = await res.json();
        setResetError(data.error || "Failed to reset account data.");
        setIsResetting(false);
        setIsResetArmed(false);
        return;
      }

      router.push("/onboarding");
    } catch (err) {
      console.error("Developer reset error:", err);
      setResetError("Failed to reach the server. Please check your network.");
      setIsResetting(false);
      setIsResetArmed(false);
    }
  };

  if (isChecking) {
    return null;
  }

  const inputClass =
    "w-full px-3 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all placeholder:text-slate-400 disabled:opacity-50";
  const labelClass =
    "block text-[11px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1";
  const displayName = user?.businessName || user?.email?.split("@")[0] || "Account";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      <AppHeader user={user} />

      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="mb-8 animate-fade-in-up">
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Account Settings
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Update your business details and account security.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-8">
          {/* LEFT: Sidebar summary + section nav */}
          <aside className="lg:sticky lg:top-24 lg:self-start space-y-4 animate-fade-in-up">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-500 text-white font-bold text-base flex items-center justify-center shadow-sm shrink-0">
                {displayName.trim().charAt(0).toUpperCase() || "U"}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{displayName}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{user?.email}</p>
              </div>
            </div>

            <nav className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2 flex lg:flex-col gap-1 overflow-x-auto">
              <a
                href="#business-profile"
                className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap"
              >
                Business Profile
              </a>
              <a
                href="#security"
                className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap"
              >
                Security
              </a>
              <a
                href="#danger-zone"
                className="px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors whitespace-nowrap"
              >
                Danger Zone
              </a>
            </nav>
          </aside>

          {/* RIGHT: Content */}
          <div className="space-y-8 min-w-0">
            {/* Business Profile Section */}
            <form
              id="business-profile"
              onSubmit={handleProfileSubmit}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs p-5 sm:p-8 space-y-5 animate-fade-in-up delay-100 scroll-mt-24"
            >
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Business Profile</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Keep this accurate so the agents compare you with the right lenders.
                </p>
              </div>

              {profileError && (
                <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/80 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                  <span className="shrink-0 text-sm">⚠️</span>
                  <span>{profileError}</span>
                </div>
              )}

              {/* Email (read-only) */}
              <div>
                <label className={labelClass}>Work email</label>
                <input
                  type="text"
                  disabled
                  value={user?.email || ""}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-sm cursor-not-allowed"
                />
              </div>

              {/* Business Name + Juristic ID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Business name</label>
                  <input
                    type="text"
                    required
                    disabled={isProfileLoading}
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Ploy Select Co., Ltd."
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Juristic ID (13 digits)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={13}
                    disabled={isProfileLoading}
                    value={juristicId}
                    onChange={(e) => setJuristicId(e.target.value.replace(/\D/g, ""))}
                    placeholder="0105564012345"
                    className={`${inputClass} font-mono`}
                  />
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                    We verify this with your business registry.
                  </p>
                </div>
              </div>

              {/* Type of Business + Trading Since */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Type of business</label>
                  <select
                    required
                    disabled={isProfileLoading}
                    value={businessType}
                    onChange={(e) => setBusinessType(e.target.value)}
                    className={`${inputClass} cursor-pointer`}
                  >
                    <option value="" disabled>
                      Select type
                    </option>
                    {BUSINESS_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Trading since</label>
                  <select
                    disabled={isProfileLoading}
                    value={tradingSince}
                    onChange={(e) => setTradingSince(e.target.value)}
                    className={`${inputClass} cursor-pointer`}
                  >
                    <option value="">Select a year</option>
                    {TRADING_SINCE_YEARS.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* What do you make + Main Suppliers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>What do you make?</label>
                  <input
                    type="text"
                    required
                    disabled={isProfileLoading}
                    value={whatYouSell}
                    onChange={(e) => setWhatYouSell(e.target.value)}
                    placeholder="e.g. Precision metal parts for automotive buyers"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Main material suppliers are in</label>
                  <SearchableSelect
                    options={COUNTRIES}
                    value={mainSupplierCountry}
                    onChange={setMainSupplierCountry}
                    placeholder="Search for a country..."
                    disabled={isProfileLoading}
                  />
                </div>
              </div>

              {/* Who do you sell to */}
              <div>
                <label className={`${labelClass} mb-2`}>Who do you sell to?</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {SALES_CHANNELS.map((channel) => {
                    const checked = whereYouSell.includes(channel);
                    return (
                      <label
                        key={channel}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-xs font-medium cursor-pointer transition-colors ${
                          checked
                            ? "bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300"
                            : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900"
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={isProfileLoading}
                          checked={checked}
                          onChange={() => toggleChannel(channel)}
                          className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500/40 cursor-pointer"
                        />
                        <span>{channel}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Monthly Sales */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Monthly sales (about)</label>
                  <select
                    required
                    disabled={isProfileLoading}
                    value={monthlySalesRange}
                    onChange={(e) => setMonthlySalesRange(e.target.value)}
                    className={`${inputClass} cursor-pointer`}
                  >
                    <option value="" disabled>
                      Select a range
                    </option>
                    {MONTHLY_SALES_RANGES.map((range) => (
                      <option key={range} value={range}>
                        {range}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="hidden sm:block" />
              </div>

              <button
                type="submit"
                disabled={isProfileLoading}
                className="w-full sm:w-auto py-3 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {isProfileLoading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save changes</span>
                )}
              </button>
            </form>

            {/* Change Password Section */}
            <form
              id="security"
              onSubmit={handlePasswordSubmit}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs p-5 sm:p-8 space-y-5 animate-fade-in-up delay-200 scroll-mt-24"
            >
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Change Password</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Use a strong password you don&apos;t use anywhere else.
                </p>
              </div>

              {passwordError && (
                <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/80 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                  <span className="shrink-0 text-sm">⚠️</span>
                  <span>{passwordError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className={labelClass}>Current password</label>
                  <input
                    type="password"
                    required
                    disabled={isPasswordLoading}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>New password</label>
                  <input
                    type="password"
                    required
                    disabled={isPasswordLoading}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Confirm new password</label>
                  <input
                    type="password"
                    required
                    disabled={isPasswordLoading}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className={inputClass}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isPasswordLoading}
                className="w-full sm:w-auto py-3 px-6 rounded-xl bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold text-sm shadow-md transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {isPasswordLoading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    <span>Updating...</span>
                  </>
                ) : (
                  <span>Update password</span>
                )}
              </button>
            </form>

            {/* Danger Zone: Developer Reset */}
            <div
              id="danger-zone"
              className="bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/60 rounded-3xl p-5 sm:p-8 space-y-3 animate-fade-in-up delay-300 scroll-mt-24"
            >
              <div>
                <h2 className="text-sm font-bold text-rose-700 dark:text-rose-300">Danger Zone</h2>
                <p className="text-xs text-rose-600/80 dark:text-rose-400/80 mt-0.5">
                  Wipes all account data (business profile and related records) and sends you back to
                  onboarding. This cannot be undone.
                </p>
              </div>

              {resetError && (
                <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/80 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                  <span className="shrink-0 text-sm">⚠️</span>
                  <span>{resetError}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleDevReset}
                disabled={isResetting}
                className={`w-full sm:w-auto py-2.5 px-6 rounded-xl font-mono font-bold text-xs uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50 ${
                  isResetArmed
                    ? "bg-rose-600 hover:bg-rose-700 text-white"
                    : "bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-800/80 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/40"
                }`}
              >
                {isResetting
                  ? "Wiping data..."
                  : isResetArmed
                  ? "Click again to confirm: this wipes everything"
                  : "⚡ Developer Reset"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <Toast message={toastMessage} onDone={() => setToastMessage(null)} />
    </div>
  );
}
