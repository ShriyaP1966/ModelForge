import React, { useState, useEffect } from 'react';
import { Project, Dataset, Experiment } from '../types';
import { api } from '../services/api';
import { formatModelName } from '../utils/formatting';
import { ErrorBanner } from '../components/ErrorBanner';
import {
  ArrowLeft,
  Sliders,
  Cpu,
  Database,
  Filter,
  Layers,
  Sparkles,
  GitFork,
  Play,
  RotateCcw,
} from 'lucide-react';

interface ExperimentDesignerPageProps {
  projectId: number;
  parentId?: number;
  onBack: () => void;
  onExperimentCreated: (expId: number) => void;
}

export const ExperimentDesignerPage: React.FC<ExperimentDesignerPageProps> = ({
  projectId,
  parentId,
  onBack,
  onExperimentCreated,
}) => {
  const [project, setProject] = useState<Project | null>(null);
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form States
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedParentId, setSelectedParentId] = useState<number | undefined>(parentId);
  const [targetColumn, setTargetColumn] = useState('');
  const [modelType, setModelType] = useState('');
  const [primaryMetric, setPrimaryMetric] = useState('');

  // Preprocessing
  const [imputerStrategy, setImputerStrategy] = useState('mean');
  const [scaler, setScaler] = useState('standard');
  const [encoder, setEncoder] = useState('onehot');

  // Feature Selection
  const [availableFeatures, setAvailableFeatures] = useState<string[]>([]);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);

  // Validation
  const [testSize, setTestSize] = useState(0.2);
  const [randomSeed, setRandomSeed] = useState(42);
  const [crossValidationFolds, setCrossValidationFolds] = useState(0);

  // Hyperparameters
  const [hyperparams, setHyperparams] = useState<Record<string, any>>({});

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        const [projData, dsList, expList] = await Promise.all([
          api.getProject(projectId),
          api.getProjectDatasets(projectId),
          api.getProjectExperiments(projectId),
        ]);
        setProject(projData);
        setExperiments(expList);

        if (dsList.length > 0) {
          const ds = dsList[0];
          setDataset(ds);

          const defaultTarget = ds.target_column || (ds.summary_stats?.potential_targets?.[0]) || '';
          setTargetColumn(defaultTarget);

          // Populate features
          const cols: string[] = ds.summary_stats?.columns?.map((c: any) => c.name) || [];
          const feats = cols.filter((c) => c !== defaultTarget);
          setAvailableFeatures(feats);
          setSelectedFeatures(feats);
        }

        // Set default models and metrics based on task type
        if (projData.task_type === 'classification') {
          setModelType('logistic_regression');
          setPrimaryMetric('f1');
          setName(`Logistic Regression Baseline #${expList.length + 1}`);
        } else {
          setModelType('linear_regression');
          setPrimaryMetric('rmse');
          setName(`Linear Regression Baseline #${expList.length + 1}`);
        }

        // If parentId provided, inherit configuration from parent
        if (parentId) {
          const parent = expList.find((e) => e.id === parentId);
          if (parent) {
            setModelType(parent.model_type);
            setScaler(parent.preprocessing_config?.scaler || 'standard');
            setImputerStrategy(parent.preprocessing_config?.imputer_strategy || 'mean');
            setEncoder(parent.preprocessing_config?.encoder || 'onehot');
            setHyperparams(parent.hyperparameters || {});
            setRandomSeed(parent.random_seed);
            setCrossValidationFolds(parent.cross_validation_folds || 0);
            if (parent.feature_selection && parent.feature_selection.length > 0) {
              setSelectedFeatures(parent.feature_selection);
            }
            setName(`Derived from #${parent.id} (${formatModelName(parent.model_type)})`);
          }
        }
      } catch (err: any) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [projectId, parentId]);

  const handleModelTypeChange = (type: string) => {
    setModelType(type);
    // Initialize default reasonable hyperparameters for selected model
    const defaults: Record<string, any> = {};
    if (type.includes('forest') || type.includes('gradient_boosting')) {
      defaults['n_estimators'] = 100;
      defaults['max_depth'] = 10;
    } else if (type === 'logistic_regression' || type === 'svm') {
      defaults['C'] = 1.0;
    } else if (type === 'ridge' || type === 'lasso') {
      defaults['alpha'] = 1.0;
    } else if (type === 'knn') {
      defaults['n_neighbors'] = 5;
    }
    setHyperparams(defaults);
    setName(`${formatModelName(type)} Iteration #${experiments.length + 1}`);
  };

  const handleToggleFeature = (feat: string) => {
    if (selectedFeatures.includes(feat)) {
      if (selectedFeatures.length === 1) {
        setFormError('You must retain at least one predictive feature.');
        return;
      }
      setSelectedFeatures(selectedFeatures.filter((f) => f !== feat));
    } else {
      setSelectedFeatures([...selectedFeatures, feat]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!dataset || !targetColumn) {
      setFormError('Valid dataset and target column required.');
      return;
    }

    setSubmitting(true);
    try {
      const exp = await api.createExperiment({
        project_id: projectId,
        dataset_id: dataset.id,
        parent_id: selectedParentId || undefined,
        name: name.trim(),
        description: description.trim() || undefined,
        model_type: modelType,
        hyperparameters: hyperparams,
        preprocessing_config: {
          imputer_strategy: imputerStrategy,
          scaler: scaler,
          encoder: encoder,
        },
        feature_selection: selectedFeatures,
        target_column: targetColumn,
        random_seed: Number(randomSeed),
        test_size: Number(testSize),
        cross_validation_folds: Number(crossValidationFolds),
        primary_metric: primaryMetric,
      });

      onExperimentCreated(exp.id);
    } catch (err: any) {
      setFormError(err.message || 'Experiment execution failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !project || !dataset) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 flex justify-center items-center">
        <RotateCcw className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  const isClassification = project.task_type === 'classification';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header & Back */}
      <div className="flex items-center space-x-2 text-xs text-slate-400">
        <button onClick={onBack} className="hover:text-white flex items-center gap-1 font-semibold">
          <ArrowLeft className="w-3.5 h-3.5" /> Project
        </button>
        <span>/</span>
        <span className="text-white font-mono">Experiment Designer</span>
      </div>

      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
        <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
          <Sliders className="w-6 h-6 text-emerald-400" />
          Controlled Experiment Designer
        </h1>
        <p className="text-xs text-slate-400 leading-relaxed">
          Configure algorithms, leak-free preprocessing transformers, feature subsets, and hyperparameters.
          All transforms are strictly fit on the training split to eliminate data leakage.
        </p>
      </div>

      <ErrorBanner message={formError} onDismiss={() => setFormError(null)} />

      <form onSubmit={handleSubmit} className="space-y-6 text-xs">
        {/* Basic Experiment Info */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            1. Metadata & Lineage Branching
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="exp-name" className="block text-slate-400 font-semibold mb-1">Experiment Name</label>
              <input
                id="exp-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-sans focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label htmlFor="exp-lineage-parent" className="block text-slate-400 font-semibold mb-1 flex items-center gap-1">
                <GitFork className="w-3.5 h-3.5 text-emerald-400" />
                Lineage Parent (Derive From)
              </label>
              <select
                id="exp-lineage-parent"
                value={selectedParentId || ''}
                onChange={(e) => setSelectedParentId(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono focus:outline-none focus:border-emerald-500"
              >
                <option value="">None (Independent Baseline Root)</option>
                {experiments.map((exp) => (
                  <option key={exp.id} value={exp.id}>
                    #{exp.id} - {exp.name} ({formatModelName(exp.model_type)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="exp-description" className="block text-slate-400 font-semibold mb-1">Experiment Description (Hypothesis)</label>
            <input
              id="exp-description"
              type="text"
              placeholder="e.g., Testing if MinMax scaling and Random Forest improve minority recall..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-sans focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Model Architecture & Primary Target */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            2. Model Architecture & Optimization Target
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="exp-target-column" className="block text-slate-400 font-semibold mb-1">Target Column</label>
              <select
                id="exp-target-column"
                required
                value={targetColumn}
                onChange={(e) => setTargetColumn(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono focus:outline-none focus:border-emerald-500"
              >
                {dataset.summary_stats?.columns?.map((c: any) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="exp-model-type" className="block text-slate-400 font-semibold mb-1">Candidate Model</label>
              <select
                id="exp-model-type"
                required
                value={modelType}
                onChange={(e) => handleModelTypeChange(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-emerald-400 font-bold focus:outline-none focus:border-emerald-500"
              >
                {isClassification ? (
                  <>
                    <option value="logistic_regression">Logistic Regression</option>
                    <option value="knn">K-Nearest Neighbors (KNN)</option>
                    <option value="decision_tree">Decision Tree Classifier</option>
                    <option value="random_forest">Random Forest Classifier</option>
                    <option value="svm">Support Vector Machine (SVM)</option>
                    <option value="gradient_boosting">Gradient Boosting Classifier</option>
                  </>
                ) : (
                  <>
                    <option value="linear_regression">Linear Regression</option>
                    <option value="ridge">Ridge Regression</option>
                    <option value="lasso">Lasso Regression</option>
                    <option value="decision_tree_regressor">Decision Tree Regressor</option>
                    <option value="random_forest_regressor">Random Forest Regressor</option>
                    <option value="gradient_boosting_regressor">Gradient Boosting Regressor</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label htmlFor="exp-primary-metric" className="block text-slate-400 font-semibold mb-1">Primary Metric</label>
              <select
                id="exp-primary-metric"
                required
                value={primaryMetric}
                onChange={(e) => setPrimaryMetric(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono focus:outline-none focus:border-emerald-500"
              >
                {isClassification ? (
                  <>
                    <option value="f1">F1 Score (Weighted)</option>
                    <option value="accuracy">Accuracy</option>
                    <option value="roc_auc">ROC-AUC</option>
                    <option value="precision">Precision</option>
                    <option value="recall">Recall</option>
                  </>
                ) : (
                  <>
                    <option value="rmse">RMSE (Root Mean Squared Error)</option>
                    <option value="mae">MAE (Mean Absolute Error)</option>
                    <option value="r2">R² Score</option>
                  </>
                )}
              </select>
            </div>
          </div>

          {/* Hyperparameters tuning fields */}
          <div className="pt-3 border-t border-slate-800 space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Hyperparameters ({formatModelName(modelType)})
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
              {(modelType.includes('forest') || modelType.includes('gradient_boosting')) && (
                <>
                  <div>
                    <label htmlFor="hp-n-estimators" className="text-slate-500 block text-[10px]">n_estimators</label>
                    <input
                      id="hp-n-estimators"
                      type="number"
                      min={10}
                      max={500}
                      value={hyperparams.n_estimators ?? 100}
                      onChange={(e) =>
                        setHyperparams({ ...hyperparams, n_estimators: parseInt(e.target.value) })
                      }
                      className="w-full px-2 py-1.5 rounded bg-slate-950 border border-slate-800 text-white"
                    />
                  </div>
                  <div>
                    <label htmlFor="hp-max-depth" className="text-slate-500 block text-[10px]">max_depth</label>
                    <input
                      id="hp-max-depth"
                      type="number"
                      min={1}
                      max={50}
                      value={hyperparams.max_depth ?? 10}
                      onChange={(e) =>
                        setHyperparams({ ...hyperparams, max_depth: parseInt(e.target.value) })
                      }
                      className="w-full px-2 py-1.5 rounded bg-slate-950 border border-slate-800 text-white"
                    />
                  </div>
                </>
              )}

              {(modelType === 'logistic_regression' || modelType === 'svm') && (
                <div>
                  <label htmlFor="hp-c" className="text-slate-500 block text-[10px]">C (Regularization)</label>
                  <input
                    id="hp-c"
                    type="number"
                    step="0.1"
                    min="0.01"
                    value={hyperparams.C ?? 1.0}
                    onChange={(e) =>
                      setHyperparams({ ...hyperparams, C: parseFloat(e.target.value) })
                    }
                    className="w-full px-2 py-1.5 rounded bg-slate-950 border border-slate-800 text-white"
                  />
                </div>
              )}

              {(modelType === 'ridge' || modelType === 'lasso') && (
                <div>
                  <label htmlFor="hp-alpha" className="text-slate-500 block text-[10px]">alpha (Penalty)</label>
                  <input
                    id="hp-alpha"
                    type="number"
                    step="0.1"
                    min="0.01"
                    value={hyperparams.alpha ?? 1.0}
                    onChange={(e) =>
                      setHyperparams({ ...hyperparams, alpha: parseFloat(e.target.value) })
                    }
                    className="w-full px-2 py-1.5 rounded bg-slate-950 border border-slate-800 text-white"
                  />
                </div>
              )}

              {modelType === 'knn' && (
                <div>
                  <label htmlFor="hp-n-neighbors" className="text-slate-500 block text-[10px]">n_neighbors</label>
                  <input
                    id="hp-n-neighbors"
                    type="number"
                    min={1}
                    max={50}
                    value={hyperparams.n_neighbors ?? 5}
                    onChange={(e) =>
                      setHyperparams({ ...hyperparams, n_neighbors: parseInt(e.target.value) })
                    }
                    className="w-full px-2 py-1.5 rounded bg-slate-950 border border-slate-800 text-white"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Preprocessing Pipeline */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            3. Leak-Free Preprocessing Pipeline
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="exp-imputer" className="block text-slate-400 font-semibold mb-1">Missing Value Imputation</label>
              <select
                id="exp-imputer"
                value={imputerStrategy}
                onChange={(e) => setImputerStrategy(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono focus:outline-none focus:border-emerald-500"
              >
                <option value="mean">Mean (Numerical)</option>
                <option value="median">Median (Robust to outliers)</option>
                <option value="most_frequent">Most Frequent (Mode)</option>
              </select>
            </div>

            <div>
              <label htmlFor="exp-scaler" className="block text-slate-400 font-semibold mb-1">Numerical Scaling</label>
              <select
                id="exp-scaler"
                value={scaler}
                onChange={(e) => setScaler(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono focus:outline-none focus:border-emerald-500"
              >
                <option value="standard">StandardScaler (Zero mean, unit var)</option>
                <option value="minmax">MinMaxScaler [0, 1]</option>
                <option value="robust">RobustScaler (Median & IQR)</option>
                <option value="none">None (Passthrough raw values)</option>
              </select>
            </div>

            <div>
              <label htmlFor="exp-encoder" className="block text-slate-400 font-semibold mb-1">Categorical Encoding</label>
              <select
                id="exp-encoder"
                value={encoder}
                onChange={(e) => setEncoder(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono focus:outline-none focus:border-emerald-500"
              >
                <option value="onehot">One-Hot Encoding (Ignore Unknown)</option>
                <option value="ordinal">Ordinal Encoding</option>
              </select>
            </div>
          </div>
        </div>

        {/* Feature Space Selection */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              4. Feature Subset Selection ({selectedFeatures.length} / {availableFeatures.length} Active)
            </h2>

            <div className="flex space-x-2">
              <button
                type="button"
                onClick={() => setSelectedFeatures([...availableFeatures])}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold"
              >
                Select All
              </button>
              <span className="text-slate-600">|</span>
              <button
                type="button"
                onClick={() => setSelectedFeatures(availableFeatures.slice(0, 1))}
                className="text-[11px] text-slate-400 hover:text-white"
              >
                Reset
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-56 overflow-y-auto p-1">
            {availableFeatures.map((feat) => {
              const isChecked = selectedFeatures.includes(feat);
              return (
                <label
                  key={feat}
                  className={`flex items-center space-x-2 p-2 rounded-lg border cursor-pointer transition-all ${
                    isChecked
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 font-semibold'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleToggleFeature(feat)}
                    className="accent-emerald-500 rounded"
                  />
                  <span className="truncate font-mono text-[11px]">{feat}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Validation Split & Seed */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            5. Validation Protocol & Reproducibility Seed
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="exp-test-size" className="text-slate-400 font-semibold">Validation Split Size</label>
                <span className="font-mono text-white font-bold">{(testSize * 100).toFixed(0)}% Test</span>
              </div>
              <input
                id="exp-test-size"
                type="range"
                min="0.1"
                max="0.4"
                step="0.05"
                value={testSize}
                onChange={(e) => setTestSize(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>

            <div>
              <label htmlFor="exp-random-seed" className="block text-slate-400 font-semibold mb-1">
                Random Seed (Reproducibility Lock)
              </label>
              <input
                id="exp-random-seed"
                type="number"
                value={randomSeed}
                onChange={(e) => setRandomSeed(parseInt(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="exp-cv-folds" className="block text-slate-400 font-semibold mb-1">
                Cross-Validation (Additional to the split above)
              </label>
              <select
                id="exp-cv-folds"
                value={crossValidationFolds}
                onChange={(e) => setCrossValidationFolds(parseInt(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono focus:outline-none focus:border-emerald-500"
              >
                <option value={0}>Disabled (single split only, default)</option>
                <option value={3}>3-Fold Cross-Validation</option>
                <option value={5}>5-Fold Cross-Validation</option>
                <option value={10}>10-Fold Cross-Validation</option>
              </select>
              <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
                Runs k-fold CV on the primary metric alongside the single split above, to show how stable
                that estimate is across folds. Automatically reduced if the dataset or a class is too small
                for the requested fold count.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-end space-x-3 pt-2">
          <button
            type="button"
            onClick={onBack}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition-all"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50 text-sm"
          >
            <Play className="w-4 h-4 mr-2 fill-slate-950" />
            {submitting ? 'Executing Pipeline...' : 'Run Experiment'}
          </button>
        </div>
      </form>
    </div>
  );
};
