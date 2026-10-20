from features import get_training_data
from sklearn.dummy import DummyClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, log_loss
from sklearn.pipeline import make_pipeline
from pathlib import Path
from features import FEATURES
import pandas as pd
import joblib

MODEL_PATH = Path(__file__).resolve().parent.parent / "models" / "model.joblib"


def main():
    #Load the feature matrix and target matrix , DATE ASC
    df = get_training_data().sort_values(["match_date", "match_id"])
    X = df[FEATURES]
    y = df["target"]

    #We train our model with 80% and test with 20%
    cut = int(len(df) * 0.8)
    X_train, X_test = X.iloc[:cut], X.iloc[cut:]
    y_train, y_test = y.iloc[:cut], y.iloc[cut:]
    print(X_train.shape, X_test.shape)

    #Baseline to know if our features are relevant
    dummy = DummyClassifier(strategy="prior")
    dummy.fit(X_train, y_train)
    print(dummy.class_prior_)

    #Normalize X-train
    scaler = StandardScaler()
    scaler.fit(X_train)  #-> Computes mean and Ecart type for each column
    X_train_scaled = scaler.transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    #Fit the model
    model = LogisticRegression()
    model.fit(X_train_scaled, y_train)

    #Predictions of the baseline and model
    base_pred = dummy.predict(X_test)
    base_proba = dummy.predict_proba(X_test)

    model_pred = model.predict(X_test_scaled)
    model_proba = model.predict_proba(X_test_scaled)

    #Accuracy: share of matches where the most likely result was the right one
    print("Baseline accuracy:", accuracy_score(y_test, base_pred))
    print("Model accuracy:", accuracy_score(y_test, model_pred))

    #Log loss: quality of the probabilities (lower is better)
    print("Baseline log loss:", log_loss(y_test, base_proba, labels=dummy.classes_))
    print("Model log loss:", log_loss(y_test, model_proba, labels=model.classes_))

    #Weights
    coefs = pd.DataFrame(model.coef_, index=model.classes_, columns=FEATURES).T
    print(coefs.round(2))

    #Pipeline to make the final model (trained on all the matches)
    pipeline = make_pipeline(StandardScaler(), LogisticRegression())
    pipeline.fit(X, y)

    #Saving the model
    MODEL_PATH.parent.mkdir(exist_ok=True)  #creates models/ if it does not exist
    joblib.dump(pipeline, MODEL_PATH)
    


if __name__ == "__main__":
    main()