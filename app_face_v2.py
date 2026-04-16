#!/usr/bin/env python3
"""
HRCloud Face Verify Service v2.0
Algoritmo de 2 capas:
  Capa 1: Haar Cascade - detecta si hay rostro real
  Capa 2: LBPH - compara rostro con foto de referencia
"""
import os, logging, time, datetime
from flask import Flask, request, jsonify
import numpy as np
import cv2
import requests as http_requests

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
log = logging.getLogger(__name__)
app = Flask(__name__)

SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_KEY', '')
API_SECRET   = os.environ.get('API_SECRET', 'hrcloud-face-2026')
THRESHOLD    = float(os.environ.get('FACE_THRESHOLD', '0.75'))

HAAR_PATH    = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
face_cascade = cv2.CascadeClassifier(HAAR_PATH)
log.info(f"Haar Cascade: {HAAR_PATH}")

def headers_public():
    return {'Authorization': f'Bearer {SUPABASE_KEY}', 'apikey': SUPABASE_KEY}

def headers_attendance():
    return {'Authorization': f'Bearer {SUPABASE_KEY}', 'apikey': SUPABASE_KEY,
            'Content-Type': 'application/json',
            'Accept-Profile': 'attendance', 'Content-Profile': 'attendance'}

def download_image(bucket, path):
    url = f"{SUPABASE_URL}/storage/v1/object/{bucket}/{path}"
    try:
        r = http_requests.get(url, headers=headers_public(), timeout=15)
        if r.status_code != 200:
            log.error(f"Storage {r.status_code}: {path}")
            return None
        arr = np.frombuffer(r.content, np.uint8)
        return cv2.imdecode(arr, cv2.IMREAD_COLOR)
    except Exception as e:
        log.error(f"Download error: {e}")
        return None

def detect_face(img_bgr):
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)
    faces = face_cascade.detectMultiScale(
        gray, scaleFactor=1.1, minNeighbors=5,
        minSize=(60, 60), flags=cv2.CASCADE_SCALE_IMAGE
    )
    if len(faces) == 0:
        return None
    x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
    face = gray[y:y+h, x:x+w]
    return cv2.resize(face, (150, 150))

def compare_lbph(ref_face, selfie_face):
    recognizer = cv2.face.LBPHFaceRecognizer_create(radius=1, neighbors=8, grid_x=8, grid_y=8)
    recognizer.train([ref_face], np.array([0]))
    label, confidence = recognizer.predict(selfie_face)
    score = max(0.0, 1.0 - (confidence / 150.0))
    return round(score, 4), round(confidence, 1)

def check_quality(img_bgr):
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    brightness = float(gray.mean())
    issues = []
    if brightness < 40: issues.append('Imagen muy oscura')
    if brightness > 230: issues.append('Imagen sobreexpuesta')
    h, w = img_bgr.shape[:2]
    if w < 80 or h < 80: issues.append('Resolucion muy baja')
    return {'brightness': round(brightness, 1), 'issues': issues}

def get_employee_photo(tenant_id, employee_id):
    url = f"{SUPABASE_URL}/rest/v1/employees?select=photo_path&id=eq.{employee_id}&tenant_id=eq.{tenant_id}"
    try:
        r = http_requests.get(url, headers=headers_attendance(), timeout=10)
        if r.status_code == 200 and r.json():
            return r.json()[0].get('photo_path')
    except Exception as e:
        log.error(f"Employee lookup: {e}")
    return None

def update_evidence(evidence_id, status, notes):
    url = f"{SUPABASE_URL}/rest/v1/punch_evidence?id=eq.{evidence_id}"
    payload = {
        'verification_status': status,
        'verification_notes': notes,
        'verified_at': datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S.%f+00:00'),
    }
    try:
        r = http_requests.patch(url, headers=headers_attendance(), json=payload, timeout=10)
        log.info(f"Evidence {evidence_id[:8]}... -> {status} ({r.status_code})")
    except Exception as e:
        log.error(f"Evidence update: {e}")

def run_verify(evidence_id, tenant_id, employee_id, selfie_bucket, selfie_path):
    t0 = time.time()

    selfie_img = download_image(selfie_bucket, selfie_path)
    if selfie_img is None:
        update_evidence(evidence_id, 'error', 'No se pudo descargar la selfie')
        return {'match': False, 'reason': 'selfie_download_failed'}

    quality = check_quality(selfie_img)
    if quality['issues']:
        notes = f"Calidad insuficiente: {', '.join(quality['issues'])}"
        update_evidence(evidence_id, 'failed', notes)
        return {'match': False, 'reason': notes}

    selfie_face = detect_face(selfie_img)
    if selfie_face is None:
        notes = 'No se detecto rostro en la selfie'
        update_evidence(evidence_id, 'rejected', notes)
        log.info(f"CAPA 1 FALLO: sin rostro")
        return {'match': False, 'reason': notes, 'layer': 1}

    log.info("CAPA 1 OK: rostro detectado en selfie")

    ref_path = get_employee_photo(tenant_id, employee_id)
    if not ref_path:
        update_evidence(evidence_id, 'failed', 'Empleado sin foto de referencia')
        return {'match': None, 'reason': 'no_reference_photo'}

    ref_img = download_image('employee_photos', ref_path)
    if ref_img is None:
        update_evidence(evidence_id, 'failed', 'No se pudo descargar foto de referencia')
        return {'match': None, 'reason': 'reference_download_failed'}

    ref_face = detect_face(ref_img)
    if ref_face is None:
        ref_gray = cv2.cvtColor(ref_img, cv2.COLOR_BGR2GRAY)
        ref_face = cv2.resize(ref_gray, (150, 150))
        log.warning("Foto referencia sin rostro detectable, usando imagen completa")

    score, lbph_conf = compare_lbph(ref_face, selfie_face)
    match = score >= THRESHOLD
    status = 'verified' if match else 'rejected'
    notes = f"score={score:.3f} threshold={THRESHOLD} lbph_conf={lbph_conf} layer=2"
    update_evidence(evidence_id, status, notes)

    elapsed = round(time.time() - t0, 3)
    log.info(f"CAPA 2: match={match} score={score:.3f} lbph_conf={lbph_conf} elapsed={elapsed}s")
    return {'match': match, 'score': score, 'lbph_confidence': lbph_conf,
            'threshold': THRESHOLD, 'elapsed_s': elapsed, 'layer': 2}

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'service': 'hrcloud-face-verify',
                    'version': '2.0', 'algorithm': 'HaarCascade+LBPH', 'threshold': THRESHOLD})

@app.route('/verify', methods=['POST'])
def verify():
    data = request.get_json(force=True)
    if data.get('secret') != API_SECRET:
        return jsonify({'error': 'Unauthorized'}), 401
    if not all(data.get(k) for k in ['evidence_id','tenant_id','employee_id','selfie_path']):
        return jsonify({'error': 'Missing fields'}), 400
    return jsonify(run_verify(data['evidence_id'], data['tenant_id'], data['employee_id'],
                              data.get('selfie_bucket','punch-selfies'), data['selfie_path']))

@app.route('/verify-pwa', methods=['POST'])
def verify_pwa():
    data = request.get_json(force=True)
    if data.get('secret') != API_SECRET:
        return jsonify({'error': 'Unauthorized'}), 401
    tenant_id, employee_id = data.get('tenant_id'), data.get('employee_id')
    selfie = data.get('selfie', {})
    selfie_path = selfie.get('path')
    if not all([tenant_id, employee_id, selfie_path]):
        return jsonify({'error': 'Missing fields'}), 400
    url = f"{SUPABASE_URL}/rest/v1/punch_evidence?employee_id=eq.{employee_id}&tenant_id=eq.{tenant_id}&verification_status=eq.pending&order=created_at.desc&limit=1"
    try:
        r = http_requests.get(url, headers=headers_attendance(), timeout=10)
        items = r.json() if r.status_code == 200 else []
    except:
        items = []
    if not items:
        return jsonify({'match': True, 'score': None, 'provider': 'fallback_allow', 'reason': 'No pending evidence'})
    result = run_verify(items[0]['id'], tenant_id, employee_id,
                        selfie.get('bucket','punch-selfies'), selfie_path)
    return jsonify({'match': result.get('match', True), 'score': result.get('score'),
                    'threshold': float(THRESHOLD), 'provider': 'hrcloud-face-v2',
                    'reason': result.get('reason'), 'layer': result.get('layer')})

@app.route('/process-pending', methods=['POST'])
def process_pending():
    data = request.get_json(force=True)
    if data.get('secret') != API_SECRET:
        return jsonify({'error': 'Unauthorized'}), 401
    url = f"{SUPABASE_URL}/rest/v1/punch_evidence?select=id,tenant_id,employee_id,selfie_bucket,selfie_path&verification_status=eq.pending&limit=50"
    try:
        r = http_requests.get(url, headers=headers_attendance(), timeout=10)
        pending = r.json() if r.status_code == 200 else []
        log.info(f"Pending: {len(pending)} records")
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    results = []
    for item in pending:
        try:
            result = run_verify(item['id'], item['tenant_id'], item['employee_id'],
                                item.get('selfie_bucket') or 'punch-selfies', item['selfie_path'])
            results.append({'id': item['id'], 'result': result})
        except Exception as e:
            results.append({'id': item['id'], 'error': str(e)})
    return jsonify({'processed': len(results), 'results': results})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=False)