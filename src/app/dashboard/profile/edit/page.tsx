"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { api } from "~/trpc/react";
import { useUpload } from "~/lib/useUpload";
import { AvatarCropper } from "./AvatarCropper";
import { OnboardingToggle } from "./OnboardingToggle";

export default function EditProfilePage() {
  const router = useRouter();
  const { data: me, isLoading } = api.member.getMe.useQuery();
  const utils = api.useUtils();
  const { upload, isUploading: isUploadingAvatar, error: avatarUploadError } = useUpload();
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    bio: "",
    githubUsername: "",
    linkedinUrl: "",
    subTeam: "",
    graduationDate: "",
    birthday: "",
  });

  // Only seed the form the first time data arrives. Subsequent background
  // re-fetches update `me` (new object reference) which would otherwise
  // re-run this effect and wipe any unsaved edits.
  const formInitialized = useRef(false);
  useEffect(() => {
    if (me && !formInitialized.current) {
      formInitialized.current = true;
      setForm({
        name: me.name ?? "",
        phone: me.phone ?? "",
        bio: me.bio ?? "",
        githubUsername: me.githubUsername ?? "",
        linkedinUrl: me.linkedinUrl ?? "",
        subTeam: me.subTeam ?? "",
        graduationDate: me.graduationDate
          ? me.graduationDate.toISOString().slice(0, 10)
          : "",
        birthday: me.birthday
          ? me.birthday.toISOString().slice(0, 10)
          : "",
      });
    }
  }, [me]);

  const updateProfile = api.member.updateProfile.useMutation({
    onSuccess: async () => {
      await utils.member.getMe.invalidate();
      router.push(`/dashboard/members/${me?.id}`);
    },
  });

  async function handleCropConfirm(blob: Blob) {
    if (!me) return;
    setShowCropper(false);
    setPreviewImage(URL.createObjectURL(blob));
    const path = `${me.id}/${Date.now()}.jpg`;
    const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
    const result = await upload(file, { bucket: "avatars", path });
    if (!result) { setPreviewImage(null); return; }
    updateProfile.mutate({ image: result.publicUrl });
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateProfile.mutate({
      name: form.name || undefined,
      phone: form.phone || undefined,
      bio: form.bio || undefined,
      githubUsername: form.githubUsername || undefined,
      linkedinUrl: form.linkedinUrl || undefined,
      subTeam: form.subTeam || undefined,
      graduationDate: form.graduationDate
        ? new Date(form.graduationDate)
        : undefined,
      birthday: form.birthday ? new Date(form.birthday) : undefined,
    });
  }

  if (isLoading) {
    return (
      <div className="text-gray-400 text-sm">Loading profile...</div>
    );
  }

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Edit Profile</h1>
        <p className="text-gray-500 text-sm mt-1">
          Update your personal information.
        </p>
      </div>

      {me?.pendingEdit && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-medium">Changes pending admin approval</p>
          <p className="text-xs text-amber-600 mt-0.5">
            Submitted {new Date(me.pendingEdit.submittedAt).toLocaleString()}.
            Submitting again will replace the pending request.
          </p>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100"
      >
        {/* Avatar */}
        <div className="px-6 py-5 flex items-center gap-4">
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewImage ?? me?.image ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(me?.name ?? "?")}&background=dbeafe&color=1d4ed8`}
              alt="Avatar"
              className="w-16 h-16 rounded-full object-cover border border-gray-200"
            />
            {isUploadingAvatar && (
              <div className="absolute inset-0 rounded-full bg-black/30 flex items-center justify-center">
                <span className="text-white text-xs">…</span>
              </div>
            )}
          </div>
          <div>
            <button
              type="button"
              onClick={() => setShowCropper(true)}
              disabled={isUploadingAvatar}
              className="text-sm text-blue-600 hover:underline disabled:opacity-50"
            >
              {isUploadingAvatar ? "Uploading…" : "Change photo"}
            </button>
            <p className="text-xs text-gray-400 mt-0.5">Cropped to 512×512 px · max 5 MB</p>
            {avatarUploadError && (
              <p className="text-xs text-red-600 mt-0.5">{avatarUploadError}</p>
            )}
          </div>
        </div>

        {showCropper && (
          <AvatarCropper
            onConfirm={handleCropConfirm}
            onCancel={() => setShowCropper(false)}
          />
        )}

        <Section title="Basic Info">
          <Field
            label="Full Name"
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="Your full name"
          />
          <Field
            label="Phone"
            name="phone"
            value={form.phone}
            onChange={handleChange}
            placeholder="+52 81 1234 5678"
            type="tel"
          />
        </Section>

        <Section title="About">
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
              Bio
            </label>
            <textarea
              name="bio"
              value={form.bio}
              onChange={handleChange}
              rows={4}
              placeholder="Tell the team a bit about yourself..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </Section>

        <Section title="Team">
          <Field
            label="Sub-team / Competition"
            name="subTeam"
            value={form.subTeam}
            onChange={handleChange}
            placeholder="e.g. Home Service, RoboCup, RoboMed…"
          />
          <Field
            label="Graduation Date"
            name="graduationDate"
            value={form.graduationDate}
            onChange={handleChange}
            type="date"
          />
          <Field
            label="Birthday"
            name="birthday"
            value={form.birthday}
            onChange={handleChange}
            type="date"
          />
        </Section>

        <Section title="Links">
          <Field
            label="GitHub Username"
            name="githubUsername"
            value={form.githubUsername}
            onChange={handleChange}
            placeholder="octocat"
            prefix="github.com/"
          />
          <Field
            label="LinkedIn URL"
            name="linkedinUrl"
            value={form.linkedinUrl}
            onChange={handleChange}
            placeholder="https://linkedin.com/in/yourprofile"
            type="url"
          />
        </Section>

        {/* Actions */}
        <div className="flex items-center justify-between px-6 py-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={updateProfile.isPending}
            className="rounded-lg bg-[#1a2744] text-white text-sm font-medium px-5 py-2 hover:bg-[#243660] disabled:opacity-50 transition-colors"
          >
            {updateProfile.isPending ? "Saving…" : "Save Changes"}
          </button>
        </div>

        {updateProfile.error && (
          <p className="px-6 pb-4 text-sm text-red-600">
            {updateProfile.error.message}
          </p>
        )}
      </form>

      <ApiKeySection />
      <MicrosoftSection
        connected={me?.microsoftConnected ?? false}
        onDisconnect={() => void utils.member.getMe.invalidate()}
      />
      <div className="mt-6 bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-6 py-5 border-b border-gray-100">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
            Onboarding
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Show or hide the onboarding checklist on your dashboard.
          </p>
        </div>
        <div className="px-6 py-5">
          <OnboardingToggle />
        </div>
      </div>
    </div>
  );
}

function ApiKeySection() {
  const utils = api.useUtils();
  const { data: keyInfo, isLoading } = api.apiKey.getInfo.useQuery();
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generate = api.apiKey.generate.useMutation({
    onSuccess: (data) => {
      setNewToken(data.token);
      void utils.apiKey.getInfo.invalidate();
    },
  });

  const revoke = api.apiKey.revoke.useMutation({
    onSuccess: () => {
      setNewToken(null);
      void utils.apiKey.getInfo.invalidate();
    },
  });

  async function copyToken() {
    if (!newToken) return;
    await navigator.clipboard.writeText(newToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mt-6 bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="px-6 py-5 border-b border-gray-100">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
          API Key
        </p>
        <p className="text-sm text-gray-500 mt-1">
          Use your API key to access the MCP server at{" "}
          <code className="bg-gray-100 px-1 rounded text-xs">/api/mcp</code>.
          Keys expire 3 hours after generation.
        </p>
      </div>

      <div className="px-6 py-5 space-y-4">
        {isLoading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : keyInfo ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span className={`w-2 h-2 rounded-full ${keyInfo.isExpired ? "bg-red-400" : "bg-green-400"}`} />
              <span className="text-gray-700">
                {keyInfo.isExpired ? "Expired" : "Active"} — expires{" "}
                {new Date(keyInfo.expiresAt).toLocaleString()}
              </span>
            </div>
            {keyInfo.lastUsedAt && (
              <p className="text-xs text-gray-400">
                Last used: {new Date(keyInfo.lastUsedAt).toLocaleString()}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No API key generated yet.</p>
        )}

        {newToken && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
            <p className="text-xs font-medium text-amber-800">
              Copy your key now — it won&apos;t be shown again.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-white border border-amber-200 rounded px-2 py-1.5 break-all font-mono">
                {newToken}
              </code>
              <button
                onClick={copyToken}
                className="shrink-0 text-xs px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => {
              setNewToken(null);
              generate.mutate();
            }}
            disabled={generate.isPending}
            className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {generate.isPending
              ? "Generating…"
              : keyInfo
                ? "Regenerate Key"
                : "Generate Key"}
          </button>
          {keyInfo && (
            <button
              onClick={() => revoke.mutate()}
              disabled={revoke.isPending}
              className="text-sm px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              {revoke.isPending ? "Revoking…" : "Revoke"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function MicrosoftSection({
  connected,
  onDisconnect,
}: {
  connected: boolean;
  onDisconnect: () => void;
}) {
  const searchParams = useSearchParams();
  const msConnected = searchParams.get("ms_connected") === "1";
  const msError = searchParams.get("ms_error");
  const [disconnecting, setDisconnecting] = useState(false);

  async function handleDisconnect() {
    setDisconnecting(true);
    await fetch("/api/auth/microsoft/disconnect", { method: "DELETE" });
    setDisconnecting(false);
    onDisconnect();
  }

  return (
    <div className="mt-6 bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="px-6 py-5 border-b border-gray-100">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
          Microsoft Integration
        </p>
        <p className="text-sm text-gray-500 mt-1">
          Connect your Microsoft account to create Teams meetings and Outlook
          calendar events directly from the attendance page.
        </p>
      </div>

      <div className="px-6 py-5 space-y-3">
        {msConnected && (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            Microsoft account connected successfully.
          </p>
        )}
        {msError && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            Microsoft connection failed: {msError}
          </p>
        )}

        {connected ? (
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-sm text-gray-700">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              Microsoft account connected
            </span>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="text-sm px-4 py-1.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              {disconnecting ? "Disconnecting…" : "Disconnect"}
            </button>
          </div>
        ) : (
          <button
            onClick={() => { window.location.href = "/api/auth/microsoft"; }}
            className="inline-block text-sm px-4 py-2 bg-[#0078d4] text-white rounded-lg hover:bg-[#106ebe] transition-colors"
          >
            Connect Microsoft Account
          </button>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-6 py-5 space-y-4">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
        {title}
      </p>
      {children}
    </div>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  placeholder,
  type = "text",
  prefix,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
  prefix?: string;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5"
      >
        {label}
      </label>
      <div className={`flex rounded-lg border border-gray-300 focus-within:ring-2 focus-within:ring-blue-500 overflow-hidden`}>
        {prefix && (
          <span className="flex items-center px-3 bg-gray-50 text-gray-400 text-sm border-r border-gray-300 select-none">
            {prefix}
          </span>
        )}
        <input
          id={name}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 text-sm focus:outline-none bg-white"
        />
      </div>
    </div>
  );
}
