# Patch GitHub Pages (CONCRETE2)

Este ZIP trae **solo** los archivos necesarios para que Vite funcione bien en GitHub Pages
bajo el subpath `/CONCRETE2/`.

## Archivos incluidos
- `apps/web/vite.config.ts`  (con `base: '/CONCRETE2/'`)
- `.github/workflows/deploy-pages.yml` (deploy automático con GitHub Actions)

## Cómo aplicarlo
1) Descarga y descomprime este ZIP.
2) En tu repo, sube/reemplaza esos mismos archivos en esas rutas.
3) Repo -> Settings -> Pages -> Source: **GitHub Actions**
4) Haz commit y revisa Actions hasta que termine el deploy.
