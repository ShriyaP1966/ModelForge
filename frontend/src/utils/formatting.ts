export function formatMetric(val: number | undefined | null, decimals = 4): string {
  if (val === undefined || val === null || isNaN(val)) return '—';
  return val.toFixed(decimals);
}

export function formatPercent(val: number | undefined | null): string {
  if (val === undefined || val === null || isNaN(val)) return '—';
  return `${(val * 100).toFixed(1)}%`;
}

export function formatMetricName(name: string): string {
  const map: Record<string, string> = {
    accuracy: 'Accuracy',
    f1: 'F1 Score',
    precision: 'Precision',
    recall: 'Recall',
    roc_auc: 'ROC-AUC',
    mae: 'MAE',
    mse: 'MSE',
    rmse: 'RMSE',
    r2: 'R² Score',
    explained_variance: 'Explained Variance',
  };
  return map[name.toLowerCase()] || name.replace(/_/g, ' ').toUpperCase();
}

export function formatModelName(modelType: string): string {
  const map: Record<string, string> = {
    logistic_regression: 'Logistic Regression',
    knn: 'K-Nearest Neighbors',
    decision_tree: 'Decision Tree',
    random_forest: 'Random Forest',
    svm: 'Support Vector Machine (SVM)',
    gradient_boosting: 'Gradient Boosting',
    linear_regression: 'Linear Regression',
    ridge: 'Ridge Regression',
    lasso: 'Lasso Regression',
    decision_tree_regressor: 'Decision Tree Regressor',
    random_forest_regressor: 'Random Forest Regressor',
    gradient_boosting_regressor: 'Gradient Boosting Regressor',
  };
  return map[modelType.toLowerCase()] || modelType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
