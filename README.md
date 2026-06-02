# Edificio Frontend

Frontend de administracion para Edificio App, construido con React y Vite.

## Requisitos

- Node.js 20+
- Backend de Edificio App corriendo en `http://localhost:8080`

## Instalacion

```bash
npm install
```

## Desarrollo

```bash
npm run dev
```

La app queda disponible en:

```text
http://localhost:5173
```

Durante desarrollo, Vite redirige `/api/**` hacia `http://localhost:8080`.

## Build

```bash
npm run build
```

## Seguridad

Este repositorio no debe incluir credenciales, tokens, archivos `.env.local`, `node_modules` ni builds generados en `dist`.
