import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from app.db.base import Base

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    task_type = Column(String(50), default="classification")  # classification or regression
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    datasets = relationship("Dataset", back_populates="project", cascade="all, delete-orphan")
    experiments = relationship("Experiment", back_populates="project", cascade="all, delete-orphan")

class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    filename = Column(String(255), nullable=False)
    file_path = Column(String(1024), nullable=False)
    row_count = Column(Integer, default=0)
    col_count = Column(Integer, default=0)
    sha256_hash = Column(String(64), nullable=False)
    target_column = Column(String(255), nullable=True)
    summary_stats = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    project = relationship("Project", back_populates="datasets")
    experiments = relationship("Experiment", back_populates="dataset")

class Experiment(Base):
    __tablename__ = "experiments"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    dataset_id = Column(Integer, ForeignKey("datasets.id"), nullable=True)
    parent_id = Column(Integer, ForeignKey("experiments.id"), nullable=True)  # Lineage tracking
    
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    model_type = Column(String(100), nullable=False)
    
    # Configurations
    hyperparameters = Column(JSON, default=dict)
    preprocessing_config = Column(JSON, default=dict)
    feature_selection = Column(JSON, default=list)  # list of feature column names
    target_column = Column(String(255), nullable=False)
    random_seed = Column(Integer, default=42)
    test_size = Column(Float, default=0.2)
    cross_validation_folds = Column(Integer, default=0)  # 0 = simple train/val split
    primary_metric = Column(String(50), default="f1")    # e.g., f1, accuracy, rmse, r2
    
    # State & Execution
    status = Column(String(50), default="queued")  # queued, running, completed, failed, cancelled
    duration_ms = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    dataset_fingerprint = Column(String(64), nullable=True)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    project = relationship("Project", back_populates="experiments")
    dataset = relationship("Dataset", back_populates="experiments")
    children = relationship("Experiment", backref="parent", remote_side=[id])
    metrics = relationship("ExperimentMetric", back_populates="experiment", cascade="all, delete-orphan")
    artifacts = relationship("ExperimentArtifact", back_populates="experiment", cascade="all, delete-orphan")

class ExperimentMetric(Base):
    __tablename__ = "experiment_metrics"

    id = Column(Integer, primary_key=True, index=True)
    experiment_id = Column(Integer, ForeignKey("experiments.id"), nullable=False)
    split = Column(String(20), default="val")  # train, val, cv
    metric_name = Column(String(100), nullable=False)
    metric_value = Column(Float, nullable=False)

    experiment = relationship("Experiment", back_populates="metrics")

class ExperimentArtifact(Base):
    __tablename__ = "experiment_artifacts"

    id = Column(Integer, primary_key=True, index=True)
    experiment_id = Column(Integer, ForeignKey("experiments.id"), nullable=False)
    artifact_type = Column(String(50), nullable=False)  # model, confusion_matrix, roc_curve, etc.
    file_path = Column(String(1024), nullable=True)
    data = Column(JSON, nullable=True)  # Store visual chart coordinates/matrices directly

    experiment = relationship("Experiment", back_populates="artifacts")
