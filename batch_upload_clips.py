import os
import argparse
import requests

def get_token(api_url, email, password):
    try:
        r = requests.post(f"{api_url}/auth/login", json={"email": email, "password": password})
        if r.status_code == 200:
            return r.json().get("access_token")
        else:
            print(f"[ERROR] Error al autenticar: Codigo {r.status_code} - {r.text}")
            return None
    except Exception as e:
        print(f"[ERROR] Excepcion al autenticar: {e}")
        return None

def upload_clips(api_url, folder, token, email=None, password=None):
    if not os.path.exists(folder):
        print(f"Error: La carpeta '{folder}' no existe.")
        return
    
    # Obtener todos los archivos de video
    extensions = ('.mp4', '.mov', '.avi', '.mkv', '.webm')
    files = [f for f in os.listdir(folder) if f.lower().endswith(extensions)]
    if not files:
        print(f"No se encontraron videos en la carpeta '{folder}'.")
        return
    
    print(f"Se encontraron {len(files)} videos para subir.")
    
    # Si tenemos email y password, obtener un token fresco inicial
    if email and password:
        fresh_token = get_token(api_url, email, password)
        if fresh_token:
            token = fresh_token
            print("[OK] Autenticado exitosamente en el servidor de produccion.")
    
    for filename in sorted(files):
        filepath = os.path.join(folder, filename)
        # Usar el nombre del archivo sin la extensión como nombre del análisis
        name = os.path.splitext(filename)[0]
        print(f"\nSubiendo {filename}...")
        
        # Intentar subir el archivo. Si falla con 401 (no autorizado) y tenemos credenciales, re-autenticar y re-intentar.
        for attempt in range(2):
            headers = {
                "Authorization": f"Bearer {token}"
            }
            try:
                with open(filepath, "rb") as f:
                    files_payload = {
                        "file": (filename, f, "video/mp4")
                    }
                    data_payload = {
                        "name": name
                    }
                    
                    response = requests.post(
                        f"{api_url}/cv/upload",
                        headers=headers,
                        files=files_payload,
                        data=data_payload
                    )
                    
                    if response.status_code == 201:
                        res_data = response.json()
                        print(f"[OK] {filename} subido con exito. ID de Analisis: {res_data.get('id')}")
                        break
                    elif response.status_code == 401 and attempt == 0 and email and password:
                        print("[WARNING] Token vencido o invalido. Re-autenticando para re-intentar...")
                        fresh_token = get_token(api_url, email, password)
                        if fresh_token:
                            token = fresh_token
                            continue
                        else:
                            print(f"[ERROR] Error al subir {filename}: Codigo {response.status_code} - {response.text}")
                            break
                    else:
                        print(f"[ERROR] Error al subir {filename}: Codigo {response.status_code} - {response.text}")
                        break
            except Exception as e:
                clean_err = str(e).encode('ascii', 'ignore').decode('ascii')
                print(f"[ERROR] Error al procesar {filename}: {clean_err}")
                break

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Subida en lote (bulk upload) de clips de video a Deporte FC")
    parser.add_argument("--url", default="https://deporte-api.datawiseconsultoria.com/api/v1", help="URL base de la API de producción")
    parser.add_argument("--folder", required=True, help="Ruta de la carpeta local que contiene los videos")
    parser.add_argument("--token", default=None, help="Tu token de acceso JWT (access_token)")
    parser.add_argument("--email", default="coach@deporte.fc", help="Email de la cuenta de Coach")
    parser.add_argument("--password", default="demo", help="Password de la cuenta de Coach")
    
    args = parser.parse_args()
    
    # Asegurarnos de limpiar la url por si termina en /
    api_url = args.url.rstrip('/')
    
    upload_clips(api_url, args.folder, args.token, args.email, args.password)
