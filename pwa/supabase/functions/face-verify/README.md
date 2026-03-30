# Edge Function: face-verify

Esta Function implementa el contrato que la PWA necesita:

- Input (POST JSON):
```json
{
  "tenant_id": "...",
  "employee_id": "...",
  "selfie": { "bucket": "punch-selfies", "path": "..." },
  "threshold": 0.6
}
```

- Output (JSON):
```json
{ "match": true, "score": 0.91, "threshold": 0.6, "provider": "aws_rekognition" }
```

## Cómo desplegar

1) Instala Supabase CLI.
2) Inicia sesión:
```bash
supabase login
```
3) Linkea tu proyecto:
```bash
supabase link --project-ref <TU_PROJECT_REF>
```
4) Define secrets (en Supabase Dashboard o CLI):
- `FACE_VERIFY_API_URL`
- `FACE_VERIFY_API_KEY` (opcional)
- `FACE_VERIFY_ALLOW_FALLBACK` (`false` recomendado)

5) Deploy:
```bash
supabase functions deploy face-verify
```

## Integración real de reconocimiento facial

Recomendación enterprise:
- Un microservicio Node/Python con AWS SDK (Rekognition CompareFaces)
- Este Edge Function actúa como proxy autenticado.

Ventajas:
- Evitas implementar SigV4 en Deno.
- Mantienes el secreto de AWS fuera del frontend.
