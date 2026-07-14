import os
import joblib
from pathlib import Path
import shap
import numpy as np
import pandas as pd
import logging
import uuid
from datetime import datetime
from database import get_db_connection

logger = logging.getLogger(__name__)

# Cache for explainer to avoid reloading
_explainer = None
_model = None
_model_columns = [
    'coating_thickness_um', 'drying_temp_c', 'drying_time_s', 
    'calendering_pressure_mpa', 'electrolyte_fill_volume_ml', 
    'formation_cycle_count', 'ambient_humidity_pct', 
    'slurry_viscosity_cps', 'electrode_density_g_cc', 
    'tab_welding_power_w'
]

# Normal ranges for prompt matching
NORMAL_RANGES = {
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

def load_explainer():
    global _explainer, _model
    if _explainer is not None:
        return _explainer, _model
        
    model_path = Path(__file__).resolve().parent / "qms_rf_model.joblib"
    bg_path = Path(__file__).resolve().parent / "qms_rf_background.joblib"
    
    if not model_path.exists():
        logger.error(f"Model not found at {model_path}")
        return None, None
        
    _model = joblib.load(model_path)
    
    try:
        # TreeExplainer is fast and exact for Random Forest
        _explainer = shap.TreeExplainer(_model)
        logger.info("Loaded TreeExplainer.")
    except Exception as e:
        logger.warning(f"TreeExplainer failed: {e}. Falling back to KernelExplainer.")
        if bg_path.exists():
            background_data = joblib.load(bg_path)
            _explainer = shap.KernelExplainer(_model.predict, background_data)
        else:
            logger.error("No background data for KernelExplainer.")
            
    return _explainer, _model


def generate_drift_explanation(batch_id: str, current_values: dict, cpk_threshold: float = 1.33):
    """
    Generate SHAP explanation for a given batch.
    """
    explainer, model = load_explainer()
    if not explainer or not model:
        raise RuntimeError("SHAP Explainer not available.")
        
    # Create DataFrame with exact column order
    df = pd.DataFrame([current_values], columns=_model_columns)
    
    # Calculate SHAP values
    shap_values = explainer.shap_values(df)
    
    # Predict current Cpk
    current_cpk = float(model.predict(df)[0])
    
    # Base value (expected value over background dataset)
    base_value = float(explainer.expected_value) if not isinstance(explainer.expected_value, np.ndarray) else float(explainer.expected_value[0])
    
    # Process explanations
    explanation_list = []
    
    # For TreeExplainer, shap_values is a matrix or list. For single prediction, it's 1D or 2D.
    sv = shap_values[0] if len(np.shape(shap_values)) > 1 else shap_values
    
    for i, col in enumerate(_model_columns):
        val = float(sv[i])
        current_val = float(current_values[col])
        normal_range = NORMAL_RANGES[col]
        
        # Determine direction: positive SHAP means pushing Cpk UP (helpful)
        direction = "helpful" if val > 0 else "harmful"
        
        explanation_list.append({
            "parameter": col,
            "shap_value": round(val, 4),
            "direction": direction,
            "current_value": round(current_val, 2),
            "normal_range": normal_range,
            "abs_shap": abs(val)
        })
        
    # Sort by absolute SHAP value
    explanation_list.sort(key=lambda x: x["abs_shap"], reverse=True)
    
    # Remove temporary sort key
    for exp in explanation_list:
        del exp["abs_shap"]
        
    status = "drift" if current_cpk < cpk_threshold else "normal"
    
    return {
        "batch_id": batch_id,
        "cpk": round(current_cpk, 2),
        "threshold": cpk_threshold,
        "status": status,
        "top_factors": explanation_list[:5],
        "base_value": round(base_value, 2),
        "all_factors": explanation_list,
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }

def get_or_create_explanation(batch_id: str, current_values: dict, cpk_threshold: float = 1.33):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if already cached
    cursor.execute("SELECT result_json FROM drift_explanations WHERE batch_id = ?", (batch_id,))
    row = cursor.fetchone()
    
    import json
    
    if row:
        conn.close()
        return json.loads(row['result_json'])
        
    # Compute
    result = generate_drift_explanation(batch_id, current_values, cpk_threshold)
    
    # Format summary
    if result['status'] == "drift":
        top1 = result['top_factors'][0]
        top2 = result['top_factors'][1]
        
        # Check if model can explain it
        total_abs_shap = sum(abs(f['shap_value']) for f in result['all_factors'])
        
        if total_abs_shap < 0.05 and result['cpk'] < cpk_threshold:
            summary = "Drift detected but outside model's learned parameter space — possible novel failure mode. Recommend manual investigation."
        else:
            def deviation_text(f):
                nr = f['normal_range']
                if f['current_value'] > nr[1]:
                    return f"+{round(f['current_value'] - nr[1], 1)} above"
                elif f['current_value'] < nr[0]:
                    return f"-{round(nr[0] - f['current_value'], 1)} below"
                else:
                    return "within"
                    
            summary = f"Cpk degradation is primarily driven by {top1['parameter'].replace('_', ' ')} ({deviation_text(top1)} normal range) and {top2['parameter'].replace('_', ' ')} ({deviation_text(top2)} normal range)."
    else:
        summary = "Cpk is within acceptable limits."
        
    result['summary'] = summary
    
    # Cache
    cursor.execute(
        "INSERT INTO drift_explanations (batch_id, timestamp, cpk_value, cpk_threshold, result_json) VALUES (?, ?, ?, ?, ?)",
        (batch_id, result['timestamp'], result['cpk'], cpk_threshold, json.dumps(result))
    )
    conn.commit()
    conn.close()
    
    return result

def get_shap_waterfall_data(batch_id: str, current_values: dict, cpk_threshold: float = 1.33):
    result = get_or_create_explanation(batch_id, current_values, cpk_threshold)
    
    # Format for waterfall chart
    features = []
    for f in result['all_factors']:
        features.append({
            "name": f['parameter'],
            "value": f['current_value'],
            "shap_value": f['shap_value']
        })
        
    # Reverse sort by absolute shap value so biggest are at top/bottom depending on chart preference
    # We will just pass them sorted descending
    
    return {
        "base_value": result['base_value'],
        "final_value": result['cpk'],
        "features": features
    }

# Mock current values for testing/demo
def get_mock_snapshot():
    # Intentionally bad parameters to force a drift below 1.33
    return {
        'coating_thickness_um': 205, # Normal 190-195, large deviation
        'drying_temp_c': 148.0,      # Normal 135-140, large deviation
        'drying_time_s': 115,        # Normal 120-130
        'calendering_pressure_mpa': 22,
        'electrolyte_fill_volume_ml': 440,
        'formation_cycle_count': 2,
        'ambient_humidity_pct': 45,
        'slurry_viscosity_cps': 5500,
        'electrode_density_g_cc': 2.7,
        'tab_welding_power_w': 2300
    }
