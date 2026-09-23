import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Settings, ShieldCheck, Cpu, HardDrive, Key, Save, CheckCircle2, Lock } from 'lucide-react';

interface SettingsPageProps {
  onBack: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onBack }) => {
  const [provider, setProvider] = useState('offline');
  const [openaiKey, setOpenaiKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [serverSettings, setServerSettings] = useState<any>(null);
  const [availableProviders, setAvailableProviders] = useState<string[]>(['offline']);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const s = await api.getSettings();
        setServerSettings(s);
        const available: string[] = s.available_ai_providers || ['offline'];
        setAvailableProviders(available);
        // Never reflect a provider the backend can't actually serve, even if
        // a stale/manual config left AI_PROVIDER set to something unavailable.
        setProvider(available.includes(s.ai_provider) ? s.ai_provider : 'offline');
      } catch (err) {
        console.error(err);
      }
    };
    loadSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);
    setSaveError(null);
    try {
      await api.updateSettings({
        ai_provider: provider,
        openai_api_key: openaiKey,
        gemini_api_key: geminiKey,
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
        <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
          <Settings className="w-6 h-6 text-emerald-400" />
          System Settings & AI Providers
        </h1>
        <p className="text-xs text-slate-400 leading-relaxed">
          ModelForge is architected free-first. Core ML computation, diagnostics, and reproducibility run 100% locally.
          External AI explanation APIs are completely optional.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6 text-xs">
        {/* AI Provider Configuration */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-emerald-400" />
            AI Explanation Provider
          </h2>

          <div className="space-y-3">
            <label className="flex items-start space-x-3 p-3.5 rounded-xl border cursor-pointer transition-all bg-slate-950 border-slate-800 hover:border-slate-700">
              <input
                type="radio"
                name="ai_provider"
                value="offline"
                checked={provider === 'offline'}
                onChange={() => setProvider('offline')}
                className="mt-1 accent-emerald-500"
              />
              <div>
                <span className="font-bold text-white text-sm block">
                  Deterministic Scientific Fallback Engine (Default - Free / Offline)
                </span>
                <span className="text-slate-400 text-xs mt-0.5 block leading-relaxed">
                  Synthesizes structured experiment metadata, identifies parameter shifts, formulates grounded hypotheses, and diagnoses generalization gaps with zero network requests or API costs.
                </span>
              </div>
            </label>

            {[
              {
                key: 'openai',
                label: 'OpenAI',
                blurb: 'Enhance structured experiment diffs with GPT models.',
                keyValue: openaiKey,
                setKeyValue: setOpenaiKey,
                placeholder: 'sk-...',
              },
              {
                key: 'gemini',
                label: 'Google Gemini',
                blurb: 'Enhance structured experiment diffs with Gemini models.',
                keyValue: geminiKey,
                setKeyValue: setGeminiKey,
                placeholder: 'AIza...',
              },
            ].map((p) => {
              const isAvailable = availableProviders.includes(p.key);
              return (
                <label
                  key={p.key}
                  className={`flex items-start space-x-3 p-3.5 rounded-xl border transition-all ${
                    isAvailable
                      ? 'cursor-pointer bg-slate-950 border-slate-800 hover:border-slate-700'
                      : 'cursor-not-allowed bg-slate-950/50 border-slate-800/60 opacity-60'
                  }`}
                >
                  <input
                    type="radio"
                    name="ai_provider"
                    value={p.key}
                    checked={provider === p.key}
                    disabled={!isAvailable}
                    onChange={() => isAvailable && setProvider(p.key)}
                    className="mt-1 accent-emerald-500 disabled:cursor-not-allowed"
                  />
                  <div className="flex-1">
                    <span className="font-bold text-white text-sm flex items-center gap-2">
                      {p.label}
                      {!isAvailable && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-slate-800 text-slate-400 border border-slate-700">
                          <Lock className="w-2.5 h-2.5" /> Coming Soon
                        </span>
                      )}
                    </span>
                    <span className="text-slate-400 text-xs mt-0.5 block leading-relaxed">
                      {isAvailable
                        ? p.blurb
                        : `${p.blurb} Not implemented yet — selecting this has no effect; the deterministic offline engine is used instead.`}
                    </span>
                    {isAvailable && provider === p.key && (
                      <div className="mt-2">
                        <input
                          type="password"
                          placeholder={p.placeholder}
                          value={p.keyValue}
                          onChange={(e) => p.setKeyValue(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-white font-mono focus:outline-none focus:border-emerald-500 text-xs"
                        />
                      </div>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Free-First Architecture Guarantee Card */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Free-First Design Constraints Check
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>Runs 100% on normal student laptop</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>No GPU required for all 12 models</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>Embedded SQLite storage (Zero cloud DB)</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>Offline-capable deterministic engine</span>
            </div>
          </div>
        </div>

        {/* Local Storage Details */}
        {serverSettings && (
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-sky-400" />
              Storage & Paths
            </h2>

            <div className="space-y-2 font-mono text-[11px] text-slate-400">
              <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                <span className="text-slate-500 block text-[10px]">DATABASE</span>
                <span className="text-white truncate block">{serverSettings.database_url}</span>
              </div>
              <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                <span className="text-slate-500 block text-[10px]">DATASETS DIR</span>
                <span className="text-white truncate block">{serverSettings.data_dir}</span>
              </div>
              <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                <span className="text-slate-500 block text-[10px]">MODELS DIR</span>
                <span className="text-white truncate block">{serverSettings.models_dir}</span>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          {savedSuccess && (
            <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Settings updated successfully!
            </span>
          )}
          {saveError && (
            <span className="text-rose-400 font-semibold flex items-center gap-1.5">
              <Lock className="w-4 h-4" /> {saveError}
            </span>
          )}
          <div className="ml-auto flex space-x-3">
            <button
              type="button"
              onClick={onBack}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-md shadow-emerald-500/20 disabled:opacity-50"
            >
              <Save className="w-4 h-4 mr-1.5" />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
