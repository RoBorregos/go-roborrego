"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { api, type RouterOutputs } from "~/trpc/react";

type Member = RouterOutputs["member"]["getById"];

export function EditMemberForm({ member }: { member: Member }) {
  const router = useRouter();
  const utils = api.useUtils();

  const [form, setForm] = useState({
    name: member.name ?? "",
    role: member.role,
    status: member.status,
    subTeam: member.subTeam ?? "",
    phone: member.phone ?? "",
    bio: member.bio ?? "",
    githubUsername: member.githubUsername ?? "",
    linkedinUrl: member.linkedinUrl ?? "",
    graduationDate: member.graduationDate
      ? new Date(member.graduationDate).toISOString().slice(0, 10)
      : "",
    birthday: member.birthday
      ? new Date(member.birthday).toISOString().slice(0, 10)
      : "",
    // Web export
    webId: member.webId !== null ? String(member.webId) : "",
    lastname: member.lastname ?? "",
    classYear: member.classYear !== null ? String(member.classYear) : "",
    subtitle: member.subtitle ?? "",
    semesters: member.semesters !== null ? String(member.semesters) : "",
    tags: member.tags ?? "",
    excludeFromExport: member.excludeFromExport,
  });

  const updateMember = api.member.updateMember.useMutation({
    onSuccess: async () => {
      await utils.member.getById.invalidate({ id: member.id });
      void utils.member.getRoster.invalidate();
      router.push(`/dashboard/members/${member.id}`);
    },
  });

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateMember.mutate({
      id: member.id,
      name: form.name || undefined,
      role: form.role as "VIEWER" | "MEMBER" | "ADMIN",
      status: form.status as "ACTIVE" | "INACTIVE" | "ALUMNI",
      subTeam: form.subTeam || undefined,
      phone: form.phone || undefined,
      bio: form.bio || undefined,
      githubUsername: form.githubUsername || undefined,
      linkedinUrl: form.linkedinUrl || undefined,
      graduationDate: form.graduationDate ? new Date(form.graduationDate) : undefined,
      birthday: form.birthday ? new Date(form.birthday) : undefined,
      webId: form.webId ? parseInt(form.webId, 10) : undefined,
      lastname: form.lastname || undefined,
      subtitle: form.subtitle || undefined,
      semesters: form.semesters ? parseInt(form.semesters, 10) : undefined,
      tags: form.tags || undefined,
      excludeFromExport: form.excludeFromExport,
      classYear: form.classYear ? parseInt(form.classYear, 10) : undefined,
    });
  }

  return (
    <>
      <div className="mb-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm text-blue-600 hover:underline mb-3 inline-block"
        >
          ← Back
        </button>
        <div className="flex items-center gap-3">
          {member.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={member.image}
              alt=""
              className="w-10 h-10 rounded-full"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-blue-600 font-semibold">
                {member.name?.charAt(0) ?? "?"}
              </span>
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold text-gray-900">{member.name}</h1>
            <p className="text-sm text-gray-500">{member.email}</p>
          </div>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100"
      >
        {/* Admin-only: role & status */}
        <Section title="Access">
          <div className="grid grid-cols-2 gap-4">
            <SelectField
              label="Role"
              name="role"
              value={form.role}
              onChange={handleChange}
              options={[
                { value: "VIEWER", label: "Viewer" },
                { value: "MEMBER", label: "Member" },
                { value: "ADMIN", label: "Admin" },
              ]}
            />
            <SelectField
              label="Status"
              name="status"
              value={form.status}
              onChange={handleChange}
              options={[
                { value: "ACTIVE", label: "Active" },
                { value: "INACTIVE", label: "Inactive" },
                { value: "ALUMNI", label: "Alumni" },
              ]}
            />
          </div>
        </Section>

        {/* Basic info */}
        <Section title="Basic Info">
          <Field
            label="Full Name"
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="Full name"
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

        {/* About */}
        <Section title="About">
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
              Bio
            </label>
            <textarea
              name="bio"
              value={form.bio}
              onChange={handleChange}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </Section>

        {/* Team */}
        <Section title="Team">
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Sub-team / Competition"
              name="subTeam"
              value={form.subTeam}
              onChange={handleChange}
              placeholder="e.g. Home Service, RoboCup…"
            />
            <Field
              label="Class Year"
              name="classYear"
              value={form.classYear}
              onChange={handleChange}
              placeholder="e.g. 2022"
              type="number"
            />
          </div>
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

        {/* Links */}
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

        {/* Web Export */}
        <Section title="Web Export">
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Web ID"
              name="webId"
              value={form.webId}
              onChange={handleChange}
              placeholder="Auto-assigned on export"
              type="number"
            />
            <Field
              label="Last Name"
              name="lastname"
              value={form.lastname}
              onChange={handleChange}
              placeholder="Auto-split from full name"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Subtitle"
              name="subtitle"
              value={form.subtitle}
              onChange={handleChange}
              placeholder="e.g. Alumni, Founder & Alumni"
            />
            <Field
              label="Semesters"
              name="semesters"
              value={form.semesters}
              onChange={handleChange}
              placeholder="Number of semesters"
              type="number"
            />
          </div>
          <Field
            label="Tags"
            name="tags"
            value={form.tags}
            onChange={handleChange}
            placeholder="Comma-separated: Programmer, Software, Alumni"
          />
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.excludeFromExport}
              onChange={(e) => setForm((prev) => ({ ...prev, excludeFromExport: e.target.checked }))}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Exclude from web export</span>
          </label>
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
            disabled={updateMember.isPending}
            className="rounded-lg bg-[#1a2744] text-white text-sm font-medium px-5 py-2 hover:bg-[#243660] disabled:opacity-50 transition-colors"
          >
            {updateMember.isPending ? "Saving…" : "Save Changes"}
          </button>
        </div>

        {updateMember.error && (
          <p className="px-6 pb-4 text-sm text-red-600">
            {updateMember.error.message}
          </p>
        )}
      </form>
    </>
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
      <div className="flex rounded-lg border border-gray-300 focus-within:ring-2 focus-within:ring-blue-500 overflow-hidden">
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

function SelectField({
  label,
  name,
  value,
  onChange,
  options,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5"
      >
        {label}
      </label>
      <select
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
