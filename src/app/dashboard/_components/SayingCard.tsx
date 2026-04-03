"use client";

import { useState } from "react";
import { api } from "~/trpc/react";

function YearPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const currentYear = new Date().getFullYear();
  const years = Array.from(
    { length: currentYear - 2015 + 1 },
    (_, i) => currentYear - i,
  );
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
    >
      {years.map((y) => (
        <option key={y} value={String(y)}>
          {y}
        </option>
      ))}
    </select>
  );
}

const SERIOUS_EMOJIS = ["🏆", "🧠", "🎯", "🎓", "🏅", "🤝", "💡", "🤖", "🦾"];
const FUN_EMOJIS = [
  "🚀",
  "🧀",
  "🧐",
  "😤",
  "🫣",
  "😮‍💨",
  "🧐",
  "🥸",
  "🫡",
  "🔥",
  "🗣️",
  "🥀",
  "🤑",
];

function randomEmoji(isSerious: boolean, exclude?: string): string {
  const pool = (isSerious ? SERIOUS_EMOJIS : FUN_EMOJIS).filter(
    (e) => e !== exclude,
  );
  return pool[Math.floor(Math.random() * pool.length)]!;
}

export function SayingCard({ isMember }: { isMember: boolean }) {
  const { data: sayings = [], isLoading } = api.saying.listApproved.useQuery();
  const utils = api.useUtils();

  const [index, setIndex] = useState(0);
  const [emoji, setEmoji] = useState("");
  const [showSubmit, setShowSubmit] = useState(false);

  const [text, setText] = useState("");
  const [explanation, setExplanation] = useState("");
  const [date, setDate] = useState(() => String(new Date().getFullYear()));
  const [isSerious, setIsSerious] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const submitMutation = api.saying.submit.useMutation({
    onSuccess: () => {
      void utils.saying.listApproved.invalidate();
      setText("");
      setExplanation("");
      setDate(String(new Date().getFullYear()));
      setIsSerious(false);
      setSubmitError("");
      setSubmitted(true);
      setTimeout(() => {
        setShowSubmit(false);
        setSubmitted(false);
      }, 2000);
    },
    onError: (e) => setSubmitError(e.message),
  });

  const saying = sayings[index % Math.max(sayings.length, 1)];

  function reroll() {
    const nextIndex = sayings.length > 1 ? (index + 1) % sayings.length : index;
    const nextSaying = sayings[nextIndex];
    setIndex(nextIndex);
    setEmoji((e) => randomEmoji(nextSaying?.isSerious ?? false, e));
  }

  // Sync emoji when saying changes (e.g. on first load)
  if (saying && !emoji) {
    setEmoji(randomEmoji(saying.isSerious));
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      {isLoading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : !saying ? (
        <p className="text-sm text-gray-400 italic">
          No sayings yet. Be the first to add one 👀
        </p>
      ) : (
        <div className="flex items-start gap-3">
          <div className="flex shrink-0 flex-col items-center gap-1">
            <span className="text-2xl select-none">{emoji}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start">
              <p className="text-sm leading-relaxed font-medium text-gray-900">
                &ldquo;{saying.text}&rdquo;
              </p>
              {saying.explanation && (
                <div className="group relative ml-2 self-center">
                  <span className="flex h-4 w-4 cursor-default items-center justify-center rounded-full bg-gray-200 text-[10px] font-bold text-gray-500 select-none">
                    ?
                  </span>
                  <div className="absolute top-0 left-5 z-10 hidden w-56 rounded-lg border border-gray-200 bg-white p-2.5 text-xs leading-relaxed text-gray-600 shadow-lg group-hover:block">
                    {saying.explanation}
                  </div>
                </div>
              )}
            </div>
            <p className="mt-1.5 text-xs text-gray-400">
              {new Date(saying.date).getFullYear()}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {sayings.length > 1 && (
              <button
                onClick={reroll}
                title="Reroll"
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50"
              >
                ↺
              </button>
            )}
            {isMember && (
              <button
                onClick={() => setShowSubmit(true)}
                title="Add Saying"
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1a2744] text-white transition-colors hover:bg-[#243660]"
              >
                +
              </button>
            )}
          </div>
        </div>
      )}

      {/* Submit modal */}
      {showSubmit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-base font-semibold text-gray-900">
              Add a Saying
            </h2>

            {submitted ? (
              <p className="py-4 text-center text-sm font-medium text-green-600">
                Added ✓
              </p>
            ) : (
              <>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    Saying *
                  </label>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={3}
                    autoFocus
                    maxLength={500}
                    className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="Enter the saying…"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    Explanation (optional)
                  </label>
                  <textarea
                    value={explanation}
                    onChange={(e) => setExplanation(e.target.value)}
                    rows={2}
                    maxLength={1000}
                    className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="Context or meaning…"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    Date *
                  </label>
                  <YearPicker value={date} onChange={setDate} />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-gray-700">
                    Tone
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsSerious((v) => !v)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${isSerious ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-yellow-300 bg-yellow-50 text-yellow-700"}`}
                  >
                    {isSerious ? "🧠 Serious" : "🎮 Fun"}
                  </button>
                </div>
                {submitError && (
                  <p className="text-xs text-red-600">{submitError}</p>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setShowSubmit(false);
                      setText("");
                      setExplanation("");
                      setDate(String(new Date().getFullYear()));
                      setIsSerious(false);
                      setSubmitError("");
                    }}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 transition-colors hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (!text.trim()) return;
                      submitMutation.mutate({
                        text: text.trim(),
                        explanation: explanation.trim() || undefined,
                        date: new Date(`${date}-06-01`),
                        isSerious,
                      });
                    }}
                    disabled={submitMutation.isPending || !text.trim()}
                    className="rounded-lg bg-[#1a2744] px-3 py-1.5 text-xs text-white transition-colors hover:bg-[#243660] disabled:opacity-50"
                  >
                    {submitMutation.isPending
                      ? "Submitting…"
                      : "Submit for Review"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
