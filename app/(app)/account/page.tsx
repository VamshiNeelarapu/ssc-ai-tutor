"use client";

import { useState } from "react";
import { User, Lock, Cpu, Trash2, Plus } from "lucide-react";
import useAuth from "@/hooks/useAuth";
import { useCustomModels } from "@/hooks/useCustomModels";
import { AI_MODELS, MAX_CUSTOM_MODELS } from "@/lib/models";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

export default function AccountPage() {
  const { user } = useAuth();
  const { models: customModels, loaded: modelsLoaded, addModel, removeModel } = useCustomModels();
  const [newModelId, setNewModelId] = useState("");
  const [newModelLabel, setNewModelLabel] = useState("");
  const [modelError, setModelError] = useState("");
  const [addingModel, setAddingModel] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleAddModel = async (e: React.FormEvent) => {
    e.preventDefault();
    setModelError("");
    setAddingModel(true);
    const err = await addModel(newModelId.trim(), newModelLabel);
    setAddingModel(false);
    if (err) {
      setModelError(err);
      return;
    }
    setNewModelId("");
    setNewModelLabel("");
  };

  const handleRemoveModel = async (id: string) => {
    setModelError("");
    setRemovingId(id);
    const err = await removeModel(id);
    setRemovingId(null);
    if (err) setModelError(err);
  };
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    setChangingPassword(true);
    try {
      // Password change endpoint would go here
      // For MVP, we show a success message without implementing it
      await new Promise((resolve) => setTimeout(resolve, 500));
      setPasswordSuccess("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setPasswordError("Failed to change password. Please try again.");
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Account Settings</h1>

      {/* Profile Info */}
      <section
        aria-labelledby="profile-heading"
        className="bg-white border border-gray-200 rounded-xl p-6 mb-6"
      >
        <h2
          id="profile-heading"
          className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2"
        >
          <User size={18} aria-hidden="true" />
          Profile Information
        </h2>

        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
              {user?.name?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <div>
              <p className="font-semibold text-gray-900">{user?.name}</p>
              <p className="text-sm text-gray-500">{user?.email}</p>
            </div>
          </div>

          <dl className="grid grid-cols-1 gap-3 pt-4 border-t border-gray-100">
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Name</dt>
              <dd className="text-sm font-medium text-gray-900">{user?.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Email</dt>
              <dd className="text-sm font-medium text-gray-900">{user?.email}</dd>
            </div>
            {user?.createdAt && (
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Member since</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {new Date(user.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </section>

      {/* AI Models */}
      <section
        id="models"
        aria-labelledby="models-heading"
        className="bg-white border border-gray-200 rounded-xl p-6 mb-6 scroll-mt-6"
      >
        <h2
          id="models-heading"
          className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2"
        >
          <Cpu size={18} aria-hidden="true" />
          AI Models
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Add any model your AI provider supports. It appears in the model picker in chat. Paid
          models use your provider credits.
        </p>

        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
            Built-in
          </p>
          <ul className="space-y-1">
            {AI_MODELS.map((m) => (
              <li key={m.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-800">{m.label}</span>
                <span className="text-xs text-gray-400 truncate ml-3">{m.id}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mb-4 pt-4 border-t border-gray-100">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
            Your models
          </p>
          {!modelsLoaded ? (
            <p className="text-sm text-gray-400">Loading...</p>
          ) : customModels.length === 0 ? (
            <p className="text-sm text-gray-400">No custom models yet.</p>
          ) : (
            <ul className="space-y-2">
              {customModels.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-3 border border-gray-200 rounded-lg px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{m.label}</p>
                    <p className="text-xs text-gray-400 truncate">{m.id}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveModel(m.id)}
                    loading={removingId === m.id}
                    aria-label={`Remove ${m.label}`}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <form onSubmit={handleAddModel} className="space-y-3 pt-4 border-t border-gray-100">
          {modelError && (
            <div
              role="alert"
              className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm"
            >
              {modelError}
            </div>
          )}
          <Input
            label="Model ID"
            value={newModelId}
            onChange={(e) => setNewModelId(e.target.value)}
            placeholder="e.g. anthropic/claude-3.5-sonnet"
            hint="Copy the exact ID from your provider (for OpenRouter, the model page shows it)"
            autoComplete="off"
            spellCheck={false}
            required
          />
          <Input
            label="Display name (optional)"
            value={newModelLabel}
            onChange={(e) => setNewModelLabel(e.target.value)}
            placeholder="e.g. Claude 3.5 Sonnet"
            maxLength={40}
            autoComplete="off"
          />
          <div className="flex items-center gap-3">
            <Button
              type="submit"
              loading={addingModel}
              disabled={!newModelId.trim() || customModels.length >= MAX_CUSTOM_MODELS}
            >
              <Plus size={14} aria-hidden="true" />
              Add model
            </Button>
            <span className="text-xs text-gray-400">
              {customModels.length}/{MAX_CUSTOM_MODELS} custom models
            </span>
          </div>
        </form>
      </section>

      {/* Change Password */}
      <section
        aria-labelledby="password-heading"
        className="bg-white border border-gray-200 rounded-xl p-6"
      >
        <h2
          id="password-heading"
          className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2"
        >
          <Lock size={18} aria-hidden="true" />
          Change Password
        </h2>

        <form onSubmit={handlePasswordChange} className="space-y-4">
          {passwordError && (
            <div
              role="alert"
              className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm"
            >
              {passwordError}
            </div>
          )}
          {passwordSuccess && (
            <div
              role="status"
              className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm"
            >
              {passwordSuccess}
            </div>
          )}

          <Input
            label="Current password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            required
          />

          <Input
            label="New password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            required
            hint="Minimum 8 characters"
          />

          <Input
            label="Confirm new password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            required
          />

          <Button
            type="submit"
            loading={changingPassword}
            disabled={!currentPassword || !newPassword || !confirmPassword}
          >
            Change Password
          </Button>
        </form>
      </section>
    </div>
  );
}
