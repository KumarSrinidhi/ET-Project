import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
import joblib
import os
from pathlib import Path

# Parameters and their ideal values/ranges
PARAMS = {
    'coating_thickness_um': (190, 195),
    'drying_temp_c': (135, 140),
    'drying_time_s': (120, 130),
    'calendering_pressure_mpa': (15, 20),
    'electrolyte_fill_volume_ml': (450, 470),
    'formation_cycle_count': (3, 5),
    'ambient_humidity_pct': (30, 40),
    'slurry_viscosity_cps': (4000, 5000),
    'electrode_density_g_cc': (2.4, 2.6),
    'tab_welding_power_w': (2000, 2200)
}

def generate_synthetic_data(n_samples=5000):
    np.random.seed(42)
    data = {}
    
    for param, (low, high) in PARAMS.items():
        # Generate mostly normal data, with some outliers
        mean = (low + high) / 2
        std = (high - low) / 4
        values = np.random.normal(mean, std, n_samples)
        
        # Add 10% outliers to simulate drifts
        outliers_idx = np.random.choice(n_samples, size=int(0.1 * n_samples), replace=False)
        outlier_direction = np.random.choice([-1, 1], size=len(outliers_idx))
        values[outliers_idx] += outlier_direction * std * np.random.uniform(2, 4, size=len(outliers_idx))
        
        data[param] = values
        
    df = pd.DataFrame(data)
    
    # Calculate Cpk target based on deviations from ideal
    # A perfect Cpk is 1.66. It drops as parameters deviate from their ideal mean
    cpk_values = np.full(n_samples, 1.66)
    
    for param, (low, high) in PARAMS.items():
        mean = (low + high) / 2
        std = (high - low) / 6  # 6 sigma spread
        
        # Deviation penalties (normalized)
        deviation = np.abs(df[param] - mean) / std
        
        # Some parameters affect Cpk more than others (weights)
        weights = {
            'drying_temp_c': 0.15,
            'coating_thickness_um': 0.20,
            'slurry_viscosity_cps': 0.15,
            'electrolyte_fill_volume_ml': 0.10,
            'ambient_humidity_pct': 0.10,
            'calendering_pressure_mpa': 0.05,
            'formation_cycle_count': 0.05,
            'electrode_density_g_cc': 0.10,
            'tab_welding_power_w': 0.05,
            'drying_time_s': 0.05
        }
        
        # Penalty grows quadratically with deviation
        penalty = weights[param] * (deviation ** 2) * 0.02
        cpk_values -= penalty
        
    # Add random noise
    cpk_values += np.random.normal(0, 0.05, n_samples)
    
    # Clip Cpk between 0.0 and 2.5
    cpk_values = np.clip(cpk_values, 0.0, 2.5)
    
    return df, cpk_values

def main():
    print("Generating synthetic data...")
    X, y = generate_synthetic_data(10000)
    
    print("Training RandomForestRegressor...")
    model = RandomForestRegressor(n_estimators=100, max_depth=10, random_state=42, n_jobs=-1)
    model.fit(X, y)
    
    print(f"R^2 Score on training data: {model.score(X, y):.4f}")
    
    # Save the model
    save_path = Path(__file__).resolve().parent / "qms_rf_model.joblib"
    joblib.dump(model, save_path)
    
    # Save a small background dataset for KernelExplainer fallback just in case
    background_data = X.sample(100, random_state=42)
    joblib.dump(background_data, Path(__file__).resolve().parent / "qms_rf_background.joblib")
    
    print(f"Model saved to {save_path}")

if __name__ == "__main__":
    main()
