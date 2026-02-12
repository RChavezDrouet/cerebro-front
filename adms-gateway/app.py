import logging
import requests
import ssl
from flask import Flask, request, Response
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# URL DE TU NUBE (Backend Node.js)
SAAS_URL = "http://localhost:3005/api/integrations/zkteco/receive"

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')
logger = logging.getLogger("Gateway")

# --- RUTA 1: HEARTBEAT (LA QUE FALTABA) ---
@app.route('/iclock/getrequest', methods=['GET'])
def device_heartbeat():
    # El dispositivo pregunta: "¿Hay comandos para mí?"
    # Respondemos: "OK" para mantener la conexión viva.
    # No usamos logger aquí para no llenar la pantalla de basura repetida
    return Response("OK", mimetype='text/plain')

# --- RUTA 2: DATOS Y HANDSHAKE ---
@app.route('/iclock/cdata', methods=['GET', 'POST'])
def receive_data():
    # A. Handshake (Saludo inicial)
    if request.method == 'GET':
        sn = request.args.get('SN', 'Unknown')
        if 'options' in request.args:
            logger.info(f"🤝 Saludo recibido del equipo {sn}")
            return Response("GET OPTION FROM: 123456\nStamp=9999\nOpStamp=9999\nErrorDelay=60\nDelay=30\nTransTimes=00:00;14:05\nTransInterval=1\nTransFlag=1111000000\nRealtime=1\nEncrypt=0", mimetype='text/plain')
        return Response("OK", mimetype='text/plain')

    # B. Recepción de Logs (POST)
    sn = request.args.get('SN', 'Unknown')
    table = request.args.get('table', 'ATTLOG')
    
    if table == 'OPERLOG': return Response("OK", mimetype='text/plain')

    raw_payload = request.data.decode('utf-8')
    records = []
    
    try:
        for line in raw_payload.splitlines():
            parts = line.split('\t')
            if len(parts) >= 2 and "FID=" not in parts[1]:
                records.append({
                    "user_id": parts[0],
                    "check_time": parts[1],
                    "status": parts[2] if len(parts) > 2 else 0,
                    "verify_type": parts[3] if len(parts) > 3 else 0
                })

        if records:
            # ENVIAR A LA NUBE
            try:
                res = requests.post(SAAS_URL, json={"device_sn": sn, "records": records}, timeout=3)
                logger.info(f"📤 Enviados {len(records)} registros de {sn} a la Nube.")
            except Exception as e:
                logger.error(f"❌ Error conectando a Nube: {e}")

    except Exception as e:
        logger.error(f"Error procesando: {e}")

    return Response("OK", mimetype='text/plain')

if __name__ == '__main__':
    print("🚀 GATEWAY HTTPS SEGURO ACTIVO (PUERTO 8081)")
    # 'adhoc' genera el certificado SSL necesario para tu biométrico
    app.run(host='0.0.0.0', port=8081, ssl_context='adhoc')