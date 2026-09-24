import os
import joblib
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Tuple, Optional
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler, MinMaxScaler, RobustScaler, OneHotEncoder, OrdinalEncoder, LabelEncoder
from sklearn.model_selection import train_test_split, KFold, StratifiedKFold, cross_val_score, learning_curve
from sklearn.linear_model import LogisticRegression, LinearRegression, Ridge, Lasso
from sklearn.neighbors import KNeighborsClassifier
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, RandomForestRegressor, GradientBoostingRegressor
from sklearn.svm import SVC
from sklearn.inspection import permutation_importance

class MLPipelineEngine:
    """Builds, trains, and evaluates leak-free scikit-learn pipelines."""

    CLASSIFICATION_MODELS = {
        "logistic_regression": LogisticRegression,
        "knn": KNeighborsClassifier,
        "decision_tree": DecisionTreeClassifier,
        "random_forest": RandomForestClassifier,
        "svm": SVC,
        "gradient_boosting": GradientBoostingClassifier,
    }

    REGRESSION_MODELS = {
        "linear_regression": LinearRegression,
        "ridge": Ridge,
        "lasso": Lasso,
        "decision_tree_regressor": DecisionTreeRegressor,
        "random_forest_regressor": RandomForestRegressor,
        "gradient_boosting_regressor": GradientBoostingRegressor,
    }

    # Maps the experiment's chosen primary_metric to a scikit-learn scoring
    # string usable with cross_val_score. Metrics without a direct sklearn
    # scorer equivalent simply aren't offered for cross-validation.
    CLASSIFICATION_CV_SCORING = {
        "f1": "f1_weighted",
        "accuracy": "accuracy",
        "precision": "precision_weighted",
        "recall": "recall_weighted",
        "roc_auc": "roc_auc_ovr_weighted",
    }
    REGRESSION_CV_SCORING = {
        "rmse": "neg_root_mean_squared_error",
        "mae": "neg_mean_absolute_error",
        "mse": "neg_mean_squared_error",
        "r2": "r2",
    }

    @classmethod
    def get_supported_models(cls) -> Dict[str, List[str]]:
        return {
            "classification": list(cls.CLASSIFICATION_MODELS.keys()),
            "regression": list(cls.REGRESSION_MODELS.keys())
        }

    @classmethod
    def create_preprocessor(
        cls,
        numeric_features: List[str],
        categorical_features: List[str],
        imputer_strategy: str = "mean",
        scaler_type: str = "standard",
        encoder_type: str = "onehot"
    ) -> ColumnTransformer:
        """Create leak-free ColumnTransformer for numeric and categorical pipelines."""
        transformers = []

        # Numeric transformer
        if numeric_features:
            num_steps = []
            num_imp_strat = imputer_strategy if imputer_strategy in ["mean", "median", "most_frequent"] else "mean"
            num_steps.append(("imputer", SimpleImputer(strategy=num_imp_strat)))
            
            if scaler_type == "standard":
                num_steps.append(("scaler", StandardScaler()))
            elif scaler_type == "minmax":
                num_steps.append(("scaler", MinMaxScaler()))
            elif scaler_type == "robust":
                num_steps.append(("scaler", RobustScaler()))
            # If none, no scaler step is added
            
            numeric_pipe = Pipeline(steps=num_steps)
            transformers.append(("num", numeric_pipe, numeric_features))

        # Categorical transformer
        if categorical_features:
            cat_steps = []
            cat_steps.append(("imputer", SimpleImputer(strategy="most_frequent")))
            
            if encoder_type == "onehot":
                cat_steps.append(("encoder", OneHotEncoder(handle_unknown="ignore", sparse_output=False)))
            else:
                cat_steps.append(("encoder", OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1)))
                
            categorical_pipe = Pipeline(steps=cat_steps)
            transformers.append(("cat", categorical_pipe, categorical_features))

        if not transformers:
            raise ValueError("No valid features supplied for preprocessing pipeline.")

        return ColumnTransformer(transformers=transformers, remainder="drop")

    @classmethod
    def build_estimator(
        cls,
        task_type: str,
        model_type: str,
        hyperparameters: Dict[str, Any],
        random_seed: int = 42
    ):
        """Instantiate scikit-learn model with sanitized hyperparameters."""
        norm_type = model_type.lower().strip()
        params = dict(hyperparameters or {})

        if task_type == "classification":
            model_cls = cls.CLASSIFICATION_MODELS.get(norm_type)
            if not model_cls:
                raise ValueError(f"Unsupported classification model: {model_type}")
            
            # Inject random_state if supported
            if "random_state" not in params and norm_type in ["logistic_regression", "decision_tree", "random_forest", "svm", "gradient_boosting"]:
                params["random_state"] = random_seed
            if norm_type == "svm" and "probability" not in params:
                params["probability"] = True
            if norm_type == "logistic_regression" and "max_iter" not in params:
                params["max_iter"] = 1000

            return model_cls(**params)
        else:
            model_cls = cls.REGRESSION_MODELS.get(norm_type)
            if not model_cls:
                raise ValueError(f"Unsupported regression model: {model_type}")
            
            if "random_state" not in params and norm_type in ["decision_tree_regressor", "random_forest_regressor", "gradient_boosting_regressor", "ridge", "lasso"]:
                params["random_state"] = random_seed

            return model_cls(**params)

    @classmethod
    def prepare_data(
        cls,
        df: pd.DataFrame,
        target_column: str,
        feature_columns: Optional[List[str]] = None,
        task_type: str = "classification"
    ) -> Tuple[pd.DataFrame, np.ndarray, List[str], List[str], Optional[LabelEncoder]]:
        """Separate features and target, determine feature column types, and encode target if needed."""
        if target_column not in df.columns:
            raise ValueError(f"Target column '{target_column}' not found in dataset.")

        # Drop rows where target is NaN
        valid_df = df.dropna(subset=[target_column]).copy()
        if len(valid_df) < 5:
            raise ValueError(f"Dataset has too few rows ({len(valid_df)}) with valid target values.")

        # Select features
        if feature_columns:
            selected_features = [f for f in feature_columns if f in valid_df.columns and f != target_column]
        else:
            selected_features = [col for col in valid_df.columns if col != target_column]

        if not selected_features:
            raise ValueError("No valid features selected for training.")

        X = valid_df[selected_features].copy()
        raw_y = valid_df[target_column]

        label_encoder = None
        if task_type == "classification":
            unique_targets = raw_y.unique()
            if len(unique_targets) < 2:
                raise ValueError(f"Classification target must have at least 2 distinct classes. Found: {len(unique_targets)}")
            
            label_encoder = LabelEncoder()
            y = label_encoder.fit_transform(raw_y.astype(str))
        else:
            # Regression: coerce to float
            y = pd.to_numeric(raw_y, errors="coerce").values
            # Handle NaN in y after coercion if any
            valid_mask = ~np.isnan(y)
            if not valid_mask.all():
                X = X[valid_mask]
                y = y[valid_mask]
                if len(y) < 5:
                    raise ValueError("Too few rows remaining after dropping non-numeric regression targets.")

        # Determine numeric vs categorical features
        numeric_features = []
        categorical_features = []
        for col in selected_features:
            if pd.api.types.is_numeric_dtype(X[col]):
                numeric_features.append(col)
            else:
                categorical_features.append(col)

        return X, y, numeric_features, categorical_features, label_encoder

    @staticmethod
    def _json_safe_round(value: float, digits: int = 4) -> Optional[float]:
        """Rounds a float for JSON output, converting NaN/inf to None. Both
        cross_val_score and learning_curve default to error_score=nan for a
        degenerate fold (e.g. a training slice too small/imbalanced to fit) --
        that's a silent NaN in the result array, not a raised exception, so it
        would otherwise reach json.dumps() as a bare `NaN` token, which is not
        valid JSON and breaks JSON.parse() on the frontend.
        """
        if value is None or not np.isfinite(value):
            return None
        return round(float(value), digits)

    @classmethod
    def _compute_cross_validation(
        cls,
        X: pd.DataFrame,
        y: np.ndarray,
        task_type: str,
        model_type: str,
        hyperparameters: Dict[str, Any],
        preprocessing_config: Dict[str, Any],
        num_features: List[str],
        cat_features: List[str],
        primary_metric: str,
        requested_folds: int,
        random_seed: int
    ) -> Optional[Dict[str, Any]]:
        """Runs k-fold cross-validation on the primary metric, independently of
        the single train/val split used for the rest of the experiment's
        artifacts (confusion matrix, ROC curve, feature importance, etc). Never
        raises: on any failure (dataset too small for the requested fold count,
        unsupported metric, ...) it returns a result dict explaining why CV
        wasn't computed, so a bad CV request cannot fail the whole experiment.
        """
        if not requested_folds or requested_folds < 2:
            return None

        scoring_map = cls.CLASSIFICATION_CV_SCORING if task_type == "classification" else cls.REGRESSION_CV_SCORING
        scoring = scoring_map.get(primary_metric.lower())
        if not scoring:
            return {
                "requested_folds": requested_folds,
                "effective_folds": None,
                "metric": primary_metric,
                "scores": [],
                "mean": None,
                "std": None,
                "error": f"Cross-validation is not available for primary metric '{primary_metric}'."
            }

        try:
            if task_type == "classification":
                min_class_count = int(pd.Series(y).value_counts().min())
                effective_folds = min(requested_folds, min_class_count, len(X))
                splitter = StratifiedKFold(n_splits=effective_folds, shuffle=True, random_state=random_seed) if effective_folds >= 2 else None
            else:
                effective_folds = min(requested_folds, len(X))
                splitter = KFold(n_splits=effective_folds, shuffle=True, random_state=random_seed) if effective_folds >= 2 else None

            if splitter is None:
                return {
                    "requested_folds": requested_folds,
                    "effective_folds": effective_folds,
                    "metric": primary_metric,
                    "scores": [],
                    "mean": None,
                    "std": None,
                    "error": "Dataset is too small (or a class has too few rows) to run at least 2 folds."
                }

            # A fresh, unfitted pipeline -- cross_val_score fits/evaluates it
            # once per fold internally, so preprocessing is refit on each
            # fold's training split only, same leak-free guarantee as the
            # single train/val split above.
            cv_preprocessor = cls.create_preprocessor(
                numeric_features=num_features,
                categorical_features=cat_features,
                imputer_strategy=preprocessing_config.get("imputer_strategy", "mean"),
                scaler_type=preprocessing_config.get("scaler", "standard"),
                encoder_type=preprocessing_config.get("encoder", "onehot")
            )
            cv_estimator = cls.build_estimator(
                task_type=task_type,
                model_type=model_type,
                hyperparameters=hyperparameters,
                random_seed=random_seed
            )
            cv_pipeline = Pipeline(steps=[("preprocessor", cv_preprocessor), ("model", cv_estimator)])

            scores = cross_val_score(cv_pipeline, X, y, cv=splitter, scoring=scoring, error_score=np.nan)
            if scoring.startswith("neg_"):
                scores = -scores

            if np.all(np.isnan(scores)):
                return {
                    "requested_folds": requested_folds,
                    "effective_folds": effective_folds,
                    "metric": primary_metric,
                    "scores": [],
                    "mean": None,
                    "std": None,
                    "error": "Every fold failed to fit (likely too few rows per class for this fold count)."
                }

            return {
                "requested_folds": requested_folds,
                "effective_folds": effective_folds,
                "metric": primary_metric,
                "scores": [cls._json_safe_round(s) for s in scores],
                "mean": cls._json_safe_round(np.nanmean(scores)),
                "std": cls._json_safe_round(np.nanstd(scores)),
                "error": None
            }
        except Exception as e:
            return {
                "requested_folds": requested_folds,
                "effective_folds": None,
                "metric": primary_metric,
                "scores": [],
                "mean": None,
                "std": None,
                "error": f"Cross-validation failed: {e}"
            }

    @classmethod
    def _compute_learning_curve(
        cls,
        X: pd.DataFrame,
        y: np.ndarray,
        task_type: str,
        model_type: str,
        hyperparameters: Dict[str, Any],
        preprocessing_config: Dict[str, Any],
        num_features: List[str],
        cat_features: List[str],
        primary_metric: str,
        random_seed: int
    ) -> Optional[Dict[str, Any]]:
        """Computes a train-size-vs-score learning curve for the primary metric,
        using a small fixed 3-fold split and 5 train-size fractions -- kept
        deliberately cheap (unlike cross-validation, this isn't user-configurable)
        since it runs automatically for every experiment, the same way the
        confusion matrix or feature importances do. Never raises: returns None
        on any failure (dataset too small, unsupported metric, ...) so a
        learning curve that can't be computed simply doesn't show up, rather
        than failing the experiment.
        """
        try:
            scoring_map = cls.CLASSIFICATION_CV_SCORING if task_type == "classification" else cls.REGRESSION_CV_SCORING
            scoring = scoring_map.get(primary_metric.lower())
            if not scoring or len(X) < 20:
                return None

            if task_type == "classification":
                min_class_count = int(pd.Series(y).value_counts().min())
                folds = min(3, min_class_count)
                splitter = StratifiedKFold(n_splits=folds, shuffle=True, random_state=random_seed) if folds >= 2 else None
            else:
                folds = min(3, len(X))
                splitter = KFold(n_splits=folds, shuffle=True, random_state=random_seed) if folds >= 2 else None

            if splitter is None:
                return None

            lc_preprocessor = cls.create_preprocessor(
                numeric_features=num_features,
                categorical_features=cat_features,
                imputer_strategy=preprocessing_config.get("imputer_strategy", "mean"),
                scaler_type=preprocessing_config.get("scaler", "standard"),
                encoder_type=preprocessing_config.get("encoder", "onehot")
            )
            lc_estimator = cls.build_estimator(
                task_type=task_type,
                model_type=model_type,
                hyperparameters=hyperparameters,
                random_seed=random_seed
            )
            lc_pipeline = Pipeline(steps=[("preprocessor", lc_preprocessor), ("model", lc_estimator)])

            train_sizes_abs, train_scores, val_scores = learning_curve(
                lc_pipeline, X, y,
                cv=splitter,
                train_sizes=np.linspace(0.2, 1.0, 5),
                scoring=scoring,
                error_score=np.nan
            )

            if scoring.startswith("neg_"):
                train_scores = -train_scores
                val_scores = -val_scores

            # Small train-size fractions can leave too few rows (or too few
            # rows of one class) to fit at all -- that fold comes back as NaN
            # rather than raising, per sklearn's default error_score=nan.
            # nanmean/nanstd salvage whatever folds did succeed at each train
            # size; _json_safe_round turns a point where every fold failed
            # into `null` rather than a raw NaN, which isn't valid JSON.
            with np.errstate(invalid="ignore"):
                train_means = np.nanmean(train_scores, axis=1)
                train_stds = np.nanstd(train_scores, axis=1)
                val_means = np.nanmean(val_scores, axis=1)
                val_stds = np.nanstd(val_scores, axis=1)

            return {
                "metric": primary_metric,
                "folds": folds,
                "train_sizes": [int(n) for n in train_sizes_abs],
                "train_scores_mean": [cls._json_safe_round(x) for x in train_means],
                "train_scores_std": [cls._json_safe_round(x) for x in train_stds],
                "val_scores_mean": [cls._json_safe_round(x) for x in val_means],
                "val_scores_std": [cls._json_safe_round(x) for x in val_stds],
                "error": None
            }
        except Exception:
            return None

    @classmethod
    def train_and_evaluate(
        cls,
        df: pd.DataFrame,
        target_column: str,
        task_type: str,
        model_type: str,
        hyperparameters: Dict[str, Any],
        preprocessing_config: Dict[str, Any],
        feature_columns: Optional[List[str]] = None,
        test_size: float = 0.2,
        random_seed: int = 42,
        artifact_save_dir: Optional[str] = None,
        cross_validation_folds: int = 0,
        primary_metric: str = "f1"
    ) -> Dict[str, Any]:
        """Orchestrates end-to-end leak-free training and returns full metrics and artifacts."""
        X, y, num_features, cat_features, label_encoder = cls.prepare_data(
            df=df,
            target_column=target_column,
            feature_columns=feature_columns,
            task_type=task_type
        )

        # Train/Test Split - strictly before fitting any transformer
        stratify = y if task_type == "classification" and min(pd.Series(y).value_counts()) >= 2 else None
        X_train, X_val, y_train, y_val = train_test_split(
            X, y, test_size=test_size, random_state=random_seed, stratify=stratify
        )

        # Build Preprocessor
        preprocessor = cls.create_preprocessor(
            numeric_features=num_features,
            categorical_features=cat_features,
            imputer_strategy=preprocessing_config.get("imputer_strategy", "mean"),
            scaler_type=preprocessing_config.get("scaler", "standard"),
            encoder_type=preprocessing_config.get("encoder", "onehot")
        )

        # Build Estimator
        estimator = cls.build_estimator(
            task_type=task_type,
            model_type=model_type,
            hyperparameters=hyperparameters,
            random_seed=random_seed
        )

        # Combine into leak-free Pipeline
        full_pipeline = Pipeline(steps=[
            ("preprocessor", preprocessor),
            ("model", estimator)
        ])

        # Fit strictly on X_train, y_train
        full_pipeline.fit(X_train, y_train)

        # Predictions
        y_train_pred = full_pipeline.predict(X_train)
        y_val_pred = full_pipeline.predict(X_val)

        y_train_proba = None
        y_val_proba = None
        if task_type == "classification" and hasattr(full_pipeline, "predict_proba"):
            try:
                y_train_proba = full_pipeline.predict_proba(X_train)
                y_val_proba = full_pipeline.predict_proba(X_val)
            except Exception:
                pass

        # Feature Importance Extraction
        feature_names = []
        try:
            # Try to get transformed feature names from ColumnTransformer
            feature_names = list(preprocessor.get_feature_names_out())
        except Exception:
            feature_names = num_features + cat_features

        feature_importances = cls._extract_feature_importance(
            model=estimator,
            feature_names=feature_names,
            X_val=preprocessor.transform(X_val),
            y_val=y_val
        )

        # Optional k-fold cross-validation of the primary metric, independent
        # of (and additional to) the single train/val split above.
        cv_result = cls._compute_cross_validation(
            X=X,
            y=y,
            task_type=task_type,
            model_type=model_type,
            hyperparameters=hyperparameters,
            preprocessing_config=preprocessing_config,
            num_features=num_features,
            cat_features=cat_features,
            primary_metric=primary_metric,
            requested_folds=cross_validation_folds,
            random_seed=random_seed
        )

        # Learning curve (train-size vs score), computed automatically for
        # every experiment -- same tier as the confusion matrix or feature
        # importances above, not an opt-in setting like cross-validation.
        lc_result = cls._compute_learning_curve(
            X=X,
            y=y,
            task_type=task_type,
            model_type=model_type,
            hyperparameters=hyperparameters,
            preprocessing_config=preprocessing_config,
            num_features=num_features,
            cat_features=cat_features,
            primary_metric=primary_metric,
            random_seed=random_seed
        )

        # Save model artifact if requested
        saved_model_path = None
        if artifact_save_dir:
            os.makedirs(artifact_save_dir, exist_ok=True)
            saved_model_path = os.path.join(artifact_save_dir, f"pipeline_{task_type}_{model_type}_{random_seed}.joblib")
            joblib.dump(full_pipeline, saved_model_path)

        return {
            "pipeline": full_pipeline,
            "saved_model_path": saved_model_path,
            "X_train": X_train,
            "X_val": X_val,
            "y_train": y_train,
            "y_val": y_val,
            "y_train_pred": y_train_pred,
            "y_val_pred": y_val_pred,
            "y_train_proba": y_train_proba,
            "y_val_proba": y_val_proba,
            "label_encoder": label_encoder,
            "num_features": num_features,
            "cat_features": cat_features,
            "transformed_feature_names": feature_names,
            "feature_importances": feature_importances,
            "cross_validation": cv_result,
            "learning_curve": lc_result
        }

    @staticmethod
    def _extract_feature_importance(
        model: Any,
        feature_names: List[str],
        X_val: Any,
        y_val: Any
    ) -> List[Dict[str, Any]]:
        """Extract or compute feature importances."""
        importances = []
        try:
            if hasattr(model, "feature_importances_"):
                raw_imp = model.feature_importances_
                total = sum(raw_imp) if sum(raw_imp) > 0 else 1.0
                for idx, val in enumerate(raw_imp):
                    name = feature_names[idx] if idx < len(feature_names) else f"feature_{idx}"
                    importances.append({"feature": name, "importance": round(float(val / total), 4)})
            elif hasattr(model, "coef_"):
                coef = model.coef_
                # For multiclass, take mean absolute coef across classes
                if coef.ndim > 1:
                    raw_imp = np.mean(np.abs(coef), axis=0)
                else:
                    raw_imp = np.abs(coef)
                total = sum(raw_imp) if sum(raw_imp) > 0 else 1.0
                for idx, val in enumerate(raw_imp):
                    name = feature_names[idx] if idx < len(feature_names) else f"feature_{idx}"
                    importances.append({"feature": name, "importance": round(float(val / total), 4)})
            else:
                # Fast permutation importance on validation set for other models (e.g. KNN)
                perm = permutation_importance(model, X_val, y_val, n_repeats=3, random_state=42)
                raw_imp = np.maximum(0, perm.importances_mean)
                total = sum(raw_imp) if sum(raw_imp) > 0 else 1.0
                for idx, val in enumerate(raw_imp):
                    name = feature_names[idx] if idx < len(feature_names) else f"feature_{idx}"
                    importances.append({"feature": name, "importance": round(float(val / total), 4)})
        except Exception:
            pass

        # Sort descending and return top 15
        importances.sort(key=lambda x: x["importance"], reverse=True)
        return importances[:15]
